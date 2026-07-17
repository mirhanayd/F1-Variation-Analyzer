import openF1Api from './openF1Api';
import jolpicaApi from './jolpicaApi';
import backendApi from './backendApi';

const groupByDriver = (records = []) => records.reduce((groups, record) => {
  const key = record.driver_number ?? record.driverNumber;
  if (key === undefined || key === null) return groups;
  if (!groups[key]) groups[key] = [];
  groups[key].push(record);
  return groups;
}, {});

const normalizeGatewayReplay = (replay) => {
  if (!replay) return null;
  if (replay.locationByDriver) return replay;
  const generatedSamples = replay.samplesByDriver ?? null;
  const generatedDrivers = Object.values(replay.driversByNumber ?? {}).map((driver) => ({
    ...driver,
    driver_number: driver.driver_number ?? driver.driverNumber,
    name_acronym: driver.name_acronym ?? driver.acronym,
    broadcast_name: driver.broadcast_name ?? driver.broadcastName,
    full_name: driver.full_name ?? driver.fullName,
    team_name: driver.team_name ?? driver.teamName,
    team_colour: driver.team_colour ?? driver.teamColor,
  }));
  const sampleDates = Object.values(generatedSamples ?? {})
    .flat()
    .map((sample) => Date.parse(sample.date))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const windowStart = replay.window?.start
    ?? (sampleDates[0] ? new Date(sampleDates[0]).toISOString() : replay.session?.dateStart);
  const windowEnd = replay.window?.end
    ?? (sampleDates.at(-1) ? new Date(sampleDates.at(-1)).toISOString() : windowStart);
  const durationMs = replay.window?.durationMs
    ?? Math.max(0, Date.parse(windowEnd) - Date.parse(windowStart));
  return {
    ...replay,
    meeting: replay.meeting ?? {
      meeting_name: replay.session?.meetingName ?? replay.session?.event ?? 'Generated replay',
      circuit_short_name: replay.session?.circuitName ?? null,
    },
    session: replay.session?.session_name ? replay.session : {
      ...replay.session,
      session_key: replay.session?.sessionKey,
      session_name: replay.session?.name ?? 'Race',
      date_start: replay.session?.dateStart ?? windowStart,
    },
    drivers: replay.drivers ?? generatedDrivers,
    locationByDriver: generatedSamples ?? groupByDriver(replay.location ?? []),
    carDataByDriver: groupByDriver(replay.carData ?? []),
    positionByDriver: groupByDriver(replay.position ?? []),
    intervalsByDriver: groupByDriver(replay.intervals ?? []),
    lapsByDriver: groupByDriver(replay.laps ?? []),
    window: { start: windowStart, end: windowEnd, durationMs },
    circuitGeometry: null,
  };
};

class DataManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
  }

  async getOrFetch(key, fetchFunction, { cacheTimeout = this.cacheTimeout } = {}) {
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.data;
    }

    const data = await fetchFunction();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  async getSeasonSchedule(year, options = {}) {
    return this.getOrFetch(`season_schedule_${year}`, async () => {
      const [meetings, sessions, races] = await Promise.all([
        openF1Api.getMeetings({ year }, options).catch((err) => {
          console.warn('OpenF1 meetings unavailable, falling back to Jolpica:', err.message);
          return [];
        }),
        openF1Api.getSessions({ year }, options).catch((err) => {
          console.warn('OpenF1 sessions unavailable, falling back to Jolpica:', err.message);
          return [];
        }),
        jolpicaApi.getRaceSchedule(year, options),
      ]);

      return {
        year,
        meetings: Array.isArray(meetings) ? meetings : [],
        sessions: Array.isArray(sessions) ? sessions : [],
        races: Array.isArray(races) ? races : [],
      };
    }, { cacheTimeout: 30 * 60 * 1000 });
  }

  async getAllCircuits(options = {}) {
    return this.getOrFetch('all_circuits', () => jolpicaApi.getAllCircuits(options), {
      cacheTimeout: 24 * 60 * 60 * 1000,
    });
  }

  async getDriverStandings(year, options = {}) {
    return this.getOrFetch(`driver_standings_${year}`, () => jolpicaApi.getDriverStandings(year, options), {
      cacheTimeout: 10 * 60 * 1000,
    });
  }

  async getConstructorStandings(year, options = {}) {
    return this.getOrFetch(`constructor_standings_${year}`, () => jolpicaApi.getConstructorStandings(year, options), {
      cacheTimeout: 10 * 60 * 1000,
    });
  }

  async getRaceClassification(year, round, options = {}) {
    return this.getOrFetch(`race_classification_${year}_${round}`, () => jolpicaApi.getRaceClassification(year, round, options), {
      cacheTimeout: 10 * 60 * 1000,
    });
  }

  async getCircuitData(track, year = new Date().getUTCFullYear(), options = {}) {
    const cacheKey = `circuit_${track.id}_${year}`;

    return this.getOrFetch(cacheKey, async () => {
      const circuitId = track.jolpicaCircuitId ?? track.id;
      const circuitStats = await jolpicaApi.getCircuitStats(circuitId, options);

      return {
        circuitId,
        year,
        stats: circuitStats,
        fetchedAt: new Date().toISOString(),
      };
    });
  }

  async getCircuitOutline(track, options = {}) {
    if (!track.openF1) return null;

    return this.getOrFetch(`outline_${track.id}`, () => openF1Api.getCircuitOutline(track.openF1, options), {
      cacheTimeout: 24 * 60 * 60 * 1000,
    });
  }

  async getReplayPackage(track, options = {}) {
    if (!track.openF1) return null;

    const cacheKey = `replay_${track.id}_${options.driverLimit ?? 8}_${options.replayWindowMs ?? 'default'}`;
    const circuitNames = track.openF1.circuitShortNames ?? [track.openF1.circuitShortName];
    const circuitShortName = circuitNames.find(Boolean);

    return this.getOrFetch(cacheKey, async () => {
      try {
        return normalizeGatewayReplay(await backendApi.getLatestReplay(
          { circuitShortName },
          { signal: options.signal, timeoutMs: 90_000 },
        ));
      } catch (error) {
        // Older/custom gateways may not expose /latest yet. The compatibility
        // path still remains backend-only through the allowlisted proxy.
        if (!String(error.message).includes('Gateway endpoint not found')) throw error;
        return openF1Api.getReplayPackage(track.openF1, options);
      }
    }, {
      cacheTimeout: 15 * 60 * 1000,
    });
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export default new DataManager();
