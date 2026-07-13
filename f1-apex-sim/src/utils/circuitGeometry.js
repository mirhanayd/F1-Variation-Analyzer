const EARTH_RADIUS_METERS = 6_371_008.8;
const DEFAULT_DISPLAY_SIZE = { width: 1000, height: 640 };
const EPSILON = 1e-9;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const normalizePadding = (padding = 0) => {
  if (Number.isFinite(padding)) {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }

  return {
    top: Number(padding?.top) || 0,
    right: Number(padding?.right) || 0,
    bottom: Number(padding?.bottom) || 0,
    left: Number(padding?.left) || 0,
  };
};

export const toCircuitPoint = (value) => {
  if (Array.isArray(value)) {
    return {
      x: Number(value[0]),
      y: Number(value[1]),
      ...(Number.isFinite(Number(value[2])) ? { z: Number(value[2]) } : {}),
    };
  }

  if (!value || typeof value !== 'object') return null;

  const x = Number(value.x ?? value.longitude ?? value.lng ?? value.lon);
  const y = Number(value.y ?? value.latitude ?? value.lat);
  const z = Number(value.z ?? value.altitude ?? value.elevation);

  return {
    x,
    y,
    ...(Number.isFinite(z) ? { z } : {}),
  };
};

export const sanitizeCircuitPoints = (points = [], { deduplicate = true } = {}) => {
  const sanitized = [];

  points.forEach((value) => {
    const point = toCircuitPoint(value);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;

    const previous = sanitized.at(-1);
    if (
      deduplicate
      && previous
      && Math.abs(previous.x - point.x) < EPSILON
      && Math.abs(previous.y - point.y) < EPSILON
      && Math.abs((previous.z ?? 0) - (point.z ?? 0)) < EPSILON
    ) {
      return;
    }

    sanitized.push(point);
  });

  return sanitized;
};

export const distanceBetweenPoints = (first, second) => Math.hypot(
  second.x - first.x,
  second.y - first.y,
);

export const areCircuitPointsClosed = (points = [], tolerance = EPSILON) => {
  if (points.length < 3) return false;
  return distanceBetweenPoints(points[0], points.at(-1)) <= tolerance;
};

export const ensureClosedCircuit = (points = [], tolerance = EPSILON) => {
  const safePoints = sanitizeCircuitPoints(points);
  if (safePoints.length < 2 || areCircuitPointsClosed(safePoints, tolerance)) return safePoints;
  return [...safePoints, { ...safePoints[0] }];
};

