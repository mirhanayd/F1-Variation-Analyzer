import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OPENF1_FIRST_YEAR = 2023;
const HISTORICAL_DELAY_MS = 30 * 60 * 1_000;
const MAX_LOCAL_REPLAY_BYTES = 100 * 1024 * 1024;
const MAX_REMOTE_RESPONSE_BYTES = 50 * 1024 * 1024;

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
    sessionName: session?.session_name ?? session?.sessionName ?? null,
    meetingName: meeting?.meeting_name ?? meeting?.meetingName ?? meeting?.location ?? null,
    circuitShortName: meeting?.circuit_short_name ?? session?.circuit_short_name ?? null,
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
    if (cached && this.now() - cached.cachedAt < 30 * 60 * 1_000) return cached.replay;

    const startMs = Date.parse(session.date_start);
    const endMs = Math.min(Date.parse(session.date_end), startMs + this.config.windowMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
    const dateStart = new Date(startMs).toISOString();
    const dateEnd = new Date(endMs).toISOString();

    const meetings = await this.#fetchJson('meetings', { meeting_key: session.meeting_key });
    const drivers = await this.#fetchOptional('drivers', { session_key: session.session_key });
    const dateParams = {
      session_key: session.session_key,
      'date>=': dateStart,
      'date<=': dateEnd,
    };
    const location = await this.#fetchOptional('location', dateParams);
    const carData = await this.#fetchOptional('car_data', dateParams);
    const position = await this.#fetchOptional('position', dateParams);
    const intervals = await this.#fetchOptional('intervals', dateParams);
    const laps = await this.#fetchOptional('laps', {
      session_key: session.session_key,
      'date_start>=': dateStart,
      'date_start<=': dateEnd,
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
