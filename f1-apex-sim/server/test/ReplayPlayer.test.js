import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveStateStore } from '../src/live/LiveStateStore.js';
import { ReplayPlayer } from '../src/replay/ReplayPlayer.js';

test('plays FastF1 generated artifacts through the normalized live snapshot model', async () => {
  const store = new LiveStateStore();
  const start = Date.now() - 5;
  const replay = {
    source: 'fastf1-generated-replay',
    session: {
      sessionKey: 'fastf1-2025-turkey-r',
      name: 'Race',
      meetingName: 'Turkish Grand Prix',
      circuitName: 'Istanbul',
      dateStart: new Date(start).toISOString(),
    },
    driversByNumber: {
      44: { driverNumber: 44, acronym: 'HAM', teamColor: '#E80020' },
    },
    samplesByDriver: {
      44: [{
        date: new Date(start).toISOString(),
        x: 10,
        y: 20,
        z: 1,
        speed: 280,
        throttle: 90,
        brake: false,
        gear: 7,
        rpm: 11_000,
        drs: 12,
      }, {
        date: new Date(start + 1_000).toISOString(),
        x: 30,
        y: 40,
        speed: 300,
      }],
    },
  };
  const player = new ReplayPlayer({ getLatestReplay: async () => replay }, store, {
    speed: 10,
    tickMs: 5,
  });
  player.start(replay);
  await new Promise((resolve) => setTimeout(resolve, 20));
  player.stop();
  const snapshot = store.getSnapshot();

  assert.equal(snapshot.source, 'fastf1-generated-replay');
  assert.equal(snapshot.status, 'replay');
  assert.equal(snapshot.sessionName, 'Race');
  assert.equal(snapshot.meetingName, 'Turkish Grand Prix');
  assert.equal(snapshot.driversByNumber['44'].acronym, 'HAM');
  assert.equal(snapshot.locationsByDriver['44'].x, 10);
  assert.equal(snapshot.carDataByDriver['44'].speed, 280);
});