export const getCircuitBoundingBox = (points = []) => {
  const safePoints = sanitizeCircuitPoints(points, { deduplicate: false });
  if (!safePoints.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  safePoints.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const collectLineStrings = (geometry, output) => {
  if (!geometry) return;

  if (geometry.type === 'LineString') {
    output.push(geometry.coordinates ?? []);
    return;
  }

  if (geometry.type === 'MultiLineString') {
    (geometry.coordinates ?? []).forEach((line) => output.push(line));
    return;
  }

  if (geometry.type === 'Polygon') {
    (geometry.coordinates ?? []).forEach((ring) => output.push(ring));
    return;
  }

  if (geometry.type === 'MultiPolygon') {
    (geometry.coordinates ?? []).forEach((polygon) => {
      polygon.forEach((ring) => output.push(ring));
    });
    return;
  }

  if (geometry.type === 'GeometryCollection') {
    (geometry.geometries ?? []).forEach((entry) => collectLineStrings(entry, output));
  }
};

export const extractGeoJSONTrackPoints = (geojson) => {
  const lineStrings = [];

  if (geojson?.type === 'FeatureCollection') {
    (geojson.features ?? []).forEach((feature) => collectLineStrings(feature.geometry, lineStrings));
  } else if (geojson?.type === 'Feature') {
    collectLineStrings(geojson.geometry, lineStrings);
  } else {
    collectLineStrings(geojson, lineStrings);
  }

  if (!lineStrings.length) return [];

  // A circuit is represented by the longest line/ring if a source also includes
  // pit-lane or annotation features.
  return lineStrings
    .map((line) => sanitizeCircuitPoints(line))
    .sort((first, second) => getPolylineLength(second) - getPolylineLength(first))[0] ?? [];
};

export const getGeoJSONTrackProperties = (geojson) => {
  if (geojson?.type === 'FeatureCollection') {
    const feature = (geojson.features ?? []).find((entry) => (
      entry?.geometry?.type === 'LineString' || entry?.geometry?.type === 'MultiLineString'
    ));
    return feature?.properties ?? {};
  }

  return geojson?.properties ?? {};
};

export const getPolylineLength = (points = []) => {
  const safePoints = sanitizeCircuitPoints(points);
  let length = 0;

  for (let index = 1; index < safePoints.length; index += 1) {
    length += distanceBetweenPoints(safePoints[index - 1], safePoints[index]);
  }

  return length;
};

export const buildArcLengthIndex = (points = []) => {
  const safePoints = sanitizeCircuitPoints(points);
  const cumulativeLengths = [0];

  for (let index = 1; index < safePoints.length; index += 1) {
    cumulativeLengths.push(
      cumulativeLengths[index - 1]
      + distanceBetweenPoints(safePoints[index - 1], safePoints[index]),
    );
  }

  return {
    points: safePoints,
    cumulativeLengths,
    totalLength: cumulativeLengths.at(-1) ?? 0,
    closed: areCircuitPointsClosed(safePoints),
  };
};

export const getPointAtArcLength = (pointsOrIndex, requestedDistance = 0) => {
  const arcIndex = Array.isArray(pointsOrIndex)
    ? buildArcLengthIndex(pointsOrIndex)
    : pointsOrIndex;
  const { points = [], cumulativeLengths = [], totalLength = 0 } = arcIndex ?? {};

  if (!points.length) return null;
  if (points.length === 1 || totalLength <= EPSILON) return { ...points[0] };

  const distance = clamp(Number(requestedDistance) || 0, 0, totalLength);
  let low = 1;
  let high = cumulativeLengths.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (cumulativeLengths[middle] < distance) low = middle + 1;
    else high = middle;
  }

  const upperIndex = low;
  const lowerIndex = Math.max(0, upperIndex - 1);
  const startDistance = cumulativeLengths[lowerIndex];
  const segmentLength = cumulativeLengths[upperIndex] - startDistance;
  const mix = segmentLength > EPSILON ? (distance - startDistance) / segmentLength : 0;
  const start = points[lowerIndex];
  const end = points[upperIndex];

  return {
    x: start.x + (end.x - start.x) * mix,
    y: start.y + (end.y - start.y) * mix,
    ...(
      Number.isFinite(start.z) || Number.isFinite(end.z)
        ? { z: (start.z ?? 0) + ((end.z ?? 0) - (start.z ?? 0)) * mix }
        : {}
    ),
  };
};

export const getPointAtCircuitProgress = (pointsOrIndex, progress = 0) => {
  const arcIndex = Array.isArray(pointsOrIndex)
    ? buildArcLengthIndex(pointsOrIndex)
    : pointsOrIndex;
  return getPointAtArcLength(arcIndex, clamp(Number(progress) || 0, 0, 1) * (arcIndex?.totalLength ?? 0));
};

export const sliceCircuitByProgress = (points = [], startProgress = 0, endProgress = 1) => {
  const arcIndex = buildArcLengthIndex(points);
  if (arcIndex.points.length < 2) return arcIndex.points;

  const start = clamp(Number(startProgress) || 0, 0, 1) * arcIndex.totalLength;
  const end = clamp(Number(endProgress) || 0, 0, 1) * arcIndex.totalLength;
  if (end < start) {
    return [
      ...sliceCircuitByProgress(points, startProgress, 1).slice(0, -1),
      ...sliceCircuitByProgress(points, 0, endProgress),
    ];
  }

  const result = [getPointAtArcLength(arcIndex, start)];
  arcIndex.cumulativeLengths.forEach((distance, index) => {
    if (distance > start + EPSILON && distance < end - EPSILON) {
      result.push({ ...arcIndex.points[index] });
    }
  });
  result.push(getPointAtArcLength(arcIndex, end));

  return sanitizeCircuitPoints(result);
};

export const resampleCircuitByArcLength = (points = [], count = 160, options = {}) => {
  const { includeClosingPoint = true } = options;
  const closedPoints = areCircuitPointsClosed(points) ? sanitizeCircuitPoints(points) : points;
  const arcIndex = buildArcLengthIndex(closedPoints);
  const safeCount = Math.max(2, Math.round(Number(count) || 2));

  if (arcIndex.points.length < 2 || arcIndex.totalLength <= EPSILON) return arcIndex.points;

  const divisor = includeClosingPoint ? safeCount - 1 : safeCount;
  return Array.from({ length: safeCount }, (_, index) => (
    getPointAtArcLength(arcIndex, (index / divisor) * arcIndex.totalLength)
  ));
};

const perpendicularDistance = (point, lineStart, lineEnd) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const magnitudeSquared = dx * dx + dy * dy;
  if (magnitudeSquared <= EPSILON) return distanceBetweenPoints(point, lineStart);

  const mix = clamp(
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / magnitudeSquared,
    0,
    1,
  );
  return distanceBetweenPoints(point, {
    x: lineStart.x + dx * mix,
    y: lineStart.y + dy * mix,
  });
};

