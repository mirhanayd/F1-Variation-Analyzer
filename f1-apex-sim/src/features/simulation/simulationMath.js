// PITWALL corner simulator — simplified single-car physics.
//
// The model is a quasi-static point-mass solver over a generated corner path:
//   entry straight -> arc (or S-shaped chicane) -> exit straight.
// Numbers are tuned to feel like a modern F1 car, not to be survey-accurate.

const G = 9.81;
const STEP = 2; // metres between path samples
const V_MAX = 103; // ~370 km/h
const POWER_ACCEL = 919; // P/m (W/kg) -> a = POWER_ACCEL / v
const DRAG_K = 0.00118; // drag decel = k * v^2
const TRACTION_ACCEL = 14; // m/s^2 cap when power-limited accel exceeds grip
const BRAKE_DECEL = 46; // ~4.7g peak braking
const CHICANE_LINK = 14; // straight between chicane arcs, metres

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const kmh = (ms) => ms * 3.6;
const ms = (kmhValue) => kmhValue / 3.6;
const deg2rad = (deg) => (deg * Math.PI) / 180;

// Speed-dependent lateral grip (downforce): ~1.7g at low speed, up to ~3.4g.
const lateralAccel = (v) => clamp((1.7 + 0.018 * v) * G, 1.7 * G, 3.4 * G);

// Ideal steering lock for a corner radius (scaled bicycle model, degrees).
export const idealSteeringForRadius = (radius) => clamp(
  (Math.atan(3.6 / Math.max(radius, 5)) * 180) / Math.PI * 1.9,
  3,
  40,
);

export const PARAMETER_LIMITS = {
  entrySpeed: { min: 120, max: 360, unit: 'km/h' },
  brakingPoint: { min: 20, max: 260, unit: 'm' },
  apexBias: { min: 0, max: 100, unit: '%' },
  steeringAngle: { min: 3, max: 40, unit: '°' },
  throttle: { min: 20, max: 100, unit: '%' },
  racingLine: { min: 0, max: 100, unit: '%' },
  exitSpeed: { min: 120, max: 360, unit: 'km/h' },
};

const cornerSpeedLimit = (radius) => {
  // Iterate v = sqrt(aLat(v) * r) — converges quickly.
  let v = Math.sqrt(2 * G * radius);
  for (let i = 0; i < 6; i += 1) {
    v = Math.sqrt(lateralAccel(v) * radius);
  }
  return Math.min(v, V_MAX);
};

// Effective corner radius from setup choices.
const effectiveRadius = (corner, params) => {
  const lineFactor = 0.8 + (params.racingLine / 100) * 0.5; // tight..wide
  const ideal = idealSteeringForRadius(corner.radius);
  const steerFactor = clamp((ideal / params.steeringAngle) ** 0.9, 0.55, 1.45);
  return Math.max(8, corner.radius * lineFactor * steerFactor);
};

// Grip penalty for steering far from the ideal lock (scrubbing).
const steeringGripFactor = (corner, params) => {
  const ideal = idealSteeringForRadius(corner.radius);
  const deviation = Math.abs(params.steeringAngle - ideal) / ideal;
  return 1 - clamp(deviation * 0.16, 0, 0.3);
};

// Builds the 2D path (metres). Car starts at origin heading +X.
export const buildCornerPath = (corner, params) => {
  const radius = effectiveRadius(corner, params);
  const angleRad = deg2rad(clamp(corner.angle, 20, 190));
  const turnSign = corner.direction === 'left' ? 1 : -1;
  const isChicane = corner.type === 'chicane';

  const points = [];
  let x = 0;
  let y = 0;
  let heading = 0;
  let s = 0;

  const push = (zone, curvature) => {
    points.push({ x, y, s, heading, zone, curvature });
  };

  const straight = (length, zone) => {
    const steps = Math.max(1, Math.round(length / STEP));
    const ds = length / steps;
    for (let i = 0; i < steps; i += 1) {
      x += Math.cos(heading) * ds;
      y += Math.sin(heading) * ds;
      s += ds;
      push(zone, 0);
    }
  };

  const arc = (arcAngle, sign, zone) => {
    const arcLength = radius * arcAngle;
    const steps = Math.max(2, Math.round(arcLength / STEP));
    const dTheta = (arcAngle / steps) * sign;
    const ds = arcLength / steps;
    for (let i = 0; i < steps; i += 1) {
      heading += dTheta;
      x += Math.cos(heading) * ds;
      y += Math.sin(heading) * ds;
      s += ds;
      push(zone, 1 / radius);
    }
  };

  push('entry', 0);
  straight(corner.entryLength, 'entry');
  const arcStart = s;

  if (isChicane) {
    arc(angleRad / 2, turnSign, 'arc');
    straight(CHICANE_LINK, 'arc');
    arc(angleRad / 2, -turnSign, 'arc');
  } else {
    arc(angleRad, turnSign, 'arc');
  }

  const arcEnd = s;
  straight(corner.exitLength, 'exit');

  return {
    points,
    totalLength: s,
    arcStart,
    arcEnd,
    radius,
  };
};

