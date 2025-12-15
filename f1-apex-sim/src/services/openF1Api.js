/**
 * OpenF1 API Service
 * https://openf1.org/
 * Real-time F1 telemetry data (2023+)
 */

const BASE_URL = 'https://api.openf1.org/v1';

class OpenF1Service {
  /**
   * Get all sessions for a specific year and circuit
   */
  async getSessions(year, circuitShortName) {
    try {
      const response = await fetch(
        `${BASE_URL}/sessions?year=${year}&circuit_short_name=${circuitShortName}`
      );
      return await response.json();
    } catch (error) {
      console.error('OpenF1 getSessions error:', error);
      return null;
    }
  }

  /**
   * Get race session for a specific circuit and year
   */
  async getRaceSession(year, circuitShortName) {
    try {
      const sessions = await this.getSessions(year, circuitShortName);
      if (!sessions || sessions.length === 0) return null;
      
      // Find the race session
      return sessions.find(s => s.session_name === 'Race') || sessions[0];
    } catch (error) {
      console.error('OpenF1 getRaceSession error:', error);
      return null;
    }
  }

  /**
   * Get car telemetry data for a specific session and driver
   */
  async getCarData(sessionKey, driverNumber) {
    try {
      const response = await fetch(
        `${BASE_URL}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`
      );
      return await response.json();
    } catch (error) {
      console.error('OpenF1 getCarData error:', error);
      return null;
    }
  }

  /**
   * Get car position data (GPS coordinates)
   */
  async getPositionData(sessionKey, driverNumber = null) {
    try {
      let url = `${BASE_URL}/position?session_key=${sessionKey}`;
      if (driverNumber) {
        url += `&driver_number=${driverNumber}`;
      }
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('OpenF1 getPositionData error:', error);
      return null;
    }
  }

  /**
   * Get lap data for a specific session
   */
  async getLaps(sessionKey, driverNumber = null) {
    try {
      let url = `${BASE_URL}/laps?session_key=${sessionKey}`;
      if (driverNumber) {
        url += `&driver_number=${driverNumber}`;
      }
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('OpenF1 getLaps error:', error);
      return null;
    }
  }

  /**
   * Get driver list for a session
   */
  async getDrivers(sessionKey) {
    try {
      const response = await fetch(
        `${BASE_URL}/drivers?session_key=${sessionKey}`
      );
      return await response.json();
    } catch (error) {
      console.error('OpenF1 getDrivers error:', error);
      return null;
    }
  }

  /**
   * Get complete telemetry package for simulation
   * Combines car data, position, and lap data
   */
  async getTelemetryPackage(year, circuitShortName, driverNumber = 1) {
    try {
      // Get session info
      const session = await this.getRaceSession(year, circuitShortName);
      if (!session) {
        console.warn(`No session found for ${circuitShortName} ${year}`);
        return null;
      }

      const sessionKey = session.session_key;

      // Fetch all data in parallel
      const [carData, positionData, laps, drivers] = await Promise.all([
        this.getCarData(sessionKey, driverNumber),
        this.getPositionData(sessionKey, driverNumber),
        this.getLaps(sessionKey, driverNumber),
        this.getDrivers(sessionKey)
      ]);

      return {
        session,
        carData: carData || [],
        positionData: positionData || [],
        laps: laps || [],
        drivers: drivers || [],
        metadata: {
          year,
          circuit: circuitShortName,
          driverNumber,
          fetchedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('OpenF1 getTelemetryPackage error:', error);
      return null;
    }
  }
}

export default new OpenF1Service();