const simplifyOpenLine = (points, tolerance) => {
  if (points.length <= 2) return points;

  let greatestDistance = 0;
  let splitIndex = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (distance > greatestDistance) {
      greatestDistance = distance;
      splitIndex = index;
    }
  }

  if (greatestDistance <= tolerance) return [points[0], points.at(-1)];

  return [
    ...simplifyOpenLine(points.slice(0, splitIndex + 1), tolerance).slice(0, -1),
    ...simplifyOpenLine(points.slice(splitIndex), tolerance),
  ];
};

export const simplifyCircuitGeometry = (points = [], tolerance = 1) => {
  const safePoints = sanitizeCircuitPoints(points);
  const closed = areCircuitPointsClosed(safePoints);
  const openPoints = closed ? safePoints.slice(0, -1) : safePoints;
  if (openPoints.length <= 3) return closed ? ensureClosedCircuit(openPoints) : openPoints;

  // Rotate a closed ring to a stable, distant anchor so Douglas-Peucker does not
  // collapse the seam between coincident start/end points.
  let workingPoints = openPoints;
  if (closed) {
    const bbox = getCircuitBoundingBox(openPoints);
    const anchorIndex = openPoints.reduce((bestIndex, point, index) => {
      const best = openPoints[bestIndex];
      const pointDistance = Math.hypot(point.x - bbox.centerX, point.y - bbox.centerY);
      const bestDistance = Math.hypot(best.x - bbox.centerX, best.y - bbox.centerY);
      return pointDistance > bestDistance ? index : bestIndex;
    }, 0);
    workingPoints = [...openPoints.slice(anchorIndex), ...openPoints.slice(0, anchorIndex)];
  }

  const simplified = simplifyOpenLine(workingPoints, Math.max(0, Number(tolerance) || 0));
  return closed ? ensureClosedCircuit(simplified) : simplified;
};