const findIndexAtDistance = (points, distance) => {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid].s < distance) low = mid + 1;
    else high = mid;
  }
  return low;
};

export const DEFAULT_SIMULATION_PARAMS = {
  entrySpeed: 280,
  brakingPoint: 110,
  apexBias: 55,
  steeringAngle: 16,
  throttle: 85,
  racingLine: 60,
  exitSpeed: 280,
};

// Sensible starting setup for a given corner.
export const getDefaultParamsForCorner = (corner) => {
  const vLimit = cornerSpeedLimit(effectiveRadius(corner, {
    racingLine: 60,
    steeringAngle: idealSteeringForRadius(corner.radius),
  }));
  const entry = clamp(Math.round(kmh(Math.min(V_MAX, vLimit + ms(150)))), 160, 340);
  const brakeDistance = ((ms(entry) ** 2 - vLimit ** 2) / (2 * BRAKE_DECEL * 0.82)) * 1.12;

  return {
    entrySpeed: entry,
    brakingPoint: clamp(Math.round(brakeDistance + 12), PARAMETER_LIMITS.brakingPoint.min, Math.min(PARAMETER_LIMITS.brakingPoint.max, corner.entryLength - 20)),
    apexBias: 55,
    steeringAngle: Math.round(idealSteeringForRadius(corner.radius)),
    throttle: 88,
    racingLine: 60,
    exitSpeed: clamp(Math.round(kmh(vLimit) + 90), 160, 350),
  };
};

const solveProfile = (corner, params, path) => {
  const { points } = path;
  const n = points.length;
  const gripFactor = steeringGripFactor(corner, params);

  // Per-point cornering speed limit.
  const vLimit = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    if (points[i].curvature > 0) {
      const r = 1 / points[i].curvature;
      vLimit[i] = cornerSpeedLimit(r) * gripFactor;
    } else {
      vLimit[i] = V_MAX;
    }
  }

  // Apex bias: late apex sacrifices a little mid-corner speed but allows
  // earlier throttle; early apex is faster in but delays acceleration.
  const bias = params.apexBias / 100;
  const apexDistance = path.arcStart + (path.arcEnd - path.arcStart) * (0.3 + bias * 0.45);
  const apexIndex = findIndexAtDistance(points, apexDistance);
  const midPenalty = 1 - Math.abs(bias - 0.5) * 0.06;
  for (let i = 0; i < n; i += 1) {
    if (points[i].curvature > 0) vLimit[i] *= midPenalty;
  }

  // Physical envelope (perfect braking) — backward pass.
  const envelope = new Float64Array(n);
  envelope[n - 1] = vLimit[n - 1];
  for (let i = n - 2; i >= 0; i -= 1) {
    const ds = points[i + 1].s - points[i].s;
    envelope[i] = Math.min(vLimit[i], Math.sqrt(envelope[i + 1] ** 2 + 2 * BRAKE_DECEL * ds));
  }

  // Driver forward pass with the chosen setup.
  const brakeStart = Math.max(0, path.arcStart - params.brakingPoint);
  const throttleScale = params.throttle / 100;
  const exitCap = ms(params.exitSpeed);

  const v = new Float64Array(n);
  const t = new Float64Array(n);
  v[0] = Math.min(ms(params.entrySpeed), envelope[0]);

  let scrubTime = 0;
  let ranWide = false;
  let overSlowed = false;
  let peakBrakeG = 0;
  let peakLatG = 0;

  for (let i = 0; i < n - 1; i += 1) {
    const ds = points[i + 1].s - points[i].s;
    const current = v[i];
    const inBrakeZone = points[i].s >= brakeStart && points[i].s < apexDistance;
    const pastApex = points[i].s >= apexDistance;

    let next;
    if (inBrakeZone && current > vLimit[Math.min(i + 1, n - 1)]) {
      next = Math.sqrt(Math.max(current ** 2 - 2 * BRAKE_DECEL * 0.92 * ds, 0));
      peakBrakeG = Math.max(peakBrakeG, (BRAKE_DECEL * 0.92) / G);
    } else if (pastApex || (!inBrakeZone && points[i].curvature === 0)) {
      const accel = Math.min(TRACTION_ACCEL, (POWER_ACCEL / Math.max(current, 12)) * throttleScale)
        - DRAG_K * current ** 2;
      next = Math.sqrt(Math.max(current ** 2 + 2 * Math.max(accel, 0) * ds, 1));
      if (points[i].zone !== 'entry') next = Math.min(next, exitCap);
      else next = Math.min(next, ms(params.entrySpeed));
    } else {
      next = current;
    }

    // Cornering limit — carrying too much speed scrubs and runs wide.
    const limit = vLimit[i + 1];
    if (next > limit) {
      if (next > limit * 1.04 && points[i + 1].curvature > 0) {
        ranWide = true;
        scrubTime += ((next - limit) / limit) * 0.6;
      }
      next = limit;
    }

    if (points[i + 1].curvature > 0) {
      peakLatG = Math.max(peakLatG, (next ** 2 * points[i + 1].curvature) / G);
    }

    v[i + 1] = next;
    t[i + 1] = t[i] + ds / Math.max((current + next) / 2, 4);
  }

  // Braking much earlier than needed leaves obvious lap time on the table.
  const arcIndex = findIndexAtDistance(points, path.arcStart);
  if (v[arcIndex] < vLimit[arcIndex] * 0.86) overSlowed = true;

  return {
    v,
    t,
    vLimit,
    envelope,
    apexIndex,
    apexDistance,
    brakeStart,
    totalTime: t[n - 1] + scrubTime,
    scrubTime,
    ranWide,
    overSlowed,
    peakBrakeG,
    peakLatG,
  };
};

