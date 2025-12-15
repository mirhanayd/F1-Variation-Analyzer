export const CONSTANTS = {
    GRAVITY: 9.81,
    F1_GRIP_COEFF: 1.9, 
  };
  
  export const calculateMaxSpeed = (baseRadius, bias) => {
    // Geç apex (Bias > 0.5) çıkış yarıçapını artırır
    const effectiveRadius = baseRadius + (bias * 45); 
    const speedMS = Math.sqrt(CONSTANTS.F1_GRIP_COEFF * CONSTANTS.GRAVITY * effectiveRadius);
    return Math.round(speedMS * 3.6); // km/h
  };
  
  export const calculateSectorTime = (bias) => {
    // İdeal F1 Apexi genelde 0.7 civarıdır
    const idealBias = 0.7;
    const baseTime = 5.100; 
    const penalty = Math.abs(bias - idealBias) * 0.8; 
    return (baseTime + penalty).toFixed(3);
  };