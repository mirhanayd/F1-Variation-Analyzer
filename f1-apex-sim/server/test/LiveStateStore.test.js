import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveStateStore } from '../src/live/LiveStateStore.js';

test('normalizes required OpenF1 topics and rejects duplicates/out-of-order samples', () => {
  let now = Date.parse('2026-07-13T12:00:05.000Z');
  const store = new LiveStateStore({ now: () => now, staleDriverMs: 10_000 });
  store.beginLive();

  assert.equal(store.apply('v1/drivers', {
    driver_number: 44,
    full_name: 'Lewis Hamilton',
    name_acronym: 'HAM',
    team_name: 'Ferrari',
    team_colour: 'E80020',
    session_key: 123,
  }), true);
  assert.equal(store.apply('v1/location', {
    driver_number: 44,
    x: 100,
    y: 200,
    z: 3,
    date: '2026-07-13T12:00:04.000Z',
    session_key: 123,
  }), true);
  assert.equal(store.apply('v1/location', {
    driver_number: 44,
    x: 100,
    y: 200,
    z: 3,
    date: '2026-07-13T12:00:04.000Z',
    session_key: 123,
  }), false);
  assert.equal(store.apply('v1/location', {
    driver_number: 44,
    x: 90,
    y: 190,
    date: '2026-07-13T12:00:03.000Z',
    session_key: 123,
  }), false);

  store.apply('v1/car_data', {
    driver_number: 44,
    speed: 321,
    throttle: 100,
    brake: 0,
    n_gear: 8,
    rpm: 12_100,
    drs: 12,
    date: '2026-07-13T12:00:04.100Z',
  });
  store.apply('v1/position', { driver_number: 44, position: 2, date: '2026-07-13T12:00:04.200Z' });
  store.apply('v1/intervals', { driver_number: 44, gap_to_leader: 1.2, interval: 0.4, date: '2026-07-13T12:00:04.300Z' });
  store.apply('v1/laps', { driver_number: 44, lap_number: 10, duration_sector_1: 25.1, date_start: '2026-07-13T12:00:04.400Z' });

  let snapshot = store.getSnapshot();
  assert.equal(snapshot.source, 'openf1-live');
  assert.equal(snapshot.status, 'live');
  assert.equal(snapshot.driversByNumber['44'].acronym, 'HAM');
  assert.equal(snapshot.driversByNumber['44'].teamColor, '#E80020');
  assert.equal(snapshot.locationsByDriver['44'].x, 100);
  assert.equal(snapshot.carDataByDriver['44'].gear, 8);
  assert.equal(snapshot.positionsByDriver['44'].position, 2);
  assert.equal(snapshot.intervalsByDriver['44'].intervalToAhead, 0.4);
  assert.equal(snapshot.lapsByDriver['44'].sector1, 25.1);
  assert.equal(snapshot.latencyMs, 600);

  now += 11_000;
  snapshot = store.getSnapshot();
  assert.equal(snapshot.locationsByDriver['44'].stale, true);
});

test('replay state is clearly distinct from live state', () => {
  const store = new LiveStateStore();
  store.beginReplay({
    meeting: { meeting_key: 1, meeting_name: 'Turkish Grand Prix', circuit_short_name: 'Istanbul' },
    session: { session_key: 2, session_name: 'Race' },
  });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.source, 'openf1-historical-replay');
  assert.equal(snapshot.status, 'replay');
  assert.equal(snapshot.circuitShortName, 'Istanbul');
});
