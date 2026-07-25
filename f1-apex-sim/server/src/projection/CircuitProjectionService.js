const finitePoint = (point) => (
  point
  && Number.isFinite(Number(point[0] ?? point.x))
  && Number.isFinite(Number(point[1] ?? point.y))
);

const toPoint = (point) => ({
  x: Number(point[0] ?? point.x),
  y: Number(point[1] ?? point.y),
});

const extractLineCoordinates = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === 'FeatureCollection') {
    return geometry.features.flatMap((feature) => extractLineCoordinates(feature));
  }
  if (geometry.type === 'Feature') return extractLineCoordinates(geometry.geometry);
  if (geometry.type === 'LineString') return geometry.coordinates;
  if (geometry.type === 'MultiLineString') return geometry.coordinates.flat();
  if (Array.isArray(geometry)) return geometry;
  if (Array.isArray(geometry.points)) return geometry.points;
  return [];
};

const boundsOf = (points) => points.reduce((bounds, point) => ({
  minX: Math.min(bounds.minX, point.x),
  minY: Math.min(bounds.minY, point.y),
  maxX: Math.max(bounds.maxX, point.x),
  maxY: Math.max(bounds.maxY, point.y),
}), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

const diagonal = (bounds) => Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

const normalizedId = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-');

const nearestOnSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const x = start.x + dx * t;
  const y = start.y + dy * t;
  return { x, y, t, distance: Math.hypot(point.x - x, point.y - y) };
};

/**
 * Calibrates arbitrary OpenF1 x/y coordinates into registered circuit geometry.
 * Raw coordinates are always retained by LiveStateStore; this service adds a
 * smoothed, snapped point and arc-length progress when geometry is available.
 */
export class CircuitProjectionService {
  constructor({ smoothingFactor = 0.38, maxSamples = 10_000 } = {}) {
    this.smoothingFactor = smoothingFactor;
    this.maxSamples = maxSamples;
    this.circuits = new Map();
    this.driverState = new Map();
  }

  registerCircuit(circuitId, geometry, metadata = {}) {
    const points = extractLineCoordinates(geometry).filter(finitePoint).map(toPoint);
    if (points.length < 2) throw new Error(`Circuit ${circuitId} needs at least two geometry points`);

    const cumulative = [0];
    for (let index = 1; index < points.length; index += 1) {
      cumulative.push(cumulative[index - 1] + Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y,
      ));
    }

