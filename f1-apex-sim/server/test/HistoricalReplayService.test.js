import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { HistoricalReplayService } from '../src/replay/HistoricalReplayService.js';

const jsonResponse = (value) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('historical replay uses valid OpenF1 comparison keys and returns every telemetry family', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pitwall-replay-'));
  const requested = [];
  const session = {
    session_key: 9912,
    meeting_key: 1276,
    session_name: 'Race',
    date_start: '2025-09-07T13:00:00Z',
    date_end: '2025-09-07T15:00:00Z',
  };
  const values = {
    meetings: [{ meeting_key: 1276, meeting_name: 'Italian Grand Prix', circuit_short_name: 'Monza' }],
    drivers: [{ session_key: 9912, driver_number: 44, name_acronym: 'HAM' }],
    location: [{ session_key: 9912, driver_number: 44, date: '2025-09-07T13:01:00Z', x: 1, y: 2, z: 3 }],
    car_data: [{ session_key: 9912, driver_number: 44, date: '2025-09-07T13:01:00Z', speed: 300 }],
    position: [{ session_key: 9912, driver_number: 44, date: '2025-09-07T13:01:00Z', position: 1 }],
    intervals: [{ session_key: 9912, driver_number: 44, date: '2025-09-07T13:01:00Z', gap_to_leader: 0 }],
    laps: [{ session_key: 9912, driver_number: 44, date_start: '2025-09-07T13:01:00Z', lap_number: 1 }],
  };

  try {
    const service = new HistoricalReplayService({
      generatedDirectory: directory,
      remoteFallback: true,
      windowMs: 300_000,
      apiMinIntervalMs: 0,
      apiUrl: 'https://api.openf1.org/v1',
    }, {
      now: () => Date.parse('2026-07-13T12:00:00Z'),
      fetchImpl: async (url) => {
        requested.push(url);
        const endpoint = url.pathname.split('/').at(-1);
        if (endpoint === 'sessions') {
          return jsonResponse(url.searchParams.get('year') === '2025' ? [session] : []);
        }
        return jsonResponse(values[endpoint] ?? []);
      },
    });

    const replay = await service.getLatestReplay({ circuitShortName: 'Monza' });
    assert.equal(replay.source, 'openf1-historical-replay');
    assert.equal(replay.drivers.length, 1);
    assert.equal(replay.location.length, 1);
    assert.equal(replay.carData.length, 1);
    assert.equal(replay.position.length, 1);
    assert.equal(replay.intervals.length, 1);
    assert.equal(replay.laps.length, 1);

    const locationUrl = requested.find((url) => url.pathname.endsWith('/location'));
    const lapsUrl = requested.find((url) => url.pathname.endsWith('/laps'));
    assert.equal(locationUrl.searchParams.get('date>'), '2025-09-07T13:00:00.000Z');
    assert.equal(locationUrl.searchParams.get('date<'), '2025-09-07T13:05:00.000Z');
    assert.equal(locationUrl.searchParams.has('date>='), false);
    assert.equal(lapsUrl.searchParams.get('session_key'), '9912');
    assert.equal(lapsUrl.searchParams.has('date_start>'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('OpenF1 no-results responses become a clean missing replay', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pitwall-replay-empty-'));
  try {
    const service = new HistoricalReplayService({
      generatedDirectory: directory,
      remoteFallback: true,
      windowMs: 300_000,
      apiMinIntervalMs: 0,
      apiUrl: 'https://api.openf1.org/v1',
    }, {
      fetchImpl: async () => new Response(JSON.stringify({ detail: 'No results found.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    });

    assert.equal(await service.getReplay('99999999'), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
