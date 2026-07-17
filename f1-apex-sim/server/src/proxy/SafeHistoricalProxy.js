const OPENF1_FIELDS = Object.freeze({
  meetings: ['meeting_key', 'circuit_key', 'circuit_short_name', 'meeting_name', 'country_name', 'country_code', 'location', 'year', 'date_start', 'date_end'],
  sessions: ['session_key', 'meeting_key', 'circuit_key', 'circuit_short_name', 'country_name', 'country_code', 'location', 'year', 'session_name', 'session_type', 'date_start', 'date_end'],
  drivers: ['driver_number', 'meeting_key', 'session_key', 'broadcast_name', 'first_name', 'last_name', 'full_name', 'name_acronym', 'team_name', 'team_colour', 'headshot_url', 'country_code'],
  location: ['driver_number', 'meeting_key', 'session_key', 'date', 'x', 'y', 'z'],
  car_data: ['driver_number', 'meeting_key', 'session_key', 'date', 'speed', 'rpm', 'n_gear', 'throttle', 'brake', 'drs'],
  position: ['driver_number', 'meeting_key', 'session_key', 'date', 'position'],
  intervals: ['driver_number', 'meeting_key', 'session_key', 'date', 'gap_to_leader', 'interval'],
  laps: ['driver_number', 'meeting_key', 'session_key', 'date_start', 'lap_number', 'lap_duration', 'duration_sector_1', 'duration_sector_2', 'duration_sector_3', 'is_pit_out_lap', 'i1_speed', 'i2_speed', 'st_speed'],
  race_control: ['driver_number', 'meeting_key', 'session_key', 'date', 'lap_number', 'category', 'flag', 'message', 'scope', 'sector'],
  weather: ['meeting_key', 'session_key', 'date', 'air_temperature', 'humidity', 'pressure', 'rainfall', 'track_temperature', 'wind_direction', 'wind_speed'],
});

const JOLPICA_PATHS = Object.freeze([
  /^(?:current|\d{4})\.json$/,
  /^circuits\.json$/,
  /^circuits\/[a-zA-Z0-9_-]+\.json$/,
  /^(?:current|\d{4})\/circuits\/[a-zA-Z0-9_-]+\/(?:results|qualifying)\.json$/,
  /^circuits\/[a-zA-Z0-9_-]+\/(?:results|qualifying)\.json$/,
  /^(?:current|\d{4})\/\d{1,2}\/laps\/\d+\.json$/,
  /^circuits\/[a-zA-Z0-9_-]+\/fastest\/\d+\/results\.json$/,
]);

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;

export class SafeProxyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'SafeProxyError';
    this.status = status;
  }
}

const valuesOf = (value) => (Array.isArray(value) ? value : [value]);

const validateValue = (value) => {
  const stringValue = String(value);
  const hasControlCharacter = [...stringValue].some((character) => character.charCodeAt(0) <= 31);
  if (stringValue.length > 200 || hasControlCharacter) {
    throw new SafeProxyError('Invalid upstream query value');
  }
  return stringValue;
};

export class SafeHistoricalProxy {
  constructor({
    openF1ApiUrl,
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    jolpicaApiUrl = 'https://api.jolpi.ca/ergast/f1',
  }) {
    this.openF1ApiUrl = openF1ApiUrl.replace(/\/$/, '');
    this.jolpicaApiUrl = jolpicaApiUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.cache = new Map();
    this.cacheBytes = 0;
  }

  getAllowedOpenF1Endpoints() {
    return Object.keys(OPENF1_FIELDS);
  }

  async fetchOpenF1(endpoint, rawQuery = {}) {
    const allowedFields = OPENF1_FIELDS[endpoint];
    if (!allowedFields) throw new SafeProxyError('OpenF1 endpoint is not allowed', 404);
    const entries = Object.entries(rawQuery);
    if (entries.length > 30) throw new SafeProxyError('Too many OpenF1 filters');

    const url = new URL(`${this.openF1ApiUrl}/${endpoint}`);
    for (const [rawKey, rawValue] of entries) {
      const match = /^([a-z0-9_]+)(>=|<=|>|<)?$/i.exec(rawKey);
      if (!match || !allowedFields.includes(match[1])) {
        throw new SafeProxyError(`OpenF1 filter is not allowed: ${rawKey}`);
      }
      const values = valuesOf(rawValue);
      if (values.length > 5) throw new SafeProxyError('Too many values for an OpenF1 filter');
      for (const value of values) url.searchParams.append(rawKey, validateValue(value));
    }
    return this.#fetchJson(url, 30_000);
  }

  async fetchJolpica(rawPath, rawQuery = {}) {
    const normalizedPath = String(rawPath).replace(/^\/+/, '');
    if (
      normalizedPath.length > 240
      || normalizedPath.includes('..')
      || !JOLPICA_PATHS.some((pattern) => pattern.test(normalizedPath))
    ) {
      throw new SafeProxyError('Jolpica path is not allowed', 404);
    }

    const url = new URL(`${this.jolpicaApiUrl}/${normalizedPath}`);
    for (const [key, rawValue] of Object.entries(rawQuery)) {
      if (!['limit', 'offset'].includes(key)) {
        throw new SafeProxyError(`Jolpica query parameter is not allowed: ${key}`);
      }
      const value = Number(rawValue);
      if (!Number.isInteger(value) || value < 0) throw new SafeProxyError(`Invalid Jolpica ${key}`);
      if (key === 'limit' && value > 1_000) throw new SafeProxyError('Jolpica limit is too large');
      if (key === 'offset' && value > 100_000) throw new SafeProxyError('Jolpica offset is too large');
      url.searchParams.set(key, String(value));
    }
    return this.#fetchJson(url, 15 * 60_000);
  }

  async #fetchJson(url, cacheTtlMs) {
    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && this.now() - cached.cachedAt < cacheTtlMs) {
      // Refresh insertion order to make the bounded map a small LRU cache.
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.value;
    }
    if (cached) {
      this.cache.delete(cacheKey);
      this.cacheBytes -= cached.bytes;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    timeout.unref?.();
    let response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      throw new SafeProxyError('Historical data upstream is unavailable', 502, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new SafeProxyError('Historical data upstream rejected the request', response.status);
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new SafeProxyError('Historical response is too large', 502);
    }
    const text = await response.text();
    const responseBytes = Buffer.byteLength(text);
    if (responseBytes > MAX_RESPONSE_BYTES) {
      throw new SafeProxyError('Historical response is too large', 502);
    }
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new SafeProxyError('Historical upstream returned invalid JSON', 502);
    }
    // Large telemetry windows can legitimately be returned, but retaining many
    // parsed copies would make the public read-only proxy an easy memory-DoS
    // target. Oversized entries are streamed back without being cached.
    if (responseBytes <= MAX_CACHE_ENTRY_BYTES) {
      this.cache.set(cacheKey, { cachedAt: this.now(), value, bytes: responseBytes });
      this.cacheBytes += responseBytes;
      while (this.cache.size > MAX_CACHE_ENTRIES || this.cacheBytes > MAX_CACHE_BYTES) {
        const oldestKey = this.cache.keys().next().value;
        const oldest = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        this.cacheBytes -= oldest?.bytes ?? 0;
      }
    }
    return value;
  }
}

export { JOLPICA_PATHS, OPENF1_FIELDS };
