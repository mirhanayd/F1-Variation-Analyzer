import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EARTH_RADIUS_METERS = 6_371_008.8;
const DISPLAY_WIDTH = 1_000;
const DISPLAY_HEIGHT = 640;
const DISPLAY_PADDING = 36;

const collectLines = (geometry, output = []) => {
  if (!geometry) return output;
  if (geometry.type === 'FeatureCollection') {
    for (const feature of geometry.features ?? []) collectLines(feature, output);
  } else if (geometry.type === 'Feature') {
    collectLines(geometry.geometry, output);
  } else if (geometry.type === 'LineString') {
    output.push(geometry.coordinates ?? []);
  } else if (geometry.type === 'MultiLineString') {
    output.push(...(geometry.coordinates ?? []));
  } else if (geometry.type === 'Polygon') {
    output.push(...(geometry.coordinates ?? []));
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates ?? []) output.push(...polygon);
  }
  return output;
};

const lineLength = (line) => line.slice(1).reduce((total, point, index) => (
  total + Math.hypot(Number(point[0]) - Number(line[index][0]), Number(point[1]) - Number(line[index][1]))
), 0);

// Matches the frontend's real-geometry display space: geographic coordinates
// become local metres and are aspect-fit into 1000x640 with 36 px padding.
const toDisplayGeometry = (geojson) => {
  const source = collectLines(geojson)
    .filter((line) => line.length >= 2)
    .sort((first, second) => lineLength(second) - lineLength(first))[0];
  if (!source) throw new Error('GeoJSON has no usable circuit line');
  const points = source.map((point) => ({ x: Number(point[0]), y: Number(point[1]) }));
  const first = points[0];
  const last = points.at(-1);
  const isClosed = Math.hypot(first.x - last.x, first.y - last.y) <= 1e-7;
  const unique = isClosed ? points.slice(0, -1) : points;
  const origin = unique.reduce((result, point) => ({
    x: result.x + point.x / unique.length,
    y: result.y + point.y / unique.length,
  }), { x: 0, y: 0 });
  const radians = Math.PI / 180;
  const longitudeScale = Math.cos(origin.y * radians) * EARTH_RADIUS_METERS * radians;
  const latitudeScale = EARTH_RADIUS_METERS * radians;
  const local = points.map((point) => ({
    x: (point.x - origin.x) * longitudeScale,
    y: (point.y - origin.y) * latitudeScale,
  }));
  const bounds = local.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const availableWidth = DISPLAY_WIDTH - DISPLAY_PADDING * 2;
  const availableHeight = DISPLAY_HEIGHT - DISPLAY_PADDING * 2;
  const sourceWidth = Math.max(1e-9, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(1e-9, bounds.maxY - bounds.minY);
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = DISPLAY_PADDING + (availableWidth - renderedWidth) / 2;
  const offsetY = DISPLAY_PADDING + (availableHeight - renderedHeight) / 2;
  const displayPoints = local.map((point) => [
    offsetX + (point.x - bounds.minX) * scale,
    offsetY + (bounds.maxY - point.y) * scale,
  ]);
  return { type: 'LineString', coordinates: displayPoints };
};

const potentialRegistryExports = (module) => [
  module.CIRCUIT_MANIFEST,
  module.CIRCUIT_REGISTRY,
  module.circuitRegistry,
  module.CIRCUITS,
  module.CURATED_CIRCUITS,
  module.default,
];

const entriesOf = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

const aliasesOf = (entry) => [
  entry?.id,
  entry?.slug,
  entry?.location,
  entry?.locality,
  entry?.name,
  entry?.officialName,
  entry?.shortName,
  entry?.jolpicaCircuitId,
  ...(entry?.aliases ?? []),
  ...(entry?.openF1Names ?? []),
  ...(entry?.openF1?.circuitShortNames ?? []),
  ...(entry?.openF1?.circuitShortName ? [entry.openF1.circuitShortName] : []),
].filter(Boolean);

const sourceBasename = (entry) => {
  const source = entry?.geojsonSource
    ?? entry?.geoJsonSource
    ?? entry?.geojsonPath
    ?? entry?.sourcePath
    ?? entry?.source
    ?? entry?.file;
  return typeof source === 'string' ? path.basename(source, path.extname(source)) : null;
};

/** Loads real GeoJSON circuits and aliases used by both legacy and canonical registries. */
export const loadCanonicalCircuits = async (projectionService, {
  appRoot,
} = {}) => {
  const root = appRoot ?? path.resolve(process.cwd(), '..');
  const geojsonDirectory = path.join(root, 'src', 'data', 'circuits', 'geojson');
  let filenames = [];
  try {
    filenames = (await readdir(geojsonDirectory)).filter((name) => name.endsWith('.geojson'));
  } catch {
    return { loaded: 0, aliases: 0, directory: geojsonDirectory };
  }

  const metadataById = new Map();
  for (const filename of filenames) {
    try {
      const geometry = JSON.parse(await readFile(path.join(geojsonDirectory, filename), 'utf8'));
      const properties = geometry.features?.[0]?.properties ?? {};
      const id = properties.id ?? geometry.name ?? path.basename(filename, '.geojson');
      const aliases = [
        id,
        geometry.name,
        properties.Location,
        properties.location,
        properties.Name,
        properties.name,
      ].filter(Boolean);
      projectionService.registerCircuit(id, toDisplayGeometry(geometry), {
        aliases,
        properties,
        filename,
        coordinateSpace: 'circuit-normalized',
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
      });
      metadataById.set(String(id), { id: String(id), aliases });
    } catch {
      // A malformed circuit is isolated and does not prevent other real tracks loading.
    }
  }

  let aliasCount = [...metadataById.values()].reduce((sum, item) => sum + item.aliases.length, 0);
  const registryPaths = [
    path.join(root, 'src', 'data', 'circuits', 'circuitManifest.js'),
    path.join(root, 'src', 'data', 'circuits', 'circuitRegistry.js'),
    path.join(root, 'src', 'data', 'circuitRegistry.js'),
  ];
  for (const registryPath of registryPaths) {
    let registryModule;
    try {
      registryModule = await import(pathToFileURL(registryPath).href);
    } catch {
      continue;
    }
    const registry = potentialRegistryExports(registryModule).find((candidate) => entriesOf(candidate).length > 0);
    for (const entry of entriesOf(registry)) {
      const aliases = aliasesOf(entry);
      const basename = sourceBasename(entry);
      let matchedId = basename && metadataById.has(basename) ? basename : null;
      if (!matchedId) {
        const lowerAliases = aliases.map((alias) => String(alias).toLowerCase());
        matchedId = [...metadataById.values()].find((candidate) => (
          candidate.aliases.some((alias) => lowerAliases.includes(String(alias).toLowerCase()))
        ))?.id ?? null;
      }
      if (!matchedId) continue;
      for (const alias of aliases) {
        if (projectionService.registerAlias(alias, matchedId)) aliasCount += 1;
      }
    }
  }

  return { loaded: metadataById.size, aliases: aliasCount, directory: geojsonDirectory };
};
