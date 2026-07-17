import backendApi from './backendApi';

const getRaces = (data) => data?.MRData?.RaceTable?.Races ?? [];
const getCircuits = (data) => data?.MRData?.CircuitTable?.Circuits ?? [];

class JolpicaService {
  request(path = '', params = {}, options = {}) {
    return backendApi.jolpica(path, params, options);
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
