import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OPENF1_FIRST_YEAR = 2023;
const HISTORICAL_DELAY_MS = 30 * 60 * 1_000;
const MAX_LOCAL_REPLAY_BYTES = 100 * 1024 * 1024;
const MAX_REMOTE_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_REMOTE_CACHE_ENTRIES = 3;
const MAX_REMOTE_PENDING_REPLAYS = 4;

const wait = (milliseconds) => new Promise((resolve) => {
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
});

const sessionOf = (replay) => replay?.session ?? replay?.metadata?.session ?? null;
const meetingOf = (replay) => replay?.meeting ?? replay?.metadata?.meeting ?? null;
const sessionKeyOf = (replay, fallback) => String(
  sessionOf(replay)?.session_key
  ?? sessionOf(replay)?.sessionKey
  ?? replay?.sessionKey
  ?? fallback,
);

const replayDate = (replay) => Date.parse(
  sessionOf(replay)?.date_start
  ?? sessionOf(replay)?.dateStart
  ?? replay?.window?.start
  ?? 0,
) || 0;

const publicReplayMetadata = (entry) => {
  const replay = entry.replay;
  const session = sessionOf(replay);
  const meeting = meetingOf(replay);
  return {
    id: entry.id,
    sessionKey: session?.session_key ?? session?.sessionKey ?? entry.id,
    meetingKey: meeting?.meeting_key ?? meeting?.meetingKey ?? session?.meeting_key ?? null,
    sessionName: session?.session_name ?? session?.sessionName ?? session?.name ?? null,
    meetingName: meeting?.meeting_name ?? meeting?.meetingName ?? meeting?.location ?? session?.meetingName ?? null,
    circuitShortName: meeting?.circuit_short_name ?? session?.circuit_short_name ?? session?.circuitName ?? null,
    dateStart: session?.date_start ?? session?.dateStart ?? entry.replay?.window?.start ?? null,
    source: entry.source,
  };
};

export class HistoricalReplayService {
  constructor(config, {
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
  } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.generatedCache = null;
    this.remoteCache = new Map();
    this.remotePending = new Map();
    this.lastApiRequestAt = 0;
    this.apiQueue = Promise.resolve();
  }

  async listSessions({ circuitShortName = null } = {}) {
    const entries = await this.#loadGeneratedEntries();
    return entries
      .filter((entry) => {
        if (!circuitShortName) return true;
        return publicReplayMetadata(entry).circuitShortName?.toLowerCase() === circuitShortName.toLowerCase();
      })
      .sort((a, b) => replayDate(b.replay) - replayDate(a.replay))
      .map(publicReplayMetadata);
  }

  async getReplay(sessionKey) {
    const safeKey = String(sessionKey);
    const entries = await this.#loadGeneratedEntries();
    const local = entries.find((entry) => entry.id === safeKey || sessionKeyOf(entry.replay, entry.id) === safeKey);
    if (local) return local.replay;
    if (!this.config.remoteFallback || !/^\d+$/.test(safeKey)) return null;

    const sessions = await this.#fetchJson('sessions', { session_key: safeKey });
    if (!sessions[0]) return null;
    return this.#fetchReplayPackage(sessions[0]);
  }

  async getLatestReplay({ circuitShortName = null } = {}) {
    const entries = await this.#loadGeneratedEntries();
    const matching = entries
      .filter((entry) => !circuitShortName
        || publicReplayMetadata(entry).circuitShortName?.toLowerCase() === circuitShortName.toLowerCase())
      .sort((a, b) => replayDate(b.replay) - replayDate(a.replay));
    if (matching[0]) return matching[0].replay;
    if (!this.config.remoteFallback) return null;

    const session = await this.#findLatestCompletedSession(circuitShortName);
    return session ? this.#fetchReplayPackage(session) : null;
  }

  clearGeneratedCache() {
    this.generatedCache = null;
  }

  async #loadGeneratedEntries() {
    if (this.generatedCache) return this.generatedCache;
    let filenames;
    try {
      filenames = (await readdir(this.config.generatedDirectory))
        .filter((filename) => filename.toLowerCase().endsWith('.json'));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    const entries = [];
    for (const filename of filenames) {
      const filePath = path.resolve(this.config.generatedDirectory, filename);
      const fileStat = await stat(filePath);
      if (fileStat.size > MAX_LOCAL_REPLAY_BYTES) continue;
      try {
        const replay = JSON.parse(await readFile(filePath, 'utf8'));
        entries.push({
          id: sessionKeyOf(replay, path.basename(filename, '.json')),
          source: replay.source ?? 'generated-json',
          filename,
          replay,
        });
      } catch {
        // A malformed generated artifact is skipped; one bad file cannot stop the gateway.
      }
    }
    this.generatedCache = entries;
    return entries;
  }

  async #findLatestCompletedSession(circuitShortName) {
    const currentYear = new Date(this.now()).getUTCFullYear();
    const historicalCutoff = this.now() - HISTORICAL_DELAY_MS;

