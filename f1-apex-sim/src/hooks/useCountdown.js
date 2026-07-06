import { useEffect, useMemo, useState } from 'react';
import { getDurationParts } from '../utils/dateTime';

export const useCountdown = (targetIso) => {
  const targetMs = useMemo(() => (targetIso ? Date.parse(targetIso) : null), [targetIso]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!targetMs || Number.isNaN(targetMs)) {
      return {
        status: 'idle',
        remainingMs: 0,
        parts: getDurationParts(0),
      };
    }

    const remainingMs = targetMs - nowMs;

    return {
      status: remainingMs > 0 ? 'counting' : 'elapsed',
      remainingMs,
      parts: getDurationParts(remainingMs),
    };
  }, [nowMs, targetMs]);
};
