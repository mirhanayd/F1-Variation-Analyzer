import { EventEmitter } from 'node:events';

const MAX_MESSAGES = 60;
const MAX_DEDUPLICATION_KEYS = 30_000;
const DEDUPLICATION_TTL_MS = 2 * 60 * 1_000;

const isoNow = (now) => new Date(now()).toISOString();
const driverKey = (record) => {
  const value = record?.driver_number ?? record?.driverNumber;
  return value === undefined || value === null ? null : String(value);
};
const parseTime = (record) => {
  const value = record?.date ?? record?.date_start ?? record?.updatedAt;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const color = (value) => {
  if (!value) return null;
  return String(value).startsWith('#') ? String(value) : `#${value}`;
};

const emptySnapshot = (now) => ({
  source: 'offline-demo',
  status: 'idle',
  meetingKey: null,
  meetingName: null,
  sessionKey: null,
  sessionName: null,
  circuitKey: null,
  circuitShortName: null,
  updatedAt: isoNow(now),
  latencyMs: null,
  driversByNumber: {},
  locationsByDriver: {},
  carDataByDriver: {},
  positionsByDriver: {},
  intervalsByDriver: {},
  lapsByDriver: {},
  weather: null,
  projection: {
    circuitId: null,
    calibrated: false,
    transform: null,
    updatedAt: null,
  },
  messages: [],
});

const normalizeDriver = (record, updatedAt) => ({
  driverNumber: Number(record.driver_number ?? record.driverNumber),
  broadcastName: record.broadcast_name ?? record.broadcastName ?? null,
  firstName: record.first_name ?? record.firstName ?? null,
  lastName: record.last_name ?? record.lastName ?? null,
  fullName: record.full_name ?? record.fullName ?? null,
  acronym: record.name_acronym ?? record.acronym ?? null,
  teamName: record.team_name ?? record.teamName ?? null,
  teamColor: color(record.team_colour ?? record.teamColor),
  headshotUrl: record.headshot_url ?? record.headshotUrl ?? null,
  countryCode: record.country_code ?? record.countryCode ?? null,
  meetingKey: record.meeting_key ?? record.meetingKey ?? null,
  sessionKey: record.session_key ?? record.sessionKey ?? null,
  updatedAt,
});

const normalizeLocation = (record, updatedAt, projected) => ({
  driverNumber: Number(record.driver_number ?? record.driverNumber),
  x: Number(record.x),
  y: Number(record.y),
  z: Number(record.z ?? 0),
  date: record.date ?? null,
  timeMs: parseTime(record),
  meetingKey: record.meeting_key ?? record.meetingKey ?? null,
  sessionKey: record.session_key ?? record.sessionKey ?? null,
  projected,
  stale: false,
  updatedAt,
});

const normalizeCarData = (record, updatedAt) => ({
  driverNumber: Number(record.driver_number ?? record.driverNumber),
  speed: Number(record.speed ?? 0),
  throttle: Number(record.throttle ?? 0),
  brake: Boolean(record.brake),
  gear: Number(record.n_gear ?? record.gear ?? 0),
  rpm: Number(record.rpm ?? 0),
  drs: Number(record.drs ?? 0),
  date: record.date ?? null,
  timeMs: parseTime(record),
  meetingKey: record.meeting_key ?? record.meetingKey ?? null,
  sessionKey: record.session_key ?? record.sessionKey ?? null,
  updatedAt,
});

const normalizePosition = (record, updatedAt) => ({
  driverNumber: Number(record.driver_number ?? record.driverNumber),
  position: Number(record.position),
  date: record.date ?? null,
  timeMs: parseTime(record),
  meetingKey: record.meeting_key ?? record.meetingKey ?? null,
  sessionKey: record.session_key ?? record.sessionKey ?? null,
  updatedAt,
});

const normalizeInterval = (record, updatedAt) => ({
  driverNumber: Number(record.driver_number ?? record.driverNumber),
  gapToLeader: record.gap_to_leader ?? record.gapToLeader ?? null,
  intervalToAhead: record.interval ?? record.intervalToAhead ?? null,
  date: record.date ?? null,
  timeMs: parseTime(record),
  meetingKey: record.meeting_key ?? record.meetingKey ?? null,
  sessionKey: record.session_key ?? record.sessionKey ?? null,
  updatedAt,
});

const normalizeLap = (record, updatedAt) => ({
  driverNumber: Number(record.driver_number ?? record.driverNumber),
  lapNumber: Number(record.lap_number ?? record.lapNumber),
  lapDuration: record.lap_duration ?? record.lapDuration ?? null,
  sector1: record.duration_sector_1 ?? record.sector1 ?? null,
  sector2: record.duration_sector_2 ?? record.sector2 ?? null,
  sector3: record.duration_sector_3 ?? record.sector3 ?? null,
  segmentsSector1: record.segments_sector_1 ?? record.segmentsSector1 ?? [],
  segmentsSector2: record.segments_sector_2 ?? record.segmentsSector2 ?? [],
  segmentsSector3: record.segments_sector_3 ?? record.segmentsSector3 ?? [],
  speedI1: record.i1_speed ?? record.speedI1 ?? null,
  speedI2: record.i2_speed ?? record.speedI2 ?? null,
  speedSt: record.st_speed ?? record.speedSt ?? null,
  isPitOutLap: Boolean(record.is_pit_out_lap ?? record.isPitOutLap),
  date: record.date_start ?? record.date ?? null,
  timeMs: parseTime(record),
  meetingKey: record.meeting_key ?? record.meetingKey ?? null,
  sessionKey: record.session_key ?? record.sessionKey ?? null,
  updatedAt,
});

export class LiveStateStore extends EventEmitter {
  constructor({ now = () => Date.now(), staleDriverMs = 10_000, projectionService = null } = {}) {
    super();
    this.now = now;
    this.staleDriverMs = staleDriverMs;
    this.projectionService = projectionService;
    this.snapshot = emptySnapshot(now);
    this.seen = new Map();
  }

  beginLive(message = null) {
    if (this.snapshot.source !== 'openf1-live') {
      this.snapshot = {
        ...emptySnapshot(this.now),
        source: 'openf1-live',
        status: 'live',
      };
      // Never project a newly-live session onto stale replay metadata. Session
      // and meeting topics establish the real circuit before markers are
      // overlaid by the frontend.
      this.seen.clear();
      this.projectionService?.clearDriverState();
    } else {
      this.snapshot.status = 'live';
    }
    if (message) this.#appendMessage('gateway', message, 'info');
    this.#touch('source');
  }

  beginReplay({
    meeting = null,
    session = null,
    message = null,
    source = 'openf1-historical-replay',
  } = {}) {
    const replaySource = source === 'fastf1-generated-replay'
      ? 'fastf1-generated-replay'
      : 'openf1-historical-replay';
    this.snapshot = {
      ...emptySnapshot(this.now),
      source: replaySource,
      status: 'replay',
    };
    this.seen.clear();
    this.projectionService?.clearDriverState();
    if (meeting) this.#applyMeeting(meeting);
    if (session) this.#applySession(session);
    if (message) this.#appendMessage('gateway', message, 'info');
    this.#touch('source');
  }

  setUnavailable(message, { error = false } = {}) {
    this.snapshot.source = 'offline-demo';
    this.snapshot.status = error ? 'error' : 'idle';
    this.#appendMessage('gateway', message, error ? 'error' : 'warning');
    this.#touch('status');
  }

  setConnectionStatus(status, message = null) {
    if (this.snapshot.status !== 'replay') this.snapshot.status = status;
    if (message) this.#appendMessage('gateway', message, 'info');
    this.#touch('status');
  }

  apply(topic, record, { receivedAt = this.now(), replay = false } = {}) {
    if (!record || typeof record !== 'object' || this.#isDuplicate(topic, record, receivedAt)) {
      return false;
    }

    this.#updateCommonMetadata(record);
    const updatedAt = new Date(receivedAt).toISOString();
    const key = driverKey(record);
    let changed = true;

    switch (topic) {
      case 'v1/drivers':
        if (!key) return false;
        this.snapshot.driversByNumber[key] = normalizeDriver(record, updatedAt);
        break;
      case 'v1/location': {
        if (!key || !Number.isFinite(Number(record.x)) || !Number.isFinite(Number(record.y))) return false;
        const timeMs = parseTime(record) ?? receivedAt;
        const circuitId = this.snapshot.circuitShortName
          ?? this.snapshot.circuitKey
          ?? this.snapshot.meetingKey
          ?? this.snapshot.sessionKey;
        const projected = this.projectionService?.project(circuitId, record, {
          driverNumber: key,
          timestamp: timeMs,
        }) ?? null;
        changed = this.#replaceLatest(
          this.snapshot.locationsByDriver,
          key,
          normalizeLocation(record, updatedAt, projected),
        );
        if (projected && circuitId) {
          this.snapshot.projection = {
            ...this.projectionService.getMetadata(circuitId),
            updatedAt,
          };
        }
        break;
      }
      case 'v1/car_data':
        if (!key) return false;
        changed = this.#replaceLatest(
          this.snapshot.carDataByDriver,
          key,
          normalizeCarData(record, updatedAt),
        );
        break;
      case 'v1/position':
        if (!key) return false;
        changed = this.#replaceLatest(
          this.snapshot.positionsByDriver,
          key,
          normalizePosition(record, updatedAt),
        );
        break;
      case 'v1/intervals':
        if (!key) return false;
        changed = this.#replaceLatest(
          this.snapshot.intervalsByDriver,
          key,
          normalizeInterval(record, updatedAt),
        );
        break;
      case 'v1/laps':
        if (!key) return false;
        changed = this.#replaceLatest(
          this.snapshot.lapsByDriver,
          key,
          normalizeLap(record, updatedAt),
        );
        break;
      case 'v1/sessions':
        this.#applySession(record);
        break;
      case 'v1/meetings':
        this.#applyMeeting(record);
        break;
      case 'v1/race_control':
        this.#appendMessage('race-control', record.message ?? record.category ?? 'Race control update', 'info', record);
        break;
      case 'v1/weather':
        this.snapshot.weather = { ...record, updatedAt };
        break;
      default:
        return false;
    }

    if (!changed) return false;
    this.snapshot.updatedAt = updatedAt;
    const eventTime = parseTime(record);
    this.snapshot.latencyMs = !replay && eventTime !== null
      ? Math.max(0, receivedAt - eventTime)
      : null;
    this.emit('update', { topic, snapshot: this.snapshot });
    return true;
  }

  applyMany(topic, records, options = {}) {
    let changes = 0;
    for (const record of records || []) {
      if (this.apply(topic, record, options)) changes += 1;
    }
    return changes;
  }

  getSnapshot() {
    const now = this.now();
    const locationsByDriver = Object.fromEntries(
      Object.entries(this.snapshot.locationsByDriver).map(([key, location]) => [key, {
        ...location,
        stale: now - Date.parse(location.updatedAt) > this.staleDriverMs,
      }]),
    );
    return {
      ...this.snapshot,
      locationsByDriver,
      driversByNumber: { ...this.snapshot.driversByNumber },
      carDataByDriver: { ...this.snapshot.carDataByDriver },
      positionsByDriver: { ...this.snapshot.positionsByDriver },
      intervalsByDriver: { ...this.snapshot.intervalsByDriver },
      lapsByDriver: { ...this.snapshot.lapsByDriver },
      messages: [...this.snapshot.messages],
    };
  }

  #replaceLatest(collection, key, value) {
    const previous = collection[key];
    if (
      previous?.timeMs !== null
      && value.timeMs !== null
      && previous?.timeMs !== undefined
      && value.timeMs < previous.timeMs
    ) return false;
    collection[key] = value;
    return true;
  }

  #updateCommonMetadata(record) {
    this.snapshot.meetingKey = record.meeting_key ?? record.meetingKey ?? this.snapshot.meetingKey;
    this.snapshot.sessionKey = record.session_key ?? record.sessionKey ?? this.snapshot.sessionKey;
  }

  #applySession(session) {
    this.snapshot.sessionKey = session.session_key ?? session.sessionKey ?? this.snapshot.sessionKey;
    this.snapshot.sessionName = session.session_name
      ?? session.sessionName
      ?? session.name
      ?? this.snapshot.sessionName;
    this.snapshot.meetingKey = session.meeting_key ?? session.meetingKey ?? this.snapshot.meetingKey;
    this.snapshot.circuitKey = session.circuit_key ?? session.circuitKey ?? this.snapshot.circuitKey;
    this.snapshot.circuitShortName = session.circuit_short_name
      ?? session.circuitShortName
      ?? session.circuitName
      ?? this.snapshot.circuitShortName;
    this.snapshot.meetingName = session.meeting_name
      ?? session.meetingName
      ?? this.snapshot.meetingName;
  }

  #applyMeeting(meeting) {
    this.snapshot.meetingKey = meeting.meeting_key ?? meeting.meetingKey ?? this.snapshot.meetingKey;
    this.snapshot.meetingName = meeting.meeting_name
      ?? meeting.meetingName
      ?? meeting.location
      ?? this.snapshot.meetingName;
    this.snapshot.circuitKey = meeting.circuit_key ?? meeting.circuitKey ?? this.snapshot.circuitKey;
    this.snapshot.circuitShortName = meeting.circuit_short_name
      ?? meeting.circuitShortName
      ?? this.snapshot.circuitShortName;
  }

  #appendMessage(type, text, level = 'info', data = null) {
    this.snapshot.messages.push({
      id: `${this.now()}-${this.snapshot.messages.length}`,
      type,
      level,
      text: String(text),
      date: isoNow(this.now),
      data,
    });
    if (this.snapshot.messages.length > MAX_MESSAGES) this.snapshot.messages.shift();
  }

  #touch(reason) {
    this.snapshot.updatedAt = isoNow(this.now);
    this.emit('update', { topic: `gateway/${reason}`, snapshot: this.snapshot });
  }

  #isDuplicate(topic, record, receivedAt) {
    // Sponsor live messages carry an ever-increasing `_id`. It identifies an
    // exact delivery, while `_key` can intentionally remain stable as a lap or
    // timing record gains sector values. Prefer `_id` so a legitimate update
    // is never mistaken for a duplicate.
    const fingerprint = [
      topic,
      record._id ?? '',
      record._key ?? '',
      record.session_key ?? record.sessionKey ?? '',
      record.meeting_key ?? record.meetingKey ?? '',
      record.driver_number ?? record.driverNumber ?? '',
      record.date ?? record.date_start ?? '',
      record.lap_number ?? record.lapNumber ?? '',
      record.position ?? '',
      record.x ?? '',
      record.y ?? '',
      record.speed ?? '',
      record.gap_to_leader ?? record.gapToLeader ?? '',
      record.interval ?? record.intervalToAhead ?? '',
      record.lap_duration ?? record.lapDuration ?? '',
      record.duration_sector_1 ?? record.sector1 ?? '',
      record.duration_sector_2 ?? record.sector2 ?? '',
      record.duration_sector_3 ?? record.sector3 ?? '',
      record.message ?? '',
    ].join('|');
    const previous = this.seen.get(fingerprint);
    if (previous !== undefined && receivedAt - previous <= DEDUPLICATION_TTL_MS) return true;
    this.seen.set(fingerprint, receivedAt);

    if (this.seen.size > MAX_DEDUPLICATION_KEYS) {
      const cutoff = receivedAt - DEDUPLICATION_TTL_MS;
      for (const [key, timestamp] of this.seen) {
        if (timestamp < cutoff || this.seen.size > MAX_DEDUPLICATION_KEYS) this.seen.delete(key);
        if (this.seen.size <= MAX_DEDUPLICATION_KEYS * 0.8) break;
      }
    }
    return false;
  }
}
