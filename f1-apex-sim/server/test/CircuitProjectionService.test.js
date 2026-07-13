import assert from 'node:assert/strict';
import test from 'node:test';
import { CircuitProjectionService } from '../src/projection/CircuitProjectionService.js';

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
