import {
  buildArcLengthIndex,
  distanceBetweenPoints,
  getCircuitBoundingBox,
  sanitizeCircuitPoints,
  toCircuitPoint,
} from './circuitGeometry';

const EPSILON = 1e-9;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const getTimestampMs = (sample) => {
  const value = sample?.timeMs ?? sample?.timestamp ?? sample?.date;
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pointCloudCentroid = (points) => points.reduce((centroid, point) => ({
  x: centroid.x + point.x / points.length,
  y: centroid.y + point.y / points.length,
}), { x: 0, y: 0 });

export const getPointCloudPrincipalAxis = (points = []) => {
  const safePoints = sanitizeCircuitPoints(points);
  if (safePoints.length < 2) {
    return { angle: 0, centroid: safePoints[0] ?? { x: 0, y: 0 }, eigenvalues: [0, 0] };
  }

  const centroid = pointCloudCentroid(safePoints);
  let xx = 0;
  let xy = 0;
  let yy = 0;

  safePoints.forEach((point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  });

  xx /= safePoints.length;
  xy /= safePoints.length;
  yy /= safePoints.length;
  const discriminant = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy ** 2));

  return {
    angle: 0.5 * Math.atan2(2 * xy, xx - yy),
    centroid,
    eigenvalues: [(xx + yy + discriminant) / 2, (xx + yy - discriminant) / 2],
  };
};

export const createProjectionTransform = (options = {}) => {
  const {
    sourceCenter = { x: 0, y: 0 },
    targetCenter = { x: 0, y: 0 },
    rotation = 0,
    scale = 1,
    scaleX = scale,
    scaleY = scale,
    flipX = false,
    flipY = false,
    translateX = 0,
    translateY = 0,
  } = options;
  const xDirection = flipX ? -1 : 1;
  const yDirection = flipY ? -1 : 1;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const a = scaleX * cosine * xDirection;
  const c = -scaleX * sine * yDirection;
  const b = scaleY * sine * xDirection;
  const d = scaleY * cosine * yDirection;
  const e = targetCenter.x + translateX - a * sourceCenter.x - c * sourceCenter.y;
  const f = targetCenter.y + translateY - b * sourceCenter.x - d * sourceCenter.y;

  return {
    version: 1,
    type: 'similarity-transform',
    sourceCenter: { x: sourceCenter.x, y: sourceCenter.y },
    targetCenter: { x: targetCenter.x, y: targetCenter.y },
    rotation,
    scale,
    scaleX,
    scaleY,
    flipX,
    flipY,
    translateX,
    translateY,
    matrix: { a, b, c, d, e, f },
  };
};

export const applyProjectionTransform = (value, transform) => {
  const point = toCircuitPoint(value);
  if (!point || !transform) return null;

  const matrix = transform.matrix ?? createProjectionTransform(transform).matrix;
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    ...(Number.isFinite(point.z) ? { z: point.z } : {}),
  };
};

const getRotatedBounds = (points, center, rotation, flipX, flipY) => {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const rotated = points.map((point) => {
    const x = (point.x - center.x) * (flipX ? -1 : 1);
    const y = (point.y - center.y) * (flipY ? -1 : 1);
    return {
      x: x * cosine - y * sine,
      y: x * sine + y * cosine,
    };
  });
  return getCircuitBoundingBox(rotated);
};

export const fitPointCloudBounds = (sourcePoints = [], targetPoints = [], options = {}) => {
  const source = sanitizeCircuitPoints(sourcePoints);
  const target = sanitizeCircuitPoints(targetPoints);
  if (source.length < 2 || target.length < 2) return null;

  const {
    rotation = 0,
    flipX = false,
    flipY = false,
    preserveAspectRatio = true,
    fit = 'contain',
    scaleMultiplier = 1,
  } = options;
  const sourceCenter = pointCloudCentroid(source);
  const targetCenter = pointCloudCentroid(target);
  const targetBBox = getCircuitBoundingBox(target);
  const rotatedBBox = getRotatedBounds(source, sourceCenter, rotation, flipX, flipY);
  const widthScale = targetBBox.width / Math.max(rotatedBBox.width, EPSILON);
  const heightScale = targetBBox.height / Math.max(rotatedBBox.height, EPSILON);
  const uniformScale = (fit === 'cover' ? Math.max(widthScale, heightScale) : Math.min(widthScale, heightScale));
  const scaleX = (preserveAspectRatio ? uniformScale : widthScale) * scaleMultiplier;
  const scaleY = (preserveAspectRatio ? uniformScale : heightScale) * scaleMultiplier;

  return createProjectionTransform({
    sourceCenter,
    targetCenter,
    rotation,
    scale: preserveAspectRatio ? uniformScale * scaleMultiplier : Math.sqrt(scaleX * scaleY),
    scaleX,
    scaleY,
    flipX,
    flipY,
  });
};