    for (let year = currentYear; year >= OPENF1_FIRST_YEAR; year -= 1) {
      const params = { year };
      if (circuitShortName) params.circuit_short_name = circuitShortName;
      const sessions = await this.#fetchJson('sessions', params);
      const completed = sessions
        .filter((session) => Date.parse(session.date_end) < historicalCutoff)
        .sort((a, b) => Date.parse(b.date_end) - Date.parse(a.date_end));
      if (completed.length === 0) continue;

      // Prefer a race from the latest completed meeting, with the latest session as fallback.
      const latestMeetingKey = completed[0].meeting_key;
      return completed.find((session) => (
        session.meeting_key === latestMeetingKey && session.session_name === 'Race'
      )) ?? completed[0];
    }
    return null;
  }

  async #fetchReplayPackage(session) {
    const sessionKey = String(session.session_key);
    const cached = this.remoteCache.get(sessionKey);
    if (cached && this.now() - cached.cachedAt < 30 * 60 * 1_000) {
      this.remoteCache.delete(sessionKey);
      this.remoteCache.set(sessionKey, cached);
      return cached.replay;
    }
    if (cached) this.remoteCache.delete(sessionKey);
    if (this.remotePending.has(sessionKey)) return this.remotePending.get(sessionKey);
    if (this.remotePending.size >= MAX_REMOTE_PENDING_REPLAYS) {
      throw new Error('Replay service is busy; retry shortly');
    }

    const pending = this.#loadRemoteReplay(session, sessionKey)
      .finally(() => this.remotePending.delete(sessionKey));
    this.remotePending.set(sessionKey, pending);
    return pending;
  }

  async #loadRemoteReplay(session, sessionKey) {
    const scheduledStartMs = Date.parse(session.date_start);
    const sessionEndMs = Date.parse(session.date_end);
    if (!Number.isFinite(scheduledStartMs) || !Number.isFinite(sessionEndMs)) return null;
    const meetings = await this.#fetchJson('meetings', { meeting_key: session.meeting_key });
    const drivers = await this.#fetchOptional('drivers', { session_key: session.session_key });
    const allLaps = await this.#fetchOptional('laps', { session_key: session.session_key });
    const firstLapMs = allLaps
      .map((lap) => Date.parse(lap.date_start ?? lap.date))
      .filter((value) => Number.isFinite(value) && value >= scheduledStartMs && value <= sessionEndMs)
      .sort((left, right) => left - right)[0];
    // Some historical sessions begin publishing location data at the scheduled
    // session time but do not publish race timing until much later. If the first
    // lap lies beyond the normal replay window, move the window to the first
    // real lap instead of returning an apparently valid location-only replay.
    const startMs = Number.isFinite(firstLapMs) && firstLapMs > scheduledStartMs + this.config.windowMs
      ? Math.max(scheduledStartMs, firstLapMs - 30_000)
      : scheduledStartMs;
    const endMs = Math.min(sessionEndMs, startMs + this.config.windowMs);
    if (endMs <= startMs) return null;
    const dateStart = new Date(startMs).toISOString();
    const dateEnd = new Date(endMs).toISOString();

    const dateParams = {
      session_key: session.session_key,
      // URLSearchParams supplies the `=` delimiter. OpenF1's `date>=value`
      // syntax therefore uses `date>` as the parameter key (and likewise `<`).
      'date>': dateStart,
      'date<': dateEnd,
    };
    const location = await this.#fetchOptional('location', dateParams);
    const carData = await this.#fetchOptional('car_data', dateParams);
    const position = await this.#fetchOptional('position', dateParams);
    const intervals = await this.#fetchOptional('intervals', dateParams);
    const laps = allLaps.filter((lap) => {
      const timestamp = Date.parse(lap.date_start ?? lap.date);
      return Number.isFinite(timestamp) && timestamp >= startMs && timestamp <= endMs;
    });

    const replay = {
      source: 'openf1-historical-replay',
      meeting: meetings[0] ?? null,
      session,
      drivers,
      location,
      carData,
      position,
      intervals,
      laps,
      window: { start: dateStart, end: dateEnd, durationMs: endMs - startMs },
    };
    this.remoteCache.set(sessionKey, { cachedAt: this.now(), replay });
    while (this.remoteCache.size > MAX_REMOTE_CACHE_ENTRIES) {
      this.remoteCache.delete(this.remoteCache.keys().next().value);
    }
    return replay;
  }

  async #fetchOptional(endpoint, params) {
    try {
      return await this.#fetchJson(endpoint, params);
    } catch {
      return [];
    }
  }

  async #fetchJson(endpoint, params = {}) {
    const operation = async () => {
      const waitMs = this.config.apiMinIntervalMs - (this.now() - this.lastApiRequestAt);
      if (waitMs > 0) await wait(waitMs);
      this.lastApiRequestAt = this.now();

      const url = new URL(`${this.config.apiUrl}/${endpoint}`);
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') url.searchParams.append(key, value);
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      timeout.unref?.();
      let response;
      try {
        response = await this.fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      // OpenF1 uses 404 for a valid query that has no matching historical
      // records. Treat that as an empty result so callers can return a clean
      // replay-not-found state instead of misreporting an upstream outage.
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`OpenF1 historical request failed (${response.status})`);
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_REMOTE_RESPONSE_BYTES) {
        throw new Error('OpenF1 historical response exceeded the gateway size limit');
      }
      const value = JSON.parse(text);
      return Array.isArray(value) ? value : [];
    };

    const queued = this.apiQueue.then(operation, operation);
    this.apiQueue = queued.catch(() => {});
    return queued;
  }
}
