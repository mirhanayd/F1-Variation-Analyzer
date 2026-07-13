import { buildCircuitGeometryFromGeoJSON } from '../../utils/circuitGeometry';

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

// This manifest mirrors every data row in the user-supplied circuit.md. IDs use
// the app's established route/schedule identifiers wherever one already exists.
const CIRCUIT_MANIFEST = [
  {
    id: 'americas', slug: 'cota', location: 'Austin', country: 'United States',
    name: 'Circuit of the Americas', commonName: 'COTA', grandPrixName: 'United States Grand Prix',
    file: 'us-2012.geojson', turnCount: 20, openF1Names: ['Austin'], aliases: ['circuit_of_the_americas'],
  },
  {
    id: 'baku', slug: 'baku', location: 'Baku', country: 'Azerbaijan',
    name: 'Baku City Circuit', grandPrixName: 'Azerbaijan Grand Prix',
    file: 'az-2016.geojson', turnCount: 20, openF1Names: ['Baku'],
  },
  {
    id: 'catalunya', slug: 'barcelona-catalunya', location: 'Barcelona', country: 'Spain',
    name: 'Circuit de Barcelona-Catalunya', commonName: 'Barcelona-Catalunya', grandPrixName: 'Spanish Grand Prix',
    file: 'es-1991.geojson', turnCount: 14, openF1Names: ['Catalunya', 'Barcelona'], aliases: ['barcelona'],
  },
  {
    id: 'buenos_aires', slug: 'buenos-aires', location: 'Buenos Aires', country: 'Argentina',
    name: 'Autódromo Oscar y Juan Gálvez', commonName: 'Buenos Aires', grandPrixName: 'Argentine Grand Prix',
    file: 'ar-1952.geojson', turnCount: 15, openF1Names: ['Buenos Aires'], aliases: ['galvez'],
  },
  {
    id: 'hungaroring', slug: 'hungaroring', location: 'Budapest', country: 'Hungary',
    name: 'Hungaroring', grandPrixName: 'Hungarian Grand Prix',
    file: 'hu-1986.geojson', turnCount: 14, openF1Names: ['Hungaroring', 'Budapest'],
  },
  {
    id: 'watkins_glen', slug: 'watkins-glen', location: 'Dix', country: 'United States',
    name: 'Watkins Glen International', commonName: 'Watkins Glen', grandPrixName: 'United States Grand Prix',
    file: 'us-1956.geojson', turnCount: 11, openF1Names: ['Watkins Glen', 'Dix'],
  },
  {
    id: 'estoril', slug: 'estoril', location: 'Estoril', country: 'Portugal',
    name: 'Autódromo do Estoril', commonName: 'Estoril', grandPrixName: 'Portuguese Grand Prix',
    file: 'pt-1972.geojson', turnCount: 13, openF1Names: ['Estoril'],
  },
  {
    id: 'hockenheim', slug: 'hockenheimring', location: 'Hockenheim', country: 'Germany',
    name: 'Hockenheimring', grandPrixName: 'German Grand Prix',
    file: 'de-1932.geojson', turnCount: 17, openF1Names: ['Hockenheimring', 'Hockenheim'],
  },
  {
    id: 'imola', slug: 'imola', location: 'Imola', country: 'Italy',
    name: 'Autodromo Enzo e Dino Ferrari', commonName: 'Imola', grandPrixName: 'San Marino / Emilia Romagna Grand Prix',
    file: 'it-1953.geojson', turnCount: 19, openF1Names: ['Imola'],
  },
  {
    id: 'indianapolis', slug: 'indianapolis', location: 'Indianapolis', country: 'United States',
    name: 'Indianapolis Motor Speedway', grandPrixName: 'United States Grand Prix',
    file: 'us-1909.geojson', turnCount: 13, openF1Names: ['Indianapolis'],
  },
  {
    id: 'istanbul', slug: 'istanbul-park', location: 'Istanbul', country: 'Türkiye',
    name: 'Intercity Istanbul Park', commonName: 'Istanbul Park', grandPrixName: 'Turkish Grand Prix',
    file: 'tr-2005.geojson', turnCount: 14, openF1Names: ['Istanbul'], aliases: ['istanbul_park'],
  },
  {
    id: 'jacarepagua', slug: 'jacarepagua', location: 'Jacarepaguá', country: 'Brazil',
    name: 'Autódromo Internacional Nelson Piquet', commonName: 'Jacarepaguá', grandPrixName: 'Brazilian Grand Prix',
    file: 'br-1977.geojson', turnCount: 11, openF1Names: ['Jacarepaguá'], aliases: ['nelson_piquet'],
  },
  {
    id: 'jeddah', slug: 'jeddah', location: 'Jeddah', country: 'Saudi Arabia',
    name: 'Jeddah Corniche Circuit', grandPrixName: 'Saudi Arabian Grand Prix',
    file: 'sa-2021.geojson', turnCount: 27, openF1Names: ['Jeddah'],
  },
  {
    id: 'kyalami', slug: 'kyalami', location: 'Johannesburg', country: 'South Africa',
    name: 'Kyalami Grand Prix Circuit', commonName: 'Kyalami', grandPrixName: 'South African Grand Prix',
    file: 'za-1961.geojson', turnCount: 16, openF1Names: ['Kyalami', 'Johannesburg'],
  },
  {
    id: 'vegas', slug: 'las-vegas', location: 'Las Vegas', country: 'United States',
    name: 'Las Vegas Street Circuit', commonName: 'Las Vegas Strip Circuit', grandPrixName: 'Las Vegas Grand Prix',
    file: 'us-2023.geojson', turnCount: 17, openF1Names: ['Las Vegas'], aliases: ['las_vegas'],
  },
  {
    id: 'paul_ricard', slug: 'paul-ricard', location: 'Le Castellet', country: 'France',
    name: 'Circuit Paul Ricard', commonName: 'Paul Ricard', grandPrixName: 'French Grand Prix',
    file: 'fr-1969.geojson', turnCount: 15, openF1Names: ['Le Castellet', 'Paul Ricard'], aliases: ['ricard'],
  },
  {
    id: 'losail', slug: 'lusail', location: 'Lusail', country: 'Qatar',
    name: 'Losail International Circuit', commonName: 'Lusail International Circuit', grandPrixName: 'Qatar Grand Prix',
    file: 'qa-2004.geojson', turnCount: 16, openF1Names: ['Lusail', 'Losail'], aliases: ['lusail'],
  },
  {
    id: 'madring', slug: 'madring', location: 'Madrid', country: 'Spain',
    name: 'Circuito de Madring', commonName: 'Madring', grandPrixName: 'Madrid Grand Prix',
    file: 'es-2026.geojson', turnCount: 22, openF1Names: ['Madring', 'Madrid'], aliases: ['madrid'],
  },
  {
    id: 'magny_cours', slug: 'magny-cours', location: 'Magny-Cours', country: 'France',
    name: 'Circuit de Nevers Magny-Cours', commonName: 'Magny-Cours', grandPrixName: 'French Grand Prix',
    file: 'fr-1960.geojson', turnCount: 17, openF1Names: ['Magny-Cours'],
  },
  {
    id: 'albert_park', slug: 'albert-park', location: 'Melbourne', country: 'Australia',
    name: 'Albert Park Circuit', commonName: 'Albert Park', grandPrixName: 'Australian Grand Prix',
    file: 'au-1953.geojson', turnCount: 14, openF1Names: ['Melbourne'],
  },
  {
    id: 'rodriguez', slug: 'autodromo-hermanos-rodriguez', location: 'Mexico City', country: 'Mexico',
    name: 'Autódromo Hermanos Rodríguez', commonName: 'Hermanos Rodríguez', grandPrixName: 'Mexican Grand Prix',
    file: 'mx-1962.geojson', turnCount: 17, openF1Names: ['Mexico City'], aliases: ['hermanos_rodriguez'],
  },
  {
    id: 'miami', slug: 'miami', location: 'Miami', country: 'United States',
    name: 'Miami International Autodrome', grandPrixName: 'Miami Grand Prix',
    file: 'us-2022.geojson', turnCount: 19, openF1Names: ['Miami'],
  },
  {
    id: 'monaco', slug: 'monaco', location: 'Monaco', country: 'Monaco',
    name: 'Circuit de Monaco', grandPrixName: 'Monaco Grand Prix',
    file: 'mc-1929.geojson', turnCount: 19, openF1Names: ['Monte Carlo', 'Monaco'], aliases: ['monte_carlo'],
  },
  {
    id: 'villeneuve', slug: 'circuit-gilles-villeneuve', location: 'Montreal', country: 'Canada',
    name: 'Circuit Gilles-Villeneuve', commonName: 'Circuit Gilles Villeneuve', grandPrixName: 'Canadian Grand Prix',
    file: 'ca-1978.geojson', turnCount: 14, openF1Names: ['Montreal'], aliases: ['gilles_villeneuve'],
  },
  {
    id: 'monza', slug: 'monza', location: 'Monza', country: 'Italy',
    name: 'Autodromo Nazionale Monza', commonName: 'Monza', grandPrixName: 'Italian Grand Prix',
    file: 'it-1922.geojson', turnCount: 11, openF1Names: ['Monza'],
  },
  {
    id: 'nurburgring', slug: 'nurburgring', location: 'Nürburg', country: 'Germany',
    name: 'Nürburgring', grandPrixName: 'German Grand Prix',
    file: 'de-1927.geojson', turnCount: 15, openF1Names: ['Nürburgring', 'Nurburgring'], aliases: ['nurburg'],
  },
  {
    id: 'portimao', slug: 'portimao', location: 'Portimão', country: 'Portugal',
    name: 'Autódromo Internacional do Algarve', commonName: 'Portimão', grandPrixName: 'Portuguese Grand Prix',
    file: 'pt-2008.geojson', turnCount: 15, openF1Names: ['Portimão', 'Portimao'],
  },
  {
    id: 'bahrain', slug: 'bahrain', location: 'Sakhir', country: 'Bahrain',
    name: 'Bahrain International Circuit', commonName: 'Bahrain', grandPrixName: 'Bahrain Grand Prix',
    file: 'bh-2002.geojson', turnCount: 15, openF1Names: ['Sakhir'],
  },
  {
    id: 'interlagos', slug: 'interlagos', location: 'Sao Paulo', country: 'Brazil',
    name: 'Autódromo José Carlos Pace - Interlagos', commonName: 'Interlagos', grandPrixName: 'Brazilian Grand Prix',
    file: 'br-1940.geojson', turnCount: 15, openF1Names: ['Interlagos', 'São Paulo', 'Sao Paulo'], aliases: ['sao_paulo', 'jose_carlos_pace'],
  },
  {
    id: 'mugello', slug: 'mugello', location: 'Scarperia e San Piero', country: 'Italy',
    name: 'Autodromo Internazionale del Mugello', commonName: 'Mugello', grandPrixName: 'Tuscan Grand Prix',
    file: 'it-1914.geojson', turnCount: 15, openF1Names: ['Mugello', 'Scarperia'],
  },
  {
    id: 'sepang', slug: 'sepang', location: 'Sepang', country: 'Malaysia',
    name: 'Sepang International Circuit', grandPrixName: 'Malaysian Grand Prix',
    file: 'my-1999.geojson', turnCount: 15, openF1Names: ['Sepang'],
  },
  {
    id: 'shanghai', slug: 'shanghai', location: 'Shanghai', country: 'China',
    name: 'Shanghai International Circuit', grandPrixName: 'Chinese Grand Prix',
    file: 'cn-2004.geojson', turnCount: 16, openF1Names: ['Shanghai'],
  },
  {
    id: 'silverstone', slug: 'silverstone', location: 'Silverstone', country: 'United Kingdom',
    name: 'Silverstone Circuit', commonName: 'Silverstone', grandPrixName: 'British Grand Prix',
    file: 'gb-1948.geojson', turnCount: 18, openF1Names: ['Silverstone'],
  },
  {
    id: 'marina_bay', slug: 'marina-bay', location: 'Singapore', country: 'Singapore',
    name: 'Marina Bay Street Circuit', commonName: 'Marina Bay', grandPrixName: 'Singapore Grand Prix',
    file: 'sg-2008.geojson', turnCount: 19, openF1Names: ['Singapore'], aliases: ['marina_bay'],
  },
  {
    id: 'sochi', slug: 'sochi', location: 'Sochi', country: 'Russia',
    name: 'Sochi Autodrom', grandPrixName: 'Russian Grand Prix',
    file: 'ru-2014.geojson', turnCount: 18, openF1Names: ['Sochi'],
  },
  {
    id: 'spa', slug: 'spa-francorchamps', location: 'Spa Francorchamps', country: 'Belgium',
    name: 'Circuit de Spa-Francorchamps', commonName: 'Spa-Francorchamps', grandPrixName: 'Belgian Grand Prix',
    file: 'be-1925.geojson', turnCount: 19, openF1Names: ['Spa-Francorchamps', 'Spa Francorchamps'], aliases: ['spa_francorchamps'],
  },
  {
    id: 'red_bull_ring', slug: 'red-bull-ring', location: 'Spielberg', country: 'Austria',
    name: 'Red Bull Ring', grandPrixName: 'Austrian Grand Prix',
    file: 'at-1969.geojson', turnCount: 10, openF1Names: ['Spielberg'], aliases: ['spielberg'],
  },
  {
    id: 'suzuka', slug: 'suzuka', location: 'Suzuka', country: 'Japan',
    name: 'Suzuka International Racing Course', commonName: 'Suzuka', grandPrixName: 'Japanese Grand Prix',
    file: 'jp-1962.geojson', turnCount: 18, openF1Names: ['Suzuka'],
  },
  {
    id: 'yas_marina', slug: 'yas-marina', location: 'Yas Marina', country: 'United Arab Emirates',
    name: 'Yas Marina Circuit', grandPrixName: 'Abu Dhabi Grand Prix',
    file: 'ae-2009.geojson', turnCount: 16, openF1Names: ['Yas Marina Circuit', 'Yas Marina'], aliases: ['abu_dhabi'],
  },
  {
    id: 'zandvoort', slug: 'zandvoort', location: 'Zandvoort', country: 'Netherlands',
    name: 'Circuit Zandvoort', grandPrixName: 'Dutch Grand Prix',
    file: 'nl-1948.geojson', turnCount: 14, openF1Names: ['Zandvoort'],
  },
];

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
      circuitShortNames: [...new Set([definition.location, ...(definition.openF1Names ?? [])])],
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
