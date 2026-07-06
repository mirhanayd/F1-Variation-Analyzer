export class ApiError extends Error {
  constructor(message, { status, url, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.payload = payload;
  }
}

export const buildUrl = (baseUrl, path = '', params = {}) => {
  const url = new URL(path, baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, entry));
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
};

export const fetchJson = async (url, { signal, timeoutMs = 15000 } = {}) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const abortFromParent = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortFromParent, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = await response.text();
      }

      throw new ApiError(`Request failed with ${response.status}`, {
        status: response.status,
        url,
        payload,
      });
    }

    return response.json();
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};

export const sleep = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});
