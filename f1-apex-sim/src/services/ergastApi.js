/**
 * Ergast F1 API Service
 * http://ergast.com/mrd/
 * Historical F1 data (1950-2024)
 */

const BASE_URL = 'https://ergast.com/api/f1';

class ErgastService {
  /**
   * Get circuit information
   */
  async getCircuit(circuitId) {
    try {
      const response = await fetch(
        `${BASE_URL}/circuits/${circuitId}.json`
      );
      const data = await response.json();
      return data.MRData.CircuitTable.Circuits[0] || null;
    } catch (error) {
      console.error('Ergast getCircuit error:', error);
      return null;
    }
  }

  /**
   * Get race results for a specific year and circuit
   */
  async getRaceResults(year, circuitId) {
    try {
      const response = await fetch(
        `${BASE_URL}/${year}/circuits/${circuitId}/results.json`
      );
      const data = await response.json();
      return data.MRData.RaceTable.Races[0] || null;
    } catch (error) {
      console.error('Ergast getRaceResults error:', error);
      return null;
    }
  }

  /**
   * Get qualifying results
   */
  async getQualifying(year, circuitId) {
    try {
      const response = await fetch(
        `${BASE_URL}/${year}/circuits/${circuitId}/qualifying.json`
      );
      const data = await response.json();
      return data.MRData.RaceTable.Races[0] || null;
    } catch (error) {
      console.error('Ergast getQualifying error:', error);
      return null;
    }
  }

  /**
   * Get lap times for a specific race
   */
  async getLapTimes(year, round, lap = 1) {
    try {
      const response = await fetch(
        `${BASE_URL}/${year}/${round}/laps/${lap}.json?limit=100`
      );
      const data = await response.json();
      return data.MRData.RaceTable.Races[0]?.Laps || [];
    } catch (error) {
      console.error('Ergast getLapTimes error:', error);
      return [];
    }
  }

  /**
   * Get fastest lap for a circuit
   */
  async getFastestLap(circuitId) {
    try {
      const response = await fetch(
        `${BASE_URL}/circuits/${circuitId}/fastest/1/results.json`
      );
      const data = await response.json();
      const race = data.MRData.RaceTable.Races[0];
      if (!race) return null;
      
      return {
        time: race.Results[0].FastestLap.Time.time,
        driver: `${race.Results[0].Driver.givenName} ${race.Results[0].Driver.familyName}`,
        year: race.season,
        circuit: race.Circuit.circuitName
      };
    } catch (error) {
      console.error('Ergast getFastestLap error:', error);
      return null;
    }
  }

  /**
   * Get all circuits
   */
  async getAllCircuits() {
    try {
      const response = await fetch(`${BASE_URL}/circuits.json?limit=100`);
      const data = await response.json();
      return data.MRData.CircuitTable.Circuits || [];
    } catch (error) {
      console.error('Ergast getAllCircuits error:', error);
      return [];
    }
  }

  /**
   * Get circuit stats (races held, first GP, etc.)
   */
  async getCircuitStats(circuitId) {
    try {
      const [circuit, fastestLap] = await Promise.all([
        this.getCircuit(circuitId),
        this.getFastestLap(circuitId)
      ]);

      if (!circuit) return null;

      return {
        id: circuit.circuitId,
        name: circuit.circuitName,
        location: `${circuit.Location.locality}, ${circuit.Location.country}`,
        coordinates: {
          lat: parseFloat(circuit.Location.lat),
          lng: parseFloat(circuit.Location.long)
        },
        url: circuit.url,
        fastestLap: fastestLap
      };
    } catch (error) {
      console.error('Ergast getCircuitStats error:', error);
      return null;
    }
  }
}

export default new ErgastService();