export const smoothCircuitGeometry = (points = [], options = {}) => {
  const { iterations = 2, tension = 0.25, closed = areCircuitPointsClosed(points) } = options;
  let result = sanitizeCircuitPoints(points);
  if (closed && areCircuitPointsClosed(result)) result = result.slice(0, -1);
  if (result.length < 3) return result;

  const safeTension = clamp(Number(tension) || 0.25, 0.01, 0.49);

  for (let iteration = 0; iteration < Math.max(0, Math.round(iterations)); iteration += 1) {
    const smoothed = [];
    const segmentCount = closed ? result.length : result.length - 1;
    if (!closed) smoothed.push({ ...result[0] });

    for (let index = 0; index < segmentCount; index += 1) {
      const start = result[index];
      const end = result[(index + 1) % result.length];
      smoothed.push({
        x: start.x * (1 - safeTension) + end.x * safeTension,
        y: start.y * (1 - safeTension) + end.y * safeTension,
      });
      smoothed.push({
        x: start.x * safeTension + end.x * (1 - safeTension),
        y: start.y * safeTension + end.y * (1 - safeTension),
      });
    }

    if (!closed) smoothed.push({ ...result.at(-1) });
    result = smoothed;
  }

  return closed ? ensureClosedCircuit(result) : result;
};

export const normalizeCircuitGeometry = (points = [], options = {}) => {
  const {
    width = DEFAULT_DISPLAY_SIZE.width,
    height = DEFAULT_DISPLAY_SIZE.height,
    padding = 36,
    rotation = 0,
    flipX = false,
    flipY = true,
    preserveAspectRatio = true,
  } = options;
  const safePoints = sanitizeCircuitPoints(points);
  const sourceBBox = getCircuitBoundingBox(safePoints);

  if (!sourceBBox) {
    return {
      points: [],
      bbox: null,
      sourceBBox: null,
      coordinateSpace: 'circuit-normalized',
      transform: null,
    };
  }

  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const rotated = safePoints.map((point) => {
    const x = (point.x - sourceBBox.centerX) * (flipX ? -1 : 1);
    const y = point.y - sourceBBox.centerY;
    return {
      x: x * cosine - y * sine,
      y: x * sine + y * cosine,
      ...(Number.isFinite(point.z) ? { z: point.z } : {}),
    };
  });
  const rotatedBBox = getCircuitBoundingBox(rotated);
  const safePadding = normalizePadding(padding);
  const availableWidth = Math.max(EPSILON, width - safePadding.left - safePadding.right);
  const availableHeight = Math.max(EPSILON, height - safePadding.top - safePadding.bottom);
  const scaleX = rotatedBBox.width > EPSILON ? availableWidth / rotatedBBox.width : 1;
  const scaleY = rotatedBBox.height > EPSILON ? availableHeight / rotatedBBox.height : 1;
  const resolvedScaleX = preserveAspectRatio ? Math.min(scaleX, scaleY) : scaleX;
  const resolvedScaleY = preserveAspectRatio ? Math.min(scaleX, scaleY) : scaleY;
  const renderedWidth = rotatedBBox.width * resolvedScaleX;
  const renderedHeight = rotatedBBox.height * resolvedScaleY;
  const offsetX = safePadding.left + (availableWidth - renderedWidth) / 2;
  const offsetY = safePadding.top + (availableHeight - renderedHeight) / 2;

  const normalizedPoints = rotated.map((point) => ({
    x: offsetX + (point.x - rotatedBBox.minX) * resolvedScaleX,
    y: flipY
      ? offsetY + (rotatedBBox.maxY - point.y) * resolvedScaleY
      : offsetY + (point.y - rotatedBBox.minY) * resolvedScaleY,
    ...(Number.isFinite(point.z) ? { z: point.z } : {}),
  }));

  return {
    points: normalizedPoints,
    bbox: getCircuitBoundingBox(normalizedPoints),
    sourceBBox,
    coordinateSpace: 'circuit-normalized',
    width,
    height,
    padding: safePadding,
    transform: {
      sourceCenter: { x: sourceBBox.centerX, y: sourceBBox.centerY },
      rotation,
      scaleX: resolvedScaleX * (flipX ? -1 : 1),
      scaleY: resolvedScaleY * (flipY ? -1 : 1),
      offsetX,
      offsetY,
      flipX,
      flipY,
    },
  };
};