export const fitBoundingBoxes = (sourceBounds, targetBounds, options = {}) => {
  if (!sourceBounds || !targetBounds) return null;

  const sourcePoints = [
    { x: sourceBounds.minX ?? sourceBounds.x, y: sourceBounds.minY ?? sourceBounds.y },
    { x: sourceBounds.maxX ?? sourceBounds.x + sourceBounds.width, y: sourceBounds.minY ?? sourceBounds.y },
    { x: sourceBounds.maxX ?? sourceBounds.x + sourceBounds.width, y: sourceBounds.maxY ?? sourceBounds.y + sourceBounds.height },
    { x: sourceBounds.minX ?? sourceBounds.x, y: sourceBounds.maxY ?? sourceBounds.y + sourceBounds.height },
  ];
  const targetPoints = [
    { x: targetBounds.minX ?? targetBounds.x, y: targetBounds.minY ?? targetBounds.y },
    { x: targetBounds.maxX ?? targetBounds.x + targetBounds.width, y: targetBounds.minY ?? targetBounds.y },
    { x: targetBounds.maxX ?? targetBounds.x + targetBounds.width, y: targetBounds.maxY ?? targetBounds.y + targetBounds.height },
    { x: targetBounds.minX ?? targetBounds.x, y: targetBounds.maxY ?? targetBounds.y + targetBounds.height },
  ];
  return fitPointCloudBounds(sourcePoints, targetPoints, options);
};

export const findNearestPointOnTrack = (value, trackPoints = [], arcIndexOverride) => {
  const point = toCircuitPoint(value);
  const arcIndex = arcIndexOverride ?? buildArcLengthIndex(trackPoints);
  if (!point || arcIndex.points.length < 2) return null;

  let closest = null;

  for (let index = 1; index < arcIndex.points.length; index += 1) {
    const start = arcIndex.points[index - 1];
    const end = arcIndex.points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLengthSquared = dx * dx + dy * dy;
    const mix = segmentLengthSquared > EPSILON
      ? clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared, 0, 1)
      : 0;
    const projected = { x: start.x + dx * mix, y: start.y + dy * mix };
    const distanceSquared = (point.x - projected.x) ** 2 + (point.y - projected.y) ** 2;

    if (!closest || distanceSquared < closest.distanceSquared) {
      const segmentLength = Math.sqrt(segmentLengthSquared);
      const arcLength = arcIndex.cumulativeLengths[index - 1] + segmentLength * mix;
      closest = {
        point: projected,
        segmentIndex: index - 1,
        segmentProgress: mix,
        distanceSquared,
        distance: Math.sqrt(distanceSquared),
        arcLength,
        totalLength: arcIndex.totalLength,
        progress: arcIndex.totalLength > EPSILON ? arcLength / arcIndex.totalLength : 0,
      };
    }
  }

  return closest;
};

export const getTrackProgressForPoint = (point, trackPoints, arcIndex) => (
  findNearestPointOnTrack(point, trackPoints, arcIndex)?.progress ?? null
);

const scoreTransform = (sourcePoints, targetPoints, transform) => {
  const targetArcIndex = buildArcLengthIndex(targetPoints);
  const sampleStride = Math.max(1, Math.floor(sourcePoints.length / 180));
  let sum = 0;
  let maximum = 0;
  let count = 0;

  for (let index = 0; index < sourcePoints.length; index += sampleStride) {
    const transformed = applyProjectionTransform(sourcePoints[index], transform);
    const nearest = findNearestPointOnTrack(transformed, targetPoints, targetArcIndex);
    if (!nearest) continue;
    sum += nearest.distance ** 2;
    maximum = Math.max(maximum, nearest.distance);
    count += 1;
  }

  const targetBBox = getCircuitBoundingBox(targetPoints);
  const diagonal = Math.max(EPSILON, Math.hypot(targetBBox.width, targetBBox.height));
  const rmsDistance = count ? Math.sqrt(sum / count) : Infinity;
  return {
    rmsDistance,
    maximumDistance: maximum,
    normalizedScore: rmsDistance / diagonal,
    sampleCount: count,
  };
};

