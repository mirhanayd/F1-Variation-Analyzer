import backendApi from './backendApi';
import { isGatewayDown, markGatewayDown, markGatewayUp, shouldRecheck } from './gatewayStatus';

const JOLPICA_DIRECT_URL = 'https://api.jolpi.ca/ergast/f1';

const getRaces = (data) => data?.MRData?.RaceTable?.Races ?? [];
const getCircuits = (data) => data?.MRData?.CircuitTable?.Circuits ?? [];

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
};

const directFetch = async (path, params = {}, options = {}) => {
  const safePath = String(path).replace(/^\/+/, '');
  const url = `${JOLPICA_DIRECT_URL}/${safePath}${toQueryString(params)}`;

  const controller = new AbortController();
  const callerSignal = options.signal;
  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  const timeout = setTimeout(() => controller.abort('Direct Jolpica request timed out'), 20_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Direct Jolpica request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
};

class JolpicaService {
  async request(path = '', params = {}, options = {}) {
    // If the gateway is known to be down and it's not time to recheck, go direct.
    if (isGatewayDown() && !shouldRecheck()) {
      return directFetch(path, params, options);
    }

    try {
      const data = await backendApi.jolpica(path, params, { ...options, timeoutMs: 3_000 });
      markGatewayUp();
      return data;
    } catch (err) {
      // If the caller explicitly aborted, don't fallback — propagate immediately.
      if (err?.name === 'AbortError' || String(err?.message).includes('abort')) throw err;

      console.warn('Gateway unavailable, falling back to direct Jolpica API:', err?.message);
      markGatewayDown();
      return directFetch(path, params, options);
    }
  }

  async getCircuit(circuitId, options = {}) {
    const data = await this.request(`circuits/${circuitId}.json`, {}, options);
    return getCircuits(data)[0] ?? null;
  }

  async getRaceSchedule(year = 'current', options = {}) {
    const data = await this.request(`${year}.json`, { limit: 100 }, options);
    return getRaces(data);
  }

  async getDriverStandings(year = 'current', options = {}) {
    const data = await this.request(`${year}/driverStandings.json`, { limit: 100 }, options);
    return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
  }

  async getConstructorStandings(year = 'current', options = {}) {
    const data = await this.request(`${year}/constructorStandings.json`, { limit: 100 }, options);
    return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
  }

  async getRaceClassification(year, round, options = {}) {
    const data = await this.request(`${year}/${round}/results.json`, { limit: 100 }, options);
    return data?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];
  }

  async getRaceResults(year, circuitId, options = {}) {
    const data = await this.request(`${year}/circuits/${circuitId}/results.json`, {
      limit: 100,
    }, options);

    return getRaces(data)[0] ?? null;
  }

  async getCircuitRaceHistory(circuitId, options = {}) {
    const data = await this.request(`circuits/${circuitId}/results.json`, {
      limit: 100,
    }, options);

    return getRaces(data);
  }

  async getQualifying(year, circuitId, options = {}) {
    const data = await this.request(`${year}/circuits/${circuitId}/qualifying.json`, {
      limit: 100,
    }, options);

    return getRaces(data)[0] ?? null;
  }

  async getLapTimes(year, round, lap = 1, options = {}) {
    const data = await this.request(`${year}/${round}/laps/${lap}.json`, {
      limit: 100,
    }, options);

    return getRaces(data)[0]?.Laps ?? [];
  }

  async getFastestLap(circuitId, options = {}) {
    const data = await this.request(`circuits/${circuitId}/fastest/1/results.json`, {}, options);
    const race = getRaces(data)[0];
    const result = race?.Results?.[0];

    if (!race || !result?.FastestLap?.Time) return null;

    return {
      time: result.FastestLap.Time.time,
      driver: `${result.Driver.givenName} ${result.Driver.familyName}`,
      year: race.season,
      circuit: race.Circuit.circuitName,
    };
  }

  async getAllCircuits(options = {}) {
    const data = await this.request('circuits.json', { limit: 100 }, options);
    return getCircuits(data);
  }

  async getCircuitStats(circuitId, options = {}) {
    const [circuit, fastestLap] = await Promise.all([
      this.getCircuit(circuitId, options),
      this.getFastestLap(circuitId, options),
    ]);

    if (!circuit) return null;

    return {
      id: circuit.circuitId,
      name: circuit.circuitName,
      location: `${circuit.Location.locality}, ${circuit.Location.country}`,
      coordinates: {
        lat: Number.parseFloat(circuit.Location.lat),
        lng: Number.parseFloat(circuit.Location.long),
      },
      url: circuit.url,
      fastestLap,
    };
  }
}

export default new JolpicaService();