export const geographicPointsToLocalMeters = (points = [], origin) => {
  const safePoints = sanitizeCircuitPoints(points);
  if (!safePoints.length) return { points: [], origin: null };

  const uniquePoints = areCircuitPointsClosed(safePoints) ? safePoints.slice(0, -1) : safePoints;
  const resolvedOrigin = origin ?? uniquePoints.reduce((accumulator, point) => ({
    x: accumulator.x + point.x / uniquePoints.length,
    y: accumulator.y + point.y / uniquePoints.length,
  }), { x: 0, y: 0 });
  const latitudeRadians = resolvedOrigin.y * (Math.PI / 180);
  const longitudeScale = Math.cos(latitudeRadians) * EARTH_RADIUS_METERS * (Math.PI / 180);
  const latitudeScale = EARTH_RADIUS_METERS * (Math.PI / 180);

  return {
    origin: { longitude: resolvedOrigin.x, latitude: resolvedOrigin.y },
    points: safePoints.map((point) => ({
      x: (point.x - resolvedOrigin.x) * longitudeScale,
      y: (point.y - resolvedOrigin.y) * latitudeScale,
      ...(Number.isFinite(point.z) ? { z: point.z } : {}),
    })),
  };
};

const haversineDistance = (first, second) => {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (second.y - first.y) * toRadians;
  const longitudeDelta = (second.x - first.x) * toRadians;
  const firstLatitude = first.y * toRadians;
  const secondLatitude = second.y * toRadians;
  const a = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  );
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const measureGeographicCircuitLength = (points = []) => {
  const safePoints = sanitizeCircuitPoints(points);
  let distance = 0;
  for (let index = 1; index < safePoints.length; index += 1) {
    distance += haversineDistance(safePoints[index - 1], safePoints[index]);
  }
  return distance;
};

export const generateCircuitSectors = (points = [], count = 3) => {
  const safeCount = Math.max(1, Math.round(Number(count) || 3));
  const arcIndex = buildArcLengthIndex(points);

  return Array.from({ length: safeCount }, (_, index) => {
    const startProgress = index / safeCount;
    const endProgress = (index + 1) / safeCount;
    const sectorPoints = sliceCircuitByProgress(points, startProgress, endProgress);
    return {
      id: `sector-${index + 1}`,
      index,
      label: `Sector ${index + 1}`,
      name: `Sector ${index + 1}`,
      startProgress,
      endProgress,
      startDistance: arcIndex.totalLength * startProgress,
      endDistance: arcIndex.totalLength * endProgress,
      startPoint: getPointAtCircuitProgress(arcIndex, startProgress),
      endPoint: getPointAtCircuitProgress(arcIndex, endProgress),
      points: sectorPoints,
      bbox: getCircuitBoundingBox(sectorPoints),
      generated: true,
    };
  });
};

const normalizeAngle = (angle) => {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
};

const circularProgressDistance = (first, second) => {
  const direct = Math.abs(first - second);
  return Math.min(direct, 1 - direct);
};

