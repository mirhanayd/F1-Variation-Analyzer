import { backendUrl } from '../config/backend';

const DEFAULT_TIMEOUT_MS = 15_000;

const request = async (path, { signal, timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort('Backend request timed out'), timeoutMs);

  try {
    const response = await fetch(backendUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? body?.message ?? `Backend request failed (${response.status})`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
};

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
};

export const backendApi = {
  health: (options) => request('/api/health', options),
  getLiveStatus: (options) => request('/api/live/status', options),
  getCurrentSession: (options) => request('/api/live/sessions/current', options),
  getLiveSnapshot: (options) => request('/api/live/snapshot', options),
  getReplaySessions: (params, options) => request(`/api/replay/sessions${toQueryString(params)}`, options),
  getReplay: (sessionKey, params, options) => request(
    `/api/replay/${encodeURIComponent(sessionKey)}${toQueryString(params)}`,
    options,
  ),
  openF1: (endpoint, params, options) => request(
    `/api/openf1/${encodeURIComponent(endpoint)}${toQueryString(params)}`,
    options,
  ),
};

export default backendApi;

