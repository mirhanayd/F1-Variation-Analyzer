import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CIRCUIT_MANIFEST } from '../../src/data/circuits/circuitManifest.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('canonical circuit manifest covers every supplied circuit.md row', async () => {
  assert.equal(CIRCUIT_MANIFEST.length, 40);
  assert.equal(new Set(CIRCUIT_MANIFEST.map((circuit) => circuit.id)).size, 40);
  assert.equal(new Set(CIRCUIT_MANIFEST.map((circuit) => circuit.file)).size, 40);

  for (const circuit of CIRCUIT_MANIFEST) {
    const source = path.join(appRoot, 'src', 'data', 'circuits', 'geojson', circuit.file);
    const geojson = JSON.parse(await readFile(source, 'utf8'));
    const line = geojson.features?.find((feature) => feature.geometry?.type === 'LineString');
    assert.ok(line?.geometry?.coordinates?.length >= 3, `${circuit.id} has usable real geometry`);
  }
});

test('Istanbul uses the exact canonical metadata and real source file', () => {
  const istanbul = CIRCUIT_MANIFEST.find((circuit) => circuit.id === 'istanbul');
  assert.equal(istanbul.location, 'Istanbul');
  assert.equal(istanbul.name, 'Intercity Istanbul Park');
  assert.equal(istanbul.grandPrixName, 'Turkish Grand Prix');
  assert.equal(istanbul.file, 'tr-2005.geojson');
});