export const fitLocationSamplesToCircuit = (locationSamples = [], trackPoints = [], options = {}) => {
  const source = sanitizeCircuitPoints(locationSamples);
  const target = sanitizeCircuitPoints(trackPoints);
  if (source.length < (options.minimumSamples ?? 4) || target.length < 3) return null;

  const sourceAxis = getPointCloudPrincipalAxis(source);
  const targetAxis = getPointCloudPrincipalAxis(target);
  const baseRotation = Number.isFinite(options.rotation)
    ? options.rotation
    : targetAxis.angle - sourceAxis.angle;
  const candidateRotations = options.rotationCandidates ?? [
    baseRotation,
    baseRotation + Math.PI,
    baseRotation + Math.PI / 2,
    baseRotation - Math.PI / 2,
  ];
  const reflections = options.allowReflection === false
    ? [[false, false]]
    : [[false, false], [true, false], [false, true]];
  let best = null;

  candidateRotations.forEach((rotation) => {
    reflections.forEach(([flipX, flipY]) => {
      const transform = fitPointCloudBounds(source, target, {
        ...options,
        rotation,
        flipX,
        flipY,
      });
      const score = scoreTransform(source, target, transform);
      if (!best || score.normalizedScore < best.score.normalizedScore) {
        best = { transform, score };
      }
    });
  });

  if (!best) return null;
  return {
    ...best,
    sourceBounds: getCircuitBoundingBox(source),
    targetBounds: getCircuitBoundingBox(target),
    sourceSampleCount: source.length,
    targetPointCount: target.length,
    calibratedAt: new Date().toISOString(),
    strategy: 'pca-candidate-fit-nearest-track-score',
  };
};

export const projectPointToCircuit = (value, trackPoints = [], transform, options = {}) => {
  const transformedPoint = applyProjectionTransform(value, transform);
  if (!transformedPoint) return null;

  const nearest = findNearestPointOnTrack(transformedPoint, trackPoints, options.arcIndex);
  if (!nearest) return null;

  const maxSnapDistance = Number(options.maxSnapDistance);
  const outlier = Number.isFinite(maxSnapDistance) && nearest.distance > maxSnapDistance;
  if (outlier && options.rejectOutliers !== false) {
    return {
      ...transformedPoint,
      rawPoint: transformedPoint,
      snappedPoint: nearest.point,
      progress: nearest.progress,
      distanceFromTrack: nearest.distance,
      valid: false,
      outlier: true,
    };
  }

  const snapStrength = clamp(Number(options.snapStrength ?? 1), 0, 1);
  return {
    x: transformedPoint.x + (nearest.point.x - transformedPoint.x) * snapStrength,
    y: transformedPoint.y + (nearest.point.y - transformedPoint.y) * snapStrength,
    ...(Number.isFinite(transformedPoint.z) ? { z: transformedPoint.z } : {}),
    rawPoint: transformedPoint,
    snappedPoint: nearest.point,
    progress: nearest.progress,
    arcLength: nearest.arcLength,
    segmentIndex: nearest.segmentIndex,
    distanceFromTrack: nearest.distance,
    valid: true,
    outlier: false,
  };
};

export const isLocationSampleOutlier = (current, previous, options = {}) => {
  const currentPoint = toCircuitPoint(current);
  const previousPoint = toCircuitPoint(previous);
  if (!currentPoint || !previousPoint) return false;

  const distance = distanceBetweenPoints(previousPoint, currentPoint);
  const currentTime = getTimestampMs(current);
  const previousTime = getTimestampMs(previous);
  const deltaSeconds = currentTime !== null && previousTime !== null
    ? Math.max(0.001, (currentTime - previousTime) / 1000)
    : null;
  const speed = deltaSeconds ? distance / deltaSeconds : null;
  const maxDistance = Number(options.maxDistance ?? Infinity);
  const maxSpeed = Number(options.maxSpeed ?? 160);

  return distance > maxDistance || (Number.isFinite(speed) && speed > maxSpeed);
};

