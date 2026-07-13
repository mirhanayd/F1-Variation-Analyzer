const stripTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const configuredHttpUrl = stripTrailingSlash(import.meta.env.VITE_BACKEND_HTTP_URL ?? '');

export const BACKEND_HTTP_URL = configuredHttpUrl || 'http://localhost:3001';

const deriveWebSocketUrl = (httpUrl) => {
  try {
    const url = new URL(httpUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ws/live`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return 'ws://localhost:3001/ws/live';
  }
};

export const BACKEND_WS_URL = stripTrailingSlash(
  import.meta.env.VITE_BACKEND_WS_URL || deriveWebSocketUrl(BACKEND_HTTP_URL),
);

export const backendUrl = (path = '') => {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_HTTP_URL}${safePath}`;
};

export const backendWsUrl = (params = {}) => {
  const url = new URL(BACKEND_WS_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

