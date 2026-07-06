const SVG_NS = 'http://www.w3.org/2000/svg';

export const getBoundingBox = (points) => {
  if (!points?.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach(({ x, y }) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

export const buildGeometry = (points, metadata = {}) => ({
  points,
  bbox: getBoundingBox(points),
  source: metadata.source ?? 'unknown',
  coordinateSpace: metadata.coordinateSpace ?? 'svg',
  closed: metadata.closed ?? true,
  metadata,
});

export const buildGeometryFromPointArrays = (xValues, yValues, metadata = {}) => {
  const points = xValues
    .map((x, index) => ({ x: Number(x), y: Number(yValues[index]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  return buildGeometry(points, metadata);
};

export const buildSvgGeometry = (svgText, { sampleCount = 1600 } = {}) => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
  const sourcePath = svgDoc.querySelector('path');

  if (!sourcePath) {
    throw new Error('SVG does not contain a path element');
  }

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', sourcePath.getAttribute('d'));

  const totalLength = path.getTotalLength();
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / (sampleCount - 1);
    const point = path.getPointAtLength(totalLength * progress);
    return { x: point.x, y: point.y };
  });

  return buildGeometry(points, {
    source: 'svg',
    coordinateSpace: 'svg',
    totalLength,
  });
};

export const slicePointsByRange = (points, range = { start: 0, end: 1 }) => {
  if (!points?.length) return [];

  const start = Math.max(0, Math.min(1, range.start ?? 0));
  const end = Math.max(start, Math.min(1, range.end ?? 1));
  const startIndex = Math.floor(start * (points.length - 1));
  const endIndex = Math.max(startIndex + 1, Math.ceil(end * (points.length - 1)));

  return points.slice(startIndex, endIndex + 1);
};

export const getPointAtProgress = (points, progress) => {
  if (!points?.length) return null;

  const safeProgress = Math.max(0, Math.min(1, progress));
  const exactIndex = safeProgress * (points.length - 1);
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.min(points.length - 1, lowerIndex + 1);
  const mix = exactIndex - lowerIndex;
  const lower = points[lowerIndex];
  const upper = points[upperIndex];

  return {
    x: lower.x + (upper.x - lower.x) * mix,
    y: lower.y + (upper.y - lower.y) * mix,
  };
};

export const worldToScreen = (point, camera) => {
  if (!point || !camera) return null;

  return {
    x: point.x * camera.scale + camera.x,
    y: point.y * camera.scale + camera.y,
  };
};

export const getLocationBounds = (locationByDriver = {}) => {
  const points = Object.values(locationByDriver)
    .flat()
    .map((location) => ({ x: location.x, y: location.y }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  return getBoundingBox(points);
};

export const projectTelemetryPoint = (location, geometry, telemetryBounds) => {
  if (!location || !geometry?.bbox) return null;

  if (geometry.coordinateSpace === 'liveTiming') {
    return { x: location.x, y: location.y };
  }

  if (!telemetryBounds?.width || !telemetryBounds?.height) {
    return null;
  }

  const xRatio = (location.x - telemetryBounds.x) / telemetryBounds.width;
  const yRatio = (location.y - telemetryBounds.y) / telemetryBounds.height;

  return {
    x: geometry.bbox.x + xRatio * geometry.bbox.width,
    y: geometry.bbox.y + yRatio * geometry.bbox.height,
  };
};

export const interpolateLocation = (locations, targetTimeMs) => {
  if (!locations?.length) return null;

  if (targetTimeMs <= locations[0].timeMs) return locations[0];
  if (targetTimeMs >= locations[locations.length - 1].timeMs) {
    return locations[locations.length - 1];
  }

  let low = 0;
  let high = locations.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (locations[mid].timeMs < targetTimeMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const before = locations[Math.max(0, low - 1)];
  const after = locations[Math.min(locations.length - 1, low)];
  const span = after.timeMs - before.timeMs;
  const mix = span > 0 ? (targetTimeMs - before.timeMs) / span : 0;

  return {
    ...before,
    x: before.x + (after.x - before.x) * mix,
    y: before.y + (after.y - before.y) * mix,
    z: before.z + (after.z - before.z) * mix,
    timeMs: targetTimeMs,
  };
};
