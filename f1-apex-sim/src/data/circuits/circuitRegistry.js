import { buildCircuitGeometryFromGeoJSON } from '../../utils/circuitGeometry';
import { CIRCUIT_MANIFEST } from './circuitManifest';

export const CIRCUIT_DATASET = Object.freeze({
  name: 'f1-circuits',
  repository: 'https://github.com/bacinger/f1-circuits',
  rawBaseUrl: 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits',
  license: 'MIT',
  attribution: 'Formula 1 circuit GeoJSON © Tomislav Bacinger and contributors',
});

const ACTIVE_2026_IDS = new Set([
  'albert_park',
  'americas',
  'baku',
  'bahrain',
  'catalunya',
  'hungaroring',
  'jeddah',
  'losail',
  'madring',
  'marina_bay',
  'miami',
  'monaco',
  'monza',
  'red_bull_ring',
  'rodriguez',
  'shanghai',
  'silverstone',
  'spa',
  'suzuka',
  'vegas',
  'villeneuve',
  'yas_marina',
  'zandvoort',
  'interlagos',
]);


const GEOJSON_MODULES = import.meta.glob('./geojson/*.geojson', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const normalizeLookupKey = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const buildCircuitEntry = (definition) => {
  const geojsonModule = GEOJSON_MODULES[`./geojson/${definition.file}`];
  if (!geojsonModule) throw new Error(`Missing canonical circuit GeoJSON: ${definition.file}`);
  const geojson = typeof geojsonModule === 'string' ? JSON.parse(geojsonModule) : geojsonModule;

  const geometry = buildCircuitGeometryFromGeoJSON(geojson, {
    trackLengthMeters: geojson.features?.[0]?.properties?.length,
    turnCount: definition.turnCount,
    source: CIRCUIT_DATASET.repository,
  });
  const sourceProperties = geometry.properties;
  const opened = Number(sourceProperties.opened);
  const firstGrandPrixYear = Number(sourceProperties.firstgp);
  const altitudeMeters = Number(sourceProperties.altitude);
  const active = ACTIVE_2026_IDS.has(definition.id);
  const canonicalPath = `circuits/${definition.file}`;

  return Object.freeze({
    ...definition,
    officialName: definition.name,
    commonName: definition.commonName ?? definition.name,
    shortName: definition.commonName ?? definition.location,
    locality: definition.location,
    grandPrix: definition.grandPrixName,
    active,
    historic: !active,
    opened: Number.isFinite(opened) ? opened : null,
    firstGrandPrixYear: Number.isFinite(firstGrandPrixYear) ? firstGrandPrixYear : null,
    trackLengthMeters: geometry.trackLengthMeters,
    trackLengthKm: geometry.trackLengthMeters / 1000,
    trackLength: {
      meters: geometry.trackLengthMeters,
      kilometers: geometry.trackLengthMeters / 1000,
      formatted: `${(geometry.trackLengthMeters / 1000).toFixed(3)} km`,
    },
    altitudeMeters: Number.isFinite(altitudeMeters) ? altitudeMeters : null,
    geojsonSourcePath: canonicalPath,
    geojsonPath: canonicalPath,
    assetPath: canonicalPath,
    sourceUrl: `${CIRCUIT_DATASET.rawBaseUrl}/${definition.file}`,
    geojson,
    geometry,
    trackGeometryPoints: geometry.geographicPoints,
    normalizedDisplayGeometry: geometry.normalizedDisplayGeometry,
    stylisedGeometry: geometry.stylisedGeometry,
    stylizedGeometry: geometry.stylisedGeometry,
    sectors: geometry.sectors,
    turns: geometry.turns,
    corners: geometry.turns,
    projection: Object.freeze({
      ...geometry.projectionMetadata,
      circuitId: definition.id,
      cacheKey: `${definition.id}:v1`,
    }),
    projectionMetadata: Object.freeze({
      ...geometry.projectionMetadata,
      circuitId: definition.id,
      cacheKey: `${definition.id}:v1`,
    }),
    openF1: Object.freeze({
      circuitShortNames: [...new Set([...(definition.openF1Names ?? []), definition.location])],
    }),
    source: CIRCUIT_DATASET,
  });
};

export const CIRCUIT_LIST = Object.freeze(CIRCUIT_MANIFEST.map(buildCircuitEntry));

export const CIRCUIT_REGISTRY = Object.freeze(Object.fromEntries(
  CIRCUIT_LIST.map((circuit) => [circuit.id, circuit]),
));

export const CANONICAL_CIRCUIT_COUNT = CIRCUIT_LIST.length;
export const CURRENT_2026_CIRCUIT_IDS = Object.freeze([...ACTIVE_2026_IDS]);

const CIRCUIT_LOOKUP = new Map();
CIRCUIT_LIST.forEach((circuit) => {
  [
    circuit.id,
    circuit.slug,
    circuit.location,
    circuit.name,
    circuit.commonName,
    circuit.file,
    circuit.geojsonSourcePath,
    ...circuit.openF1.circuitShortNames,
    ...(circuit.aliases ?? []),
  ].forEach((alias) => {
    if (alias) CIRCUIT_LOOKUP.set(normalizeLookupKey(alias), circuit);
  });
});

export const normalizeCircuitId = (value = '') => (
  CIRCUIT_LOOKUP.get(normalizeLookupKey(value))?.id ?? normalizeLookupKey(value)
);

export const getCircuitById = (id) => {
  if (id && typeof id === 'object' && id.id) return getCircuitById(id.id) ?? id;
  return CIRCUIT_LOOKUP.get(normalizeLookupKey(id)) ?? null;
};

export const getCircuitBySlug = (slug) => (
  CIRCUIT_LIST.find((circuit) => circuit.slug === slug) ?? getCircuitById(slug)
);

export const getCircuitByOpenF1Name = (name = '') => {
  const key = normalizeLookupKey(name);
  return CIRCUIT_LIST.find((circuit) => (
    circuit.openF1.circuitShortNames.some((candidate) => normalizeLookupKey(candidate) === key)
  )) ?? getCircuitById(name);
};

const resolveCircuitInput = (circuitOrId) => {
  if (circuitOrId && typeof circuitOrId === 'object') {
    return getCircuitById(circuitOrId.id ?? circuitOrId.slug) ?? circuitOrId;
  }
  return getCircuitById(circuitOrId);
};

export const getCircuitGeoJsonUrl = (circuitOrId) => {
  const circuit = resolveCircuitInput(circuitOrId);
  if (!circuit?.assetPath) return null;

  const baseUrl = import.meta.env?.BASE_URL ?? '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${circuit.assetPath.replace(/^\/+/, '')}`;
};

export const loadCircuitGeoJSON = async (circuitOrId, options = {}) => {
  const circuit = resolveCircuitInput(circuitOrId);
  if (!circuit) throw new Error(`Unknown circuit: ${String(circuitOrId)}`);
  if (circuit.geojson && !options.forceAssetFetch) return circuit.geojson;

  const response = await fetch(getCircuitGeoJsonUrl(circuit), { signal: options.signal });
  if (!response.ok) throw new Error(`Unable to load ${circuit.name} geometry (${response.status})`);
  return response.json();
};

export const loadCircuitGeometry = async (circuitOrId, options = {}) => {
  const circuit = resolveCircuitInput(circuitOrId);
  if (!circuit) throw new Error(`Unknown circuit: ${String(circuitOrId)}`);
  if (circuit.geometry && !options.forceAssetFetch) return circuit.geometry;

  const geojson = await loadCircuitGeoJSON(circuit, options);
  return buildCircuitGeometryFromGeoJSON(geojson, {
    trackLengthMeters: circuit.trackLengthMeters,
    turnCount: circuit.turnCount,
    source: CIRCUIT_DATASET.repository,
  });
};

export const getCircuitList = () => CIRCUIT_LIST;

export const getCircuitsByStatus = ({ active, historic } = {}) => CIRCUIT_LIST.filter((circuit) => (
  (active === undefined || circuit.active === active)
  && (historic === undefined || circuit.historic === historic)
));

export const circuitRegistry = CIRCUIT_REGISTRY;
export default CIRCUIT_REGISTRY;