// The reference "perfect" run: ideal setup for this corner geometry.
const solveOptimalTime = (corner) => {
  const params = {
    ...getDefaultParamsForCorner(corner),
    apexBias: 55,
    throttle: 100,
    racingLine: 72,
    exitSpeed: PARAMETER_LIMITS.exitSpeed.max,
    entrySpeed: PARAMETER_LIMITS.entrySpeed.max,
  };
  params.steeringAngle = idealSteeringForRadius(corner.radius);

  const path = buildCornerPath(corner, params);
  const { points } = path;
  const n = points.length;

  const vLimit = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    vLimit[i] = points[i].curvature > 0
      ? cornerSpeedLimit(1 / points[i].curvature)
      : V_MAX;
  }

  const envelope = new Float64Array(n);
  envelope[n - 1] = vLimit[n - 1];
  for (let i = n - 2; i >= 0; i -= 1) {
    const ds = points[i + 1].s - points[i].s;
    envelope[i] = Math.min(vLimit[i], Math.sqrt(envelope[i + 1] ** 2 + 2 * BRAKE_DECEL * ds));
  }

  const v = new Float64Array(n);
  v[0] = Math.min(ms(params.entrySpeed), envelope[0]);
  let time = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const ds = points[i + 1].s - points[i].s;
    const accel = Math.min(TRACTION_ACCEL, POWER_ACCEL / Math.max(v[i], 12)) - DRAG_K * v[i] ** 2;
    let next = Math.sqrt(Math.max(v[i] ** 2 + 2 * Math.max(accel, 0) * ds, 1));
    next = Math.min(next, envelope[i + 1]);
    v[i + 1] = next;
    time += ds / Math.max((v[i] + next) / 2, 4);
  }

  return time;
};

const ratingForDelta = (delta, flags) => {
  if (flags.ranWide) return { grade: 'Scrappy', note: 'Carried too much speed — the car ran wide and scrubbed time.' };
  if (delta < 0.15) return { grade: 'Perfect', note: 'Setup is within a tenth and a half of the theoretical optimum.' };
  if (delta < 0.45) return { grade: 'Great', note: 'Strong section — small gains left in braking or exit phase.' };
  if (delta < 1.0) {
    return { grade: 'Solid', note: 'Clean but conservative. Brake later or commit to more exit throttle.' };
  }
  return { grade: 'Off the pace', note: 'Significant time left on the table — revisit braking point and racing line.' };
};

