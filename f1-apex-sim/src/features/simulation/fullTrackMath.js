// Full-circuit lap simulation.
//
// Converts a circuit outline (closed loop of sample points in arbitrary
// units) into the same path shape the corner simulator uses —
// { points: [{ x, y, s, heading, zone, curvature }], totalLength } — scaled to
// the circuit's real lap length, then solves a quasi-static flying-lap speed
// profile with the same point-mass physics model as simulationMath.js.
//
// The result object is deliberately compatible with getPoseAtDistance /
// getSpeedAtTime / getDistanceAtTime so the 3D scene animates a full lap with
// the exact mechanism the Simulation page uses for corners.

const G = 9.81;
const STEP = 4; // metres between resampled path points
const V_MAX = 103; // ~370 km/h
const POWER_ACCEL = 919;
const DRAG_K = 0.00118;
const TRACTION_ACCEL = 14;
const BRAKE_DECEL = 46;
const MIN_RADIUS = 14; // authored outlines are coarse; clamp absurd kinks
const ARC_CURVATURE = 1 / 240; // tighter than this renders kerbs in the scene

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const lateralAccel = (v) => clamp((1.7 + 0.018 * v) * G, 1.7 * G, 3.4 * G);

const cornerSpeedLimit = (radius) => {
  let v = Math.sqrt(2 * G * radius);
  for (let i = 0; i < 6; i += 1) {
    v = Math.sqrt(lateralAccel(v) * radius);
  }
  return Math.min(v, V_MAX);
};

export const parseLengthMeters = (length) => {
  const value = Number.parseFloat(length ?? '');
  if (!Number.isFinite(value) || value <= 0) return 5000;
  // "5.338 km" -> metres; already-metric values pass through.
  return value < 100 ? value * 1000 : value;
};

// Outline sample points ({x, y} in outline units, y down like SVG) -> a
// closed, uniformly resampled path in metres.
export const buildFullTrackPath = (outlinePoints, lengthMeters) => {
  const raw = outlinePoints.map((point) => ({ x: point.x, y: -point.y }));
  const n = raw.length;

  // Perimeter in outline units -> scale factor to real metres.
  let perimeter = 0;
  const cumulative = [0];
  for (let i = 1; i <= n; i += 1) {
    const prev = raw[i - 1];
    const next = raw[i % n];
    perimeter += Math.hypot(next.x - prev.x, next.y - prev.y);
    cumulative.push(perimeter);
  }
  if (perimeter <= 0) return null;

  const scale = lengthMeters / perimeter;
  const totalLength = lengthMeters;
  const count = Math.max(64, Math.round(totalLength / STEP));
  const ds = totalLength / count;

  // Uniform resample along the loop.
  const resampled = [];
  let segment = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (i * ds) / scale;
    while (segment < n - 1 && cumulative[segment + 1] < target) segment += 1;
    const segStart = cumulative[segment];
    const segEnd = cumulative[segment + 1];
    const mix = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
    const a = raw[segment % n];
    const b = raw[(segment + 1) % n];
    resampled.push({
      x: (a.x + (b.x - a.x) * mix) * scale,
      y: (a.y + (b.y - a.y) * mix) * scale,
    });
  }

  // Headings between consecutive points (loop-aware).
  const headings = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const a = resampled[i];
    const b = resampled[(i + 1) % count];
    headings[i] = Math.atan2(b.y - a.y, b.x - a.x);
  }

  const wrapAngle = (angle) => {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  // Signed curvature = dHeading/ds, smoothed to tame authoring noise.
  const rawCurvature = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const prev = headings[(i - 1 + count) % count];
    rawCurvature[i] = wrapAngle(headings[i] - prev) / ds;
  }

  const smoothWindow = 4;
  const curvature = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    let sum = 0;
    for (let offset = -smoothWindow; offset <= smoothWindow; offset += 1) {
      sum += rawCurvature[(i + offset + count) % count];
    }
    let value = sum / (smoothWindow * 2 + 1);
    const maxCurvature = 1 / MIN_RADIUS;
    value = clamp(value, -maxCurvature, maxCurvature);
    curvature[i] = value;
  }

  // Unwrapped headings so pose interpolation never snaps across ±π.
  const unwrapped = new Float64Array(count + 1);
  unwrapped[0] = headings[0];
  for (let i = 1; i <= count; i += 1) {
    unwrapped[i] = unwrapped[i - 1] + wrapAngle(headings[i % count] - headings[i - 1]);
  }

  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const source = resampled[i % count];
    const kappa = Math.abs(curvature[i % count]);
    points.push({
      x: source.x,
      y: source.y,
      s: i * ds,
      heading: unwrapped[i],
      zone: kappa > ARC_CURVATURE ? 'arc' : 'straight',
      curvature: curvature[i % count],
    });
  }

  return { points, totalLength, closed: true };
};