export const rejectLocationOutliers = (samples = [], options = {}) => {
  const accepted = [];
  const rejected = [];

  samples.forEach((sample) => {
    const previous = accepted.at(-1);
    if (previous && isLocationSampleOutlier(sample, previous, options)) rejected.push(sample);
    else accepted.push(sample);
  });

  return { accepted, rejected };
};

export const interpolateProjectedPoint = (from, to, progress = 0) => {
  if (!from) return to ? { ...to } : null;
  if (!to) return { ...from };
  const mix = clamp(Number(progress) || 0, 0, 1);
  const result = {
    ...from,
    ...to,
    x: from.x + (to.x - from.x) * mix,
    y: from.y + (to.y - from.y) * mix,
  };

  if (Number.isFinite(from.z) || Number.isFinite(to.z)) {
    result.z = (from.z ?? 0) + ((to.z ?? 0) - (from.z ?? 0)) * mix;
  }

  if (Number.isFinite(from.progress) && Number.isFinite(to.progress)) {
    let delta = to.progress - from.progress;
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;
    result.progress = (from.progress + delta * mix + 1) % 1;
  }

  return result;
};

export const smoothProjectedPoint = (previous, next, options = {}) => {
  if (!previous) return next ? { ...next } : null;
  if (!next) return { ...previous };

  const deltaMs = Math.max(0, Number(options.deltaMs ?? 16));
  const timeConstantMs = Math.max(1, Number(options.timeConstantMs ?? 120));
  const alpha = clamp(
    Number.isFinite(Number(options.alpha))
      ? Number(options.alpha)
      : 1 - Math.exp(-deltaMs / timeConstantMs),
    0,
    1,
  );
  let target = next;
  const maximumStep = Number(options.maximumStep ?? Infinity);
  const distance = distanceBetweenPoints(previous, next);

  if (Number.isFinite(maximumStep) && distance > maximumStep && distance > EPSILON) {
    const scale = maximumStep / distance;
    target = {
      ...next,
      x: previous.x + (next.x - previous.x) * scale,
      y: previous.y + (next.y - previous.y) * scale,
    };
  }

  return interpolateProjectedPoint(previous, target, alpha);
};

export class ProjectedPositionSmoother {
  constructor(options = {}) {
    this.options = options;
    this.positions = new Map();
  }

  update(key, position, options = {}) {
    if (!position) return null;
    const previous = this.positions.get(key);
    const smoothed = smoothProjectedPoint(previous, position, { ...this.options, ...options });
    this.positions.set(key, smoothed);
    return smoothed;
  }

  get(key) {
    return this.positions.get(key) ?? null;
  }

  reset(key) {
    if (key === undefined) this.positions.clear();
    else this.positions.delete(key);
  }
}

export const createProjectionCacheKey = (circuitId, sessionKey = 'default') => (
  `${String(circuitId ?? 'unknown').toLowerCase()}:${sessionKey ?? 'default'}`
);

export class ProjectionMetadataCache {
  constructor(entries = []) {
    this.entries = new Map(entries);
  }

  get(key) {
    return this.entries.get(key) ?? null;
  }

  set(key, metadata) {
    const value = { ...metadata, cacheKey: key };
    this.entries.set(key, value);
    return value;
  }

  has(key) {
    return this.entries.has(key);
  }

  delete(key) {
    return this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  toJSON() {
    return Object.fromEntries(this.entries);
  }

  hydrate(serialized = {}) {
    Object.entries(serialized).forEach(([key, value]) => this.entries.set(key, value));
    return this;
  }
}

export class CircuitProjectionService {
  constructor(options = {}) {
    this.cache = options.cache ?? new ProjectionMetadataCache();
    this.smoother = options.smoother ?? new ProjectedPositionSmoother(options.smoothing);
    this.previousLocations = new Map();
    this.defaultOptions = options;
  }

  getCalibration(circuitId, sessionKey) {
    return this.cache.get(createProjectionCacheKey(circuitId, sessionKey));
  }

