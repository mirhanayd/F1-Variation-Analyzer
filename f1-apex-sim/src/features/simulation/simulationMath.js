const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const DEFAULT_SIMULATION_PARAMS = {
  entrySpeed: 265,
  brakingPoint: 115,
  apexBias: 58,
  steeringAngle: 24,
  throttle: 68,
  exitSpeed: 210,
};

export const calculateSimulation = (params) => {
  const entrySpeed = clamp(Number(params.entrySpeed), 60, 380);
  const exitSpeed = clamp(Number(params.exitSpeed), 60, 360);
  const brakingPoint = clamp(Number(params.brakingPoint), 25, 220);
  const apexBias = clamp(Number(params.apexBias), 0, 100);
  const steeringAngle = clamp(Number(params.steeringAngle), 3, 42);
  const throttle = clamp(Number(params.throttle), 0, 100);

  const cornerRadius = clamp(160 - steeringAngle * 2.15 + Math.abs(apexBias - 55) * 0.55, 35, 180);
  const entryMs = entrySpeed / 3.6;
  const exitMs = exitSpeed / 3.6;
  const brakingTime = brakingPoint / Math.max(18, entryMs);
  const cornerDistance = Math.PI * cornerRadius * 0.42;
  const cornerSpeedMs = Math.max(18, Math.sqrt(1.85 * 9.81 * cornerRadius));
  const throttleRecovery = 1 - throttle / 190;
  const apexPenalty = Math.abs(apexBias - 62) / 100;
  const cornerTime = (cornerDistance / cornerSpeedMs) * (1 + apexPenalty * 0.45);
  const exitDistance = 130;
  const exitTime = exitDistance / Math.max(22, (cornerSpeedMs + exitMs) / 2) * throttleRecovery;
  const totalTime = brakingTime + cornerTime + exitTime;
  const confidence = clamp(100 - Math.abs(apexBias - 62) * 0.7 - Math.abs(entrySpeed - exitSpeed) * 0.08, 40, 98);

  return {
    totalTime,
    formattedTime: totalTime.toFixed(3),
    cornerRadius: Math.round(cornerRadius),
    minSpeed: Math.round(cornerSpeedMs * 3.6),
    exitDelta: Math.round(exitSpeed - cornerSpeedMs * 3.6),
    confidence: Math.round(confidence),
    phases: [
      { label: 'Brake', value: brakingTime },
      { label: 'Rotate', value: cornerTime },
      { label: 'Exit', value: exitTime },
    ],
  };
};
