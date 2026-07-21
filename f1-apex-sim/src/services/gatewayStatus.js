import { backendUrl } from '../config/backend';

/**
 * Shared gateway availability state.
 * Both JolpicaService and OpenF1Service read/write through this module so a
 * single failed probe marks the gateway as down for ALL services at once.
 */

const RECHECK_INTERVAL_MS = 60_000;   // re-probe every 60 s after a failure
const PROBE_TIMEOUT_MS = 2_000;       // 2 s timeout for the health probe

let gatewayDown = false;
let lastProbeTime = 0;
let probeInFlight = null;             // dedup concurrent probes

/** Quick non-blocking health check against the gateway. */
const probeGateway = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(backendUrl('/api/health'), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Returns `true` when the gateway is known to be unavailable and callers
 * should go straight to the public API.
 */
export const isGatewayDown = () => gatewayDown;

/**
 * Mark the gateway as down right now (called after a failed request).
 */
export const markGatewayDown = () => {
  gatewayDown = true;
  lastProbeTime = Date.now();
};

/**
 * Mark the gateway as up (called after a successful request).
 */
export const markGatewayUp = () => {
  gatewayDown = false;
};

/**
 * Returns true if enough time has passed to re-probe the gateway.
 */
export const shouldRecheck = () =>
  !gatewayDown || Date.now() - lastProbeTime >= RECHECK_INTERVAL_MS;

/**
 * Fire-and-forget initial probe. Called once when the module is first imported
 * so that by the time the user navigates to a data-heavy page the status is
 * already known.
 */
export const ensureProbed = () => {
  if (probeInFlight) return probeInFlight;
  probeInFlight = probeGateway().then((ok) => {
    gatewayDown = !ok;
    lastProbeTime = Date.now();
    if (!ok) console.info('Gateway not reachable — using direct API fallback.');
    probeInFlight = null;
  });
  return probeInFlight;
};

// Kick off the probe immediately on import so the result is ready before
// any component mounts and starts fetching data.
ensureProbed();