  calibrate(circuitId, locationSamples, circuitGeometry, options = {}) {
    const trackPoints = (
      options.circuitInfoGeometry?.points
      ?? circuitGeometry?.points
      ?? circuitGeometry?.normalizedDisplayGeometry?.points
      ?? []
    );
    const cleanSamples = rejectLocationOutliers(locationSamples, {
      maxSpeed: options.maxSourceSpeed ?? this.defaultOptions.maxSourceSpeed ?? 160,
      maxDistance: options.maxSourceStep ?? this.defaultOptions.maxSourceStep ?? Infinity,
    }).accepted;
    const calibration = fitLocationSamplesToCircuit(cleanSamples, trackPoints, options);
    if (!calibration) return null;

    const cacheKey = createProjectionCacheKey(circuitId, options.sessionKey);
    return this.cache.set(cacheKey, {
      ...calibration,
      circuitId,
      sessionKey: options.sessionKey ?? 'default',
      circuitSource: options.circuitInfoGeometry?.points ? 'openf1-circuit-info' : 'canonical-geojson',
    });
  }

  calibrateFromBounds(circuitId, sourceBounds, circuitGeometry, options = {}) {
    const trackPoints = circuitGeometry?.points ?? circuitGeometry?.normalizedDisplayGeometry?.points ?? [];
    const targetBounds = getCircuitBoundingBox(trackPoints);
    const transform = fitBoundingBoxes(sourceBounds, targetBounds, options);
    if (!transform) return null;

    const cacheKey = createProjectionCacheKey(circuitId, options.sessionKey);
    return this.cache.set(cacheKey, {
      circuitId,
      sessionKey: options.sessionKey ?? 'default',
      transform,
      sourceBounds,
      targetBounds,
      calibratedAt: new Date().toISOString(),
      strategy: 'bounds-fit-fallback',
      circuitSource: 'canonical-geojson',
    });
  }

  project(circuitId, location, circuitGeometry, options = {}) {
    const sessionKey = options.sessionKey;
    const calibration = options.calibration ?? this.getCalibration(circuitId, sessionKey);
    if (!calibration?.transform) return null;

    const driverKey = options.driverKey ?? location?.driver_number ?? location?.driverNumber ?? 'unknown';
    const stateKey = `${createProjectionCacheKey(circuitId, sessionKey)}:${driverKey}`;
    const previousLocation = this.previousLocations.get(stateKey);
    if (
      previousLocation
      && isLocationSampleOutlier(location, previousLocation, {
        maxSpeed: options.maxSourceSpeed ?? this.defaultOptions.maxSourceSpeed ?? 160,
        maxDistance: options.maxSourceStep ?? this.defaultOptions.maxSourceStep ?? Infinity,
      })
    ) {
      return {
        ...(this.smoother.get(stateKey) ?? {}),
        valid: false,
        outlier: true,
        stale: true,
      };
    }

    this.previousLocations.set(stateKey, location);
    const trackPoints = circuitGeometry?.points ?? circuitGeometry?.normalizedDisplayGeometry?.points ?? [];
    const projected = projectPointToCircuit(location, trackPoints, calibration.transform, {
      snapStrength: options.snapStrength ?? this.defaultOptions.snapStrength ?? 0.9,
      maxSnapDistance: options.maxSnapDistance ?? this.defaultOptions.maxSnapDistance,
      rejectOutliers: options.rejectOutliers,
    });
    if (!projected?.valid) return projected;

    const currentTimestamp = getTimestampMs(location);
    const previousTimestamp = getTimestampMs(previousLocation);
    const deltaMs = currentTimestamp !== null && previousTimestamp !== null
      ? Math.max(0, currentTimestamp - previousTimestamp)
      : options.deltaMs;
    return this.smoother.update(stateKey, projected, {
      deltaMs,
      alpha: options.smoothingAlpha,
      timeConstantMs: options.smoothingTimeConstantMs,
      maximumStep: options.maximumDisplayStep,
    });
  }

  projectMany(circuitId, locations = [], circuitGeometry, options = {}) {
    return locations.map((location) => this.project(circuitId, location, circuitGeometry, {
      ...options,
      driverKey: options.driverKey ?? location?.driver_number ?? location?.driverNumber,
    }));
  }

  clear(circuitId, sessionKey) {
    if (circuitId === undefined) {
      this.cache.clear();
      this.smoother.reset();
      this.previousLocations.clear();
      return;
    }

    const prefix = createProjectionCacheKey(circuitId, sessionKey);
    this.cache.delete(prefix);
    [...this.previousLocations.keys()]
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => {
        this.previousLocations.delete(key);
        this.smoother.reset(key);
      });
  }
}

export const defaultCircuitProjectionService = new CircuitProjectionService();
