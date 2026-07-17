import { EventEmitter } from 'node:events';

const array = (value) => (Array.isArray(value) ? value : []);
const eventTime = (record) => {
  const parsed = Date.parse(record?.date ?? record?.date_start ?? record?.updatedAt);
  return Number.isFinite(parsed) ? parsed : null;
};
const flattenLocationMap = (value) => (
  value && !Array.isArray(value)
    ? Object.values(value).flatMap((records) => array(records))
    : []
);
const flattenSampleMap = (value) => (
  value && !Array.isArray(value)
    ? Object.entries(value).flatMap(([driverNumber, records]) => (
      array(records).map((record) => ({ ...record, driverNumber: Number(driverNumber) }))
    ))
    : []
);
const driversOf = (replay) => (
  Array.isArray(replay?.drivers)
    ? replay.drivers
    : Object.values(replay?.driversByNumber ?? {})
);

const topicRecords = (replay) => [
  ['v1/location', [
    ...array(replay.location),
    ...array(replay.locations),
    ...array(replay.locationData),
    ...flattenLocationMap(replay.locationByDriver),
  ]],
  ['v1/car_data', [...array(replay.carData), ...array(replay.car_data)]],
  ['v1/position', [...array(replay.position), ...array(replay.positions)]],
  ['v1/intervals', array(replay.intervals)],
  ['v1/laps', array(replay.laps)],
  ['v1/race_control', [...array(replay.raceControl), ...array(replay.race_control)]],
  ['v1/weather', array(replay.weather)],
  ['fastf1/sample', flattenSampleMap(replay.samplesByDriver)],
];

export class ReplayPlayer extends EventEmitter {
  constructor(service, store, { speed = 4, now = () => Date.now(), tickMs = 100 } = {}) {
    super();
    this.service = service;
    this.store = store;
    this.speed = speed;
    this.now = now;
    this.tickMs = tickMs;
    this.timer = null;
    this.loading = null;
    this.running = false;
    this.replay = null;
    this.events = [];
    this.immediate = [];
    this.cursor = 0;
    this.replayStartMs = 0;
    this.wallStartMs = 0;
  }

  isRunning() {
    return this.running;
  }

  async startLatest(options = {}) {
    if (this.loading) return this.loading;
    this.loading = this.service.getLatestReplay(options)
      .then((replay) => (replay ? this.start(replay) : false))
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  start(replay) {
    this.stop();
    this.replay = replay;
    const all = topicRecords(replay)
      .flatMap(([topic, records]) => records.map((data) => ({ topic, data, timeMs: eventTime(data) })));
    this.events = all.filter((event) => event.timeMs !== null).sort((a, b) => a.timeMs - b.timeMs);
    this.immediate = all.filter((event) => event.timeMs === null);
    this.#resetLoop();

    if (this.events.length === 0) {
      this.running = false;
      this.emit('empty', { sessionKey: replay.session?.session_key ?? null });
      return false;
    }

    this.running = true;
    this.timer = setInterval(() => this.#tick(), this.tickMs);
    this.timer.unref?.();
    this.emit('started', { sessionKey: replay.session?.session_key ?? null, speed: this.speed });
    return true;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    const wasRunning = this.running;
    this.running = false;
    if (wasRunning) this.emit('stopped');
  }

  #resetLoop() {
    const meeting = this.replay?.meeting ?? null;
    const session = this.replay?.session ?? null;
    this.store.beginReplay({
      meeting,
      session,
      source: this.replay?.source,
      message: this.replay?.source === 'fastf1-generated-replay'
        ? 'Showing a real FastF1-generated historical replay; this is not a live session.'
        : 'Showing real OpenF1 historical replay data; this is not a live session.',
    });
    for (const driver of driversOf(this.replay)) {
      this.store.apply('v1/drivers', driver, { receivedAt: this.now(), replay: true });
    }
    for (const event of this.immediate) {
      this.#applyEvent(event);
    }
    this.cursor = 0;
    this.replayStartMs = this.events[0]?.timeMs ?? this.now();
    this.wallStartMs = this.now();
  }

  #tick() {
    if (!this.running) return;
    const targetTime = this.replayStartMs + (this.now() - this.wallStartMs) * this.speed;
    let processed = 0;
    while (
      this.cursor < this.events.length
      && this.events[this.cursor].timeMs <= targetTime
      && processed < 10_000
    ) {
      const event = this.events[this.cursor];
      this.#applyEvent(event);
      this.cursor += 1;
      processed += 1;
    }

    if (this.cursor >= this.events.length) {
      this.emit('looped');
      this.#resetLoop();
    }
  }

  #applyEvent(event) {
    const options = { receivedAt: this.now(), replay: true };
    if (event.topic === 'fastf1/sample') {
      this.store.apply('v1/location', event.data, options);
      this.store.apply('v1/car_data', event.data, options);
      return;
    }
    this.store.apply(event.topic, event.data, options);
  }
}
