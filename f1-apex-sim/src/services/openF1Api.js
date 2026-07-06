import { buildUrl, fetchJson, sleep } from './httpClient';
import { buildGeometryFromPointArrays } from '../utils/trackGeometry';

const BASE_URL = 'https://api.openf1.org/v1/';
const OPENF1_FIRST_YEAR = 2023;
const HISTORICAL_WINDOW_DELAY_MS = 30 * 60 * 1000;

const normalizeCircuitNames = (openF1Config = {}) => {
  const names = openF1Config.circuitShortNames ?? openF1Config.circuitShortName ?? [];
  return Array.isArray(names) ? names : [names];
};

const isHistoricalSession = (session, nowMs = Date.now()) => {
  if (!session?.date_end) return false;
  return Date.parse(session.date_end) + HISTORICAL_WINDOW_DELAY_MS < nowMs;
};

class OpenF1Service {
  request(endpoint, params = {}, options = {}) {
    return fetchJson(buildUrl(BASE_URL, endpoint, params), options);
  }

  getMeetings(params = {}, options = {}) {
    return this.request('meetings', params, options);
  }

  getSessions(params = {}, options = {}) {
    return this.request('sessions', params, options);
  }

  getDrivers(sessionKey, options = {}) {
    return this.request('drivers', { session_key: sessionKey }, options);
  }

  getLaps(sessionKey, driverNumber = null, options = {}) {
    return this.request('laps', {
      session_key: sessionKey,
      driver_number: driverNumber,
    }, options);
  }

  getCarData(sessionKey, { driverNumber, dateStart, dateEnd } = {}, options = {}) {
    return this.request('car_data', {
      session_key: sessionKey,
      driver_number: driverNumber,
      'date>=': dateStart,
      'date<=': dateEnd,
    }, options);
  }

  getLocationData(sessionKey, { driverNumber, dateStart, dateEnd } = {}, options = {}) {
    return this.request('location', {
      session_key: sessionKey,
      driver_number: driverNumber,
      'date>=': dateStart,
      'date<=': dateEnd,
    }, options);
  }

  getRacePositionData(sessionKey, driverNumber = null, options = {}) {
    return this.request('position', {
      session_key: sessionKey,
      driver_number: driverNumber,
    }, options);
  }

  // Backwards-compatible alias. This endpoint is race order, not GPS/location.
  getPositionData(sessionKey, driverNumber = null, options = {}) {
    return this.getRacePositionData(sessionKey, driverNumber, options);
  }

  async getRaceSession(year, circuitShortName, options = {}) {
    const sessions = await this.getSessions({
      year,
      circuit_short_name: circuitShortName,
      session_name: 'Race',
    }, options);

    return sessions?.find((session) => session.session_name === 'Race') ?? null;
  }

  async getCircuitGeometry(circuitInfoUrl, options = {}) {
    if (!circuitInfoUrl) return null;

    const data = await fetchJson(circuitInfoUrl, options);
    if (!Array.isArray(data.x) || !Array.isArray(data.y)) return null;

    return buildGeometryFromPointArrays(data.x, data.y, {
      source: 'multiviewer',
      coordinateSpace: 'liveTiming',
      rotation: data.rotation,
      corners: data.corners ?? [],
      marshalLights: data.marshalLights ?? [],
      marshalSectors: data.marshalSectors ?? [],
    });
  }

  async findLatestCompletedRaceSession(openF1Config = {}, options = {}) {
    const circuitNames = normalizeCircuitNames(openF1Config)
      .filter(Boolean)
      .map((name) => name.toLowerCase());

    if (circuitNames.length === 0) return null;

    const nowMs = options.nowMs ?? Date.now();
    const fromYear = options.fromYear ?? new Date(nowMs).getUTCFullYear();

    for (let year = fromYear; year >= OPENF1_FIRST_YEAR; year -= 1) {
      const meetings = await this.getMeetings({ year }, options);
      const candidates = meetings
        .filter((meeting) => {
          const circuitName = meeting.circuit_short_name?.toLowerCase();
          return circuitNames.includes(circuitName) && Date.parse(meeting.date_end) < nowMs;
        })
        .sort((a, b) => Date.parse(b.date_end) - Date.parse(a.date_end));

      for (const meeting of candidates) {
        const sessions = await this.getSessions({ meeting_key: meeting.meeting_key }, options);
        const raceSession = sessions
          .filter((session) => session.session_name === 'Race')
          .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start))[0];

        if (isHistoricalSession(raceSession, nowMs)) {
          return { meeting, session: raceSession };
        }
      }
    }

    return null;
  }

  // Lightweight: resolves the latest completed race meeting and fetches only the
  // circuit outline geometry (no per-driver location data).
  async getCircuitOutline(openF1Config = {}, options = {}) {
    const match = await this.findLatestCompletedRaceSession(openF1Config, options);
    if (!match) return null;

    const geometry = await this.getCircuitGeometry(match.meeting.circuit_info_url, options);
    if (!geometry) return null;

    return {
      meeting: match.meeting,
      session: match.session,
      geometry,
    };
  }

  async getReplayPackage(openF1Config = {}, {
    driverLimit = 8,
    replayWindowMs = 2 * 60 * 1000,
    signal,
  } = {}) {
    const match = await this.findLatestCompletedRaceSession(openF1Config, { signal });
    if (!match) return null;

    const { meeting, session } = match;
    const drivers = await this.getDrivers(session.session_key, { signal });
    const selectedDrivers = drivers
      .filter((driver) => driver.driver_number)
      .slice(0, driverLimit);

    const windowStartMs = Date.parse(session.date_start);
    const windowEndMs = Math.min(Date.parse(session.date_end), windowStartMs + replayWindowMs);
    const dateStart = new Date(windowStartMs).toISOString();
    const dateEnd = new Date(windowEndMs).toISOString();

    const locationByDriver = {};
    for (const driver of selectedDrivers) {
      locationByDriver[driver.driver_number] = await this.getLocationData(session.session_key, {
        driverNumber: driver.driver_number,
        dateStart,
        dateEnd,
      }, { signal });

      // OpenF1's public tier is generous but still rate-limited.
      await sleep(350);
    }

    const circuitGeometry = await this.getCircuitGeometry(meeting.circuit_info_url, { signal });

    return {
      meeting,
      session,
      drivers: selectedDrivers,
      locationByDriver,
      circuitGeometry,
      window: {
        start: dateStart,
        end: dateEnd,
        durationMs: windowEndMs - windowStartMs,
      },
    };
  }

  async getTelemetryPackage(year, circuitShortName, driverNumber = 1, options = {}) {
    const session = await this.getRaceSession(year, circuitShortName, options);
    if (!session) return null;

    const [carData, locationData, laps, drivers] = await Promise.all([
      this.getCarData(session.session_key, { driverNumber }, options),
      this.getLocationData(session.session_key, { driverNumber }, options),
      this.getLaps(session.session_key, driverNumber, options),
      this.getDrivers(session.session_key, options),
    ]);

    return {
      session,
      carData: carData ?? [],
      locationData: locationData ?? [],
      laps: laps ?? [],
      drivers: drivers ?? [],
      metadata: {
        year,
        circuit: circuitShortName,
        driverNumber,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

export default new OpenF1Service();