    const registered = {
      id: String(circuitId),
      points,
      trackBounds: boundsOf(points),
      cumulative,
      trackLength: cumulative.at(-1),
      sourceBounds: null,
      sampleCount: 0,
      rotationRadians: Number(metadata.rotationRadians ?? metadata.rotation ?? 0) || 0,
      metadata,
      updatedAt: null,
    };
    this.circuits.set(String(circuitId), registered);
    this.circuits.set(normalizedId(circuitId), registered);
    for (const alias of metadata.aliases ?? []) this.registerAlias(alias, circuitId);
  }

  registerAlias(alias, circuitId) {
    const circuit = this.#resolve(circuitId);
    if (!circuit || !alias) return false;
    this.circuits.set(String(alias), circuit);
    this.circuits.set(normalizedId(alias), circuit);
    return true;
  }

  hasCircuit(circuitId) {
    return Boolean(this.#resolve(circuitId));
  }

  clearDriverState() {
    this.driverState.clear();
  }

  project(circuitId, location, { driverNumber = 'unknown', timestamp = Date.now() } = {}) {
    const x = Number(location?.x);
    const y = Number(location?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const circuit = this.#resolve(circuitId);
    if (!circuit) {
      return { x, y, snappedX: null, snappedY: null, progress: null, calibrated: false };
    }

    this.#observe(circuit, { x, y });
    const transformed = this.#transform(circuit, { x, y });
    const driverKey = `${circuit.id}:${driverNumber}`;
    const previous = this.driverState.get(driverKey);

    if (previous && timestamp > previous.timestamp) {
      const elapsed = timestamp - previous.timestamp;
      const sourceJump = Math.hypot(x - previous.rawX, y - previous.rawY);
      const sourceScale = diagonal(circuit.sourceBounds);
      if (circuit.sampleCount > 30 && elapsed < 1_500 && sourceJump > sourceScale * 0.45) {
        return { ...previous.result, rejectedAsOutlier: true };
      }
    }

    const alpha = previous ? this.smoothingFactor : 1;
    const smoothed = previous ? {
      x: previous.result.x + (transformed.x - previous.result.x) * alpha,
      y: previous.result.y + (transformed.y - previous.result.y) * alpha,
    } : transformed;
    const nearest = this.#nearestTrackPoint(circuit, smoothed);
    const snapTolerance = Math.max(1e-9, diagonal(circuit.trackBounds) * 0.08);
    const useSnap = nearest.distance <= snapTolerance;

    const result = {
      x: smoothed.x,
      y: smoothed.y,
      snappedX: useSnap ? nearest.x : smoothed.x,
      snappedY: useSnap ? nearest.y : smoothed.y,
      progress: nearest.progress,
      distanceFromTrack: nearest.distance,
      calibrated: circuit.sampleCount >= 20,
      rejectedAsOutlier: false,
    };
    this.driverState.set(driverKey, { rawX: x, rawY: y, timestamp, result });
    return result;
  }

  getMetadata(circuitId) {
    const circuit = this.#resolve(circuitId);
    if (!circuit) return { circuitId: String(circuitId), calibrated: false, transform: null };
    return {
      circuitId: circuit.id,
      calibrated: circuit.sampleCount >= 20,
      sampleCount: circuit.sampleCount,
      sourceBounds: circuit.sourceBounds,
      targetBounds: circuit.trackBounds,
      rotationRadians: circuit.rotationRadians,
      updatedAt: circuit.updatedAt,
    };
  }

  #observe(circuit, point) {
    if (!circuit.sourceBounds) {
      circuit.sourceBounds = { minX: point.x, maxX: point.x, minY: point.y, maxY: point.y };
    } else if (circuit.sampleCount < this.maxSamples) {
      circuit.sourceBounds.minX = Math.min(circuit.sourceBounds.minX, point.x);
      circuit.sourceBounds.maxX = Math.max(circuit.sourceBounds.maxX, point.x);
      circuit.sourceBounds.minY = Math.min(circuit.sourceBounds.minY, point.y);
      circuit.sourceBounds.maxY = Math.max(circuit.sourceBounds.maxY, point.y);
    }
    circuit.sampleCount += 1;
    circuit.updatedAt = new Date().toISOString();
  }

  #resolve(circuitId) {
    return this.circuits.get(String(circuitId)) ?? this.circuits.get(normalizedId(circuitId));
  }

  #transform(circuit, point) {
    const source = circuit.sourceBounds;
    const target = circuit.trackBounds;
    const sourceWidth = Math.max(1e-9, source.maxX - source.minX);
    const sourceHeight = Math.max(1e-9, source.maxY - source.minY);
    const targetWidth = target.maxX - target.minX;
    const targetHeight = target.maxY - target.minY;
    const sourceCenter = { x: (source.minX + source.maxX) / 2, y: (source.minY + source.maxY) / 2 };
    const targetCenter = { x: (target.minX + target.maxX) / 2, y: (target.minY + target.maxY) / 2 };
    const cosine = Math.cos(circuit.rotationRadians);
    const sine = Math.sin(circuit.rotationRadians);
    const centeredX = point.x - sourceCenter.x;
    const centeredY = point.y - sourceCenter.y;
    const rotatedX = centeredX * cosine - centeredY * sine;
    const rotatedY = centeredX * sine + centeredY * cosine;
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    return {
      x: targetCenter.x + rotatedX * scale,
      y: targetCenter.y + rotatedY * scale,
    };
  }

  #nearestTrackPoint(circuit, point) {
    let best = { x: point.x, y: point.y, distance: Infinity, progress: 0 };
    for (let index = 1; index < circuit.points.length; index += 1) {
      const candidate = nearestOnSegment(point, circuit.points[index - 1], circuit.points[index]);
      if (candidate.distance < best.distance) {
        const segmentLength = circuit.cumulative[index] - circuit.cumulative[index - 1];
        const arcLength = circuit.cumulative[index - 1] + segmentLength * candidate.t;
        best = {
          x: candidate.x,
          y: candidate.y,
          distance: candidate.distance,
          progress: circuit.trackLength > 0 ? arcLength / circuit.trackLength : 0,
        };
      }
    }
    return best;
  }
}