export const calculateSimulation = (corner, rawParams) => {
  const params = {
    entrySpeed: clamp(Number(rawParams.entrySpeed), PARAMETER_LIMITS.entrySpeed.min, PARAMETER_LIMITS.entrySpeed.max),
    brakingPoint: clamp(Number(rawParams.brakingPoint), PARAMETER_LIMITS.brakingPoint.min, PARAMETER_LIMITS.brakingPoint.max),
    apexBias: clamp(Number(rawParams.apexBias), 0, 100),
    steeringAngle: clamp(Number(rawParams.steeringAngle), PARAMETER_LIMITS.steeringAngle.min, PARAMETER_LIMITS.steeringAngle.max),
    throttle: clamp(Number(rawParams.throttle), PARAMETER_LIMITS.throttle.min, PARAMETER_LIMITS.throttle.max),
    racingLine: clamp(Number(rawParams.racingLine), 0, 100),
    exitSpeed: clamp(Number(rawParams.exitSpeed), PARAMETER_LIMITS.exitSpeed.min, PARAMETER_LIMITS.exitSpeed.max),
  };

  const path = buildCornerPath(corner, params);
  const profile = solveProfile(corner, params, path);
  const optimalTime = solveOptimalTime(corner);
  const delta = profile.totalTime - optimalTime;

  const { points } = path;
  const arcIndex = findIndexAtDistance(points, path.arcStart);
  let minV = Infinity;
  for (let i = 0; i < profile.v.length; i += 1) minV = Math.min(minV, profile.v[i]);

  const samples = points.map((point, index) => ({
    t: profile.t[index],
    d: point.s,
    v: profile.v[index],
  }));

  const flags = {
    ranWide: profile.ranWide,
    overSlowed: profile.overSlowed,
  };

  const phaseTime = (fromS, toS) => {
    const from = profile.t[findIndexAtDistance(points, fromS)];
    const to = profile.t[findIndexAtDistance(points, toS)];
    return Math.max(0, to - from);
  };

  return {
    corner,
    params,
    path,
    samples,
    totalTime: profile.totalTime,
    formattedTime: profile.totalTime.toFixed(3),
    optimalTime,
    formattedOptimal: optimalTime.toFixed(3),
    delta,
    formattedDelta: `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`,
    rating: ratingForDelta(delta, flags),
    flags,
    minSpeed: Math.round(kmh(minV)),
    apexSpeed: Math.round(kmh(profile.v[profile.apexIndex] ?? minV)),
    entrySpeed: Math.round(kmh(profile.v[arcIndex])),
    finalSpeed: Math.round(kmh(profile.v[profile.v.length - 1])),
    peakLateralG: profile.peakLatG.toFixed(1),
    peakBrakingG: profile.peakBrakeG.toFixed(1),
    markers: {
      brakeDistance: profile.brakeStart,
      apexDistance: profile.apexDistance,
      arcStart: path.arcStart,
      arcEnd: path.arcEnd,
      totalLength: path.totalLength,
    },
    phases: [
      { label: 'Approach', value: phaseTime(0, profile.brakeStart) },
      { label: 'Braking', value: phaseTime(profile.brakeStart, path.arcStart) },
      { label: 'Cornering', value: phaseTime(path.arcStart, path.arcEnd) },
      { label: 'Exit', value: phaseTime(path.arcEnd, path.totalLength) },
    ],
  };
};

// Neutral geometry used for the 3D track ribbon so the surface stays put
// while the driver's chosen line moves within it.
export const NEUTRAL_PATH_PARAMS = {
  racingLine: 50,
  steeringAngle: null, // resolved to the ideal lock per corner
};

export const buildNeutralPath = (corner) => buildCornerPath(corner, {
  racingLine: 50,
  steeringAngle: idealSteeringForRadius(corner.radius),
});

export const getSpeedAtTime = (samples, time) => {
  if (!samples.length) return 0;
  if (time <= samples[0].t) return samples[0].v;
  if (time >= samples[samples.length - 1].t) return samples[samples.length - 1].v;

  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].t < time) low = mid + 1;
    else high = mid;
  }
  const after = samples[low];
  const before = samples[Math.max(0, low - 1)];
  const span = after.t - before.t;
  const mix = span > 0 ? (time - before.t) / span : 0;
  return before.v + (after.v - before.v) * mix;
};

export const getDistanceAtTime = (samples, time) => {
  if (!samples.length) return 0;
  if (time <= samples[0].t) return samples[0].d;
  if (time >= samples[samples.length - 1].t) return samples[samples.length - 1].d;

  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].t < time) low = mid + 1;
    else high = mid;
  }
  const after = samples[low];
  const before = samples[Math.max(0, low - 1)];
  const span = after.t - before.t;
  const mix = span > 0 ? (time - before.t) / span : 0;
  return before.d + (after.d - before.d) * mix;
};

export const getPoseAtDistance = (path, distance) => {
  const { points } = path;
  if (!points.length) return { x: 0, y: 0, heading: 0 };

  const clamped = clamp(distance, 0, path.totalLength);
  const index = findIndexAtDistance(points, clamped);
  const after = points[index];
  const before = points[Math.max(0, index - 1)];
  const span = after.s - before.s;
  const mix = span > 0 ? (clamped - before.s) / span : 0;

  let dHeading = after.heading - before.heading;
  if (dHeading > Math.PI) dHeading -= Math.PI * 2;
  if (dHeading < -Math.PI) dHeading += Math.PI * 2;

  return {
    x: before.x + (after.x - before.x) * mix,
    y: before.y + (after.y - before.y) * mix,
    heading: before.heading + dHeading * mix,
    curvature: after.curvature,
  };
};
