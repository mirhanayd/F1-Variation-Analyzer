import assert from 'node:assert/strict';
import test from 'node:test';
import { CircuitProjectionService } from '../src/projection/CircuitProjectionService.js';
import { loadCanonicalCircuits } from '../src/projection/loadCanonicalCircuits.js';

test('projects, smooths and snaps location data to real registered geometry', () => {
  const service = new CircuitProjectionService({ smoothingFactor: 1 });
  service.registerCircuit('tr-2005', {
    type: 'LineString',
    coordinates: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
  }, { aliases: ['Istanbul'] });

  let projected;
  for (let index = 0; index < 25; index += 1) {
    projected = service.project('Istanbul', {
      x: (index % 10) * 100,
      y: Math.floor(index / 10) * 100,
    }, { driverNumber: 44, timestamp: index * 2_000 });
  }

  assert.equal(service.hasCircuit('istanbul'), true);
  assert.equal(projected.calibrated, true);
  assert.equal(Number.isFinite(projected.progress), true);
  assert.equal(Number.isFinite(projected.snappedX), true);
  assert.equal(service.getMetadata('Istanbul').sampleCount, 25);
});

test('loads every canonical GeoJSON circuit in the shared 1000x640 display space', async () => {
  const service = new CircuitProjectionService();
  const result = await loadCanonicalCircuits(service, {
    appRoot: new URL('../../', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'),
  });
  const istanbul = service.getMetadata('istanbul_park');

  assert.equal(result.loaded, 40);
  assert.equal(service.hasCircuit('albert_park'), true);
  assert.equal(istanbul.targetBounds.minY, 36);
  assert.equal(istanbul.targetBounds.maxY, 604);
  assert.equal(istanbul.targetBounds.minX > 0, true);
  assert.equal(istanbul.targetBounds.maxX < 1_000, true);
});