export const generateCircuitTurns = (points = [], options = {}) => {
  const {
    desiredCount,
    sampleCount = 320,
    minimumTurns = 8,
    maximumTurns = 24,
    minimumSpacing = 0.025,
  } = options;
  const closedPoints = ensureClosedCircuit(points);
  if (closedPoints.length < 4) return [];

  const samples = resampleCircuitByArcLength(closedPoints, Math.max(48, sampleCount), {
    includeClosingPoint: false,
  });
  const scores = samples.map((point, index) => {
    const previous = samples[(index - 2 + samples.length) % samples.length];
    const next = samples[(index + 2) % samples.length];
    const incomingHeading = Math.atan2(point.y - previous.y, point.x - previous.x);
    const outgoingHeading = Math.atan2(next.y - point.y, next.x - point.x);
    return Math.abs(normalizeAngle(outgoingHeading - incomingHeading));
  });

  const smoothedScores = scores.map((_, index) => {
    let score = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      score += scores[(index + offset + scores.length) % scores.length] * (3 - Math.abs(offset));
    }
    return score / 9;
  });
  const sortedScores = [...smoothedScores].sort((first, second) => first - second);
  const threshold = Math.max(0.012, sortedScores[Math.floor(sortedScores.length * 0.58)] ?? 0);
  const numericDesiredCount = Number(desiredCount);
  const effectiveMaximumTurns = Number.isFinite(numericDesiredCount)
    ? Math.max(maximumTurns, Math.round(numericDesiredCount))
    : maximumTurns;
  const estimatedCount = clamp(
    Math.round(Math.sqrt(closedPoints.length) * 1.45),
    minimumTurns,
    effectiveMaximumTurns,
  );
  const targetCount = clamp(
    Math.round(numericDesiredCount || estimatedCount),
    minimumTurns,
    effectiveMaximumTurns,
  );
  const resolvedMinimumSpacing = Math.min(minimumSpacing, 0.7 / targetCount);

  const candidates = smoothedScores
    .map((score, index) => ({
      index,
      score,
      progress: index / samples.length,
      point: samples[index],
    }))
    .filter((candidate) => {
      const previous = smoothedScores[(candidate.index - 1 + samples.length) % samples.length];
      const next = smoothedScores[(candidate.index + 1) % samples.length];
      return candidate.score >= threshold && candidate.score >= previous && candidate.score >= next;
    })
    .sort((first, second) => second.score - first.score);

  // If a long, constant-radius corner has no strict local maximum, its highest
  // samples are still eligible to fill the generated fallback turn count.
  if (candidates.length < targetCount) {
    smoothedScores
      .map((score, index) => ({
        index,
        score,
        progress: index / samples.length,
        point: samples[index],
      }))
      .sort((first, second) => second.score - first.score)
      .forEach((candidate) => {
        if (!candidates.some((entry) => entry.index === candidate.index)) candidates.push(candidate);
      });
  }

  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= targetCount) break;
    if (
      selected.every((entry) => (
        circularProgressDistance(entry.progress, candidate.progress) >= resolvedMinimumSpacing
      ))
    ) {
      selected.push(candidate);
    }
  }

  if (selected.length < targetCount) {
    for (const candidate of candidates) {
      if (selected.length >= targetCount) break;
      if (selected.some((entry) => entry.index === candidate.index)) continue;
      if (
        selected.every((entry) => (
          circularProgressDistance(entry.progress, candidate.progress) >= resolvedMinimumSpacing * 0.5
        ))
      ) {
        selected.push(candidate);
      }
    }
  }

  while (selected.length < targetCount) {
    const ordered = [...selected].sort((first, second) => first.progress - second.progress);
    let largestGap = -1;
    let gapStart = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      const start = ordered[index]?.progress ?? 0;
      const end = index === ordered.length - 1 ? ordered[0].progress + 1 : ordered[index + 1].progress;
      if (end - start > largestGap) {
        largestGap = end - start;
        gapStart = start;
      }
    }
    const progress = ordered.length ? (gapStart + largestGap / 2) % 1 : 0;
    const index = Math.round(progress * samples.length) % samples.length;
    selected.push({ index, progress, point: samples[index], score: smoothedScores[index] });
  }

  return selected
    .sort((first, second) => first.progress - second.progress)
    .map((candidate, index) => ({
      id: `turn-${index + 1}`,
      index,
      label: `T${index + 1}`,
      name: `Turn ${index + 1}`,
      progress: candidate.progress,
      point: { ...candidate.point },
      curvature: candidate.score,
      generated: true,
    }));
};

