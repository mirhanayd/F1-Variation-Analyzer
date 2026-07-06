import openF1Api from './openF1Api';
import jolpicaApi from './jolpicaApi';

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
        openF1Api.getMeetings({ year }, options),
        openF1Api.getSessions({ year }, options),
        jolpicaApi.getRaceSchedule(year, options),
      ]);

      return { year, meetings, sessions, races };
    }, { cacheTimeout: 30 * 60 * 1000 });
  }

  async getAllCircuits(options = {}) {
    return this.getOrFetch('all_circuits', () => jolpicaApi.getAllCircuits(options), {
      cacheTimeout: 24 * 60 * 60 * 1000,
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

  async getReplayPackage(track, options = {}) {
    if (!track.openF1) return null;

    const cacheKey = `replay_${track.id}_${options.driverLimit ?? 8}_${options.replayWindowMs ?? 'default'}`;

    return this.getOrFetch(cacheKey, () => openF1Api.getReplayPackage(track.openF1, options), {
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