// Flying-lap speed profile over a closed path.
export const solveLapProfile = (path) => {
  const { points } = path;
  const n = points.length;

  const vLimit = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const kappa = Math.abs(points[i].curvature);
    vLimit[i] = kappa > 1e-6 ? cornerSpeedLimit(1 / kappa) : V_MAX;
  }

  // Braking envelope — two backward passes so the limit wraps around the lap.
  const envelope = Float64Array.from(vLimit);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = n - 2; i >= 0; i -= 1) {
      const ds = points[i + 1].s - points[i].s;
      envelope[i] = Math.min(
        envelope[i],
        Math.sqrt(envelope[i + 1] ** 2 + 2 * BRAKE_DECEL * ds),
      );
    }
    envelope[n - 1] = Math.min(envelope[n - 1], envelope[0]);
  }

  // Forward passes — the second pass starts from the first pass's finishing
  // speed, which converges to a flying lap.
  const v = new Float64Array(n);
  let startSpeed = Math.min(envelope[0], vLimit[0]);
  for (let pass = 0; pass < 2; pass += 1) {
    v[0] = Math.min(startSpeed, envelope[0]);
    for (let i = 0; i < n - 1; i += 1) {
      const ds = points[i + 1].s - points[i].s;
      const accel = Math.min(TRACTION_ACCEL, POWER_ACCEL / Math.max(v[i], 12))
        - DRAG_K * v[i] ** 2;
      const next = Math.sqrt(Math.max(v[i] ** 2 + 2 * Math.max(accel, 0) * ds, 16));
      v[i + 1] = Math.min(next, envelope[i + 1]);
    }
    startSpeed = v[n - 1];
  }

  const t = new Float64Array(n);
  for (let i = 1; i < n; i += 1) {
    const ds = points[i].s - points[i - 1].s;
    t[i] = t[i - 1] + ds / Math.max((v[i] + v[i - 1]) / 2, 6);
  }

  return { v, t, totalTime: t[n - 1] };
};

export const formatLapTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`;
};

// Full simulation result for a circuit outline. Shape-compatible with the
// corner simulator result where the 3D scene helpers are concerned.
export const buildLapSimulation = (outlinePoints, circuit) => {
  const lengthMeters = parseLengthMeters(circuit?.stats?.length);
  const path = buildFullTrackPath(outlinePoints, lengthMeters);
  if (!path) return null;

  const profile = solveLapProfile(path);
  const samples = path.points.map((point, index) => ({
    t: profile.t[index],
    d: point.s,
    v: profile.v[index],
  }));

  let minV = Infinity;
  let maxV = 0;
  for (let i = 0; i < profile.v.length; i += 1) {
    minV = Math.min(minV, profile.v[i]);
    maxV = Math.max(maxV, profile.v[i]);
  }

  return {
    path,
    samples,
    totalTime: profile.totalTime,
    formattedTime: formatLapTime(profile.totalTime),
    lengthMeters,
    topSpeed: Math.round(maxV * 3.6),
    minSpeed: Math.round(minV * 3.6),
    avgSpeed: Math.round((path.totalLength / profile.totalTime) * 3.6),
  };
};