export const createStylisedCircuitGeometry = (points = [], options = {}) => {
  const bbox = getCircuitBoundingBox(points);
  if (!bbox) return { points: [], bbox: null, coordinateSpace: 'circuit-normalized' };

  const diagonal = Math.hypot(bbox.width, bbox.height);
  const simplified = simplifyCircuitGeometry(
    points,
    options.tolerance ?? diagonal * 0.0025,
  );
  const smoothed = smoothCircuitGeometry(simplified, {
    iterations: options.iterations ?? 2,
    tension: options.tension ?? 0.2,
    closed: true,
  });
  const stylisedPoints = resampleCircuitByArcLength(
    smoothed,
    options.sampleCount ?? 220,
  );

  return {
    points: stylisedPoints,
    bbox: getCircuitBoundingBox(stylisedPoints),
    coordinateSpace: 'circuit-normalized',
    closed: true,
    derivedFromRealGeometry: true,
  };
};

export const buildCircuitGeometryFromGeoJSON = (geojson, options = {}) => {
  const geographicPoints = extractGeoJSONTrackPoints(geojson);
  if (geographicPoints.length < 2) {
    throw new Error('Circuit GeoJSON does not contain a usable line geometry');
  }

  const properties = getGeoJSONTrackProperties(geojson);
  const closedGeographicPoints = ensureClosedCircuit(geographicPoints, 1e-7);
  const local = geographicPointsToLocalMeters(closedGeographicPoints);
  const normalized = normalizeCircuitGeometry(local.points, {
    ...DEFAULT_DISPLAY_SIZE,
    padding: 36,
    ...options.display,
  });
  const expectedLength = Number(options.trackLengthMeters ?? properties.length);
  const measuredLength = measureGeographicCircuitLength(closedGeographicPoints);
  const sectors = generateCircuitSectors(normalized.points, options.sectorCount ?? 3);
  const turns = generateCircuitTurns(normalized.points, {
    desiredCount: options.turnCount,
    ...options.turns,
  });
  const stylisedGeometry = createStylisedCircuitGeometry(normalized.points, options.stylised);

  return {
    source: options.source ?? 'bacinger/f1-circuits',
    sourceId: properties.id ?? geojson.name ?? null,
    coordinateSpace: 'circuit-normalized',
    sourceCoordinateSpace: 'EPSG:4326',
    closed: areCircuitPointsClosed(normalized.points),
    points: normalized.points,
    bbox: normalized.bbox,
    width: normalized.width,
    height: normalized.height,
    geographicPoints: closedGeographicPoints,
    geographicBBox: getCircuitBoundingBox(closedGeographicPoints),
    localPoints: local.points,
    localBBox: getCircuitBoundingBox(local.points),
    localOrigin: local.origin,
    normalizedDisplayGeometry: {
      points: normalized.points,
      bbox: normalized.bbox,
      coordinateSpace: normalized.coordinateSpace,
      width: normalized.width,
      height: normalized.height,
      transform: normalized.transform,
      closed: areCircuitPointsClosed(normalized.points),
    },
    stylisedGeometry,
    trackLengthMeters: Number.isFinite(expectedLength) ? expectedLength : measuredLength,
    measuredGeometryLengthMeters: measuredLength,
    displayArcLength: getPolylineLength(normalized.points),
    sectors,
    turns,
    properties: { ...properties },
    projectionMetadata: {
      version: 1,
      sourceCoordinateSpace: 'EPSG:4326',
      localCoordinateSpace: 'local-equirectangular-meters',
      displayCoordinateSpace: 'circuit-normalized',
      geographicBBox: getCircuitBoundingBox(closedGeographicPoints),
      localBBox: getCircuitBoundingBox(local.points),
      displayBBox: normalized.bbox,
      displayTransform: normalized.transform,
      calibrationStrategy: 'similarity-transform-nearest-track-snap',
    },
  };
};

// American spelling is exported as an alias for component authors while the
// canonical function name follows the source requirement's "stylised" wording.
export const createStylizedCircuitGeometry = createStylisedCircuitGeometry;
