import { EventEmitter } from 'node:events';

export class OpenF1AuthError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message, { cause });
    this.name = 'OpenF1AuthError';
    this.status = status;
  }
}

/**
 * Keeps sponsor credentials and OAuth access tokens entirely inside the server.
 * Concurrent callers share one token request, avoiding a reconnect stampede.
 */
export class OpenF1TokenManager extends EventEmitter {
  constructor(config, { fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
    super();
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.record = null;
    this.pending = null;
  }

  isConfigured() {
    return Boolean(this.config.username && this.config.password);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      hasToken: Boolean(this.record?.accessToken),
      expiresAt: this.record?.expiresAt ? new Date(this.record.expiresAt).toISOString() : null,
      refreshing: Boolean(this.pending),
    };
  }

  invalidate() {
    this.record = null;
  }

  async getTokenRecord({ forceRefresh = false } = {}) {
    if (!this.isConfigured()) {
      throw new OpenF1AuthError('OpenF1 sponsor credentials are not configured');
    }

    const usableUntil = this.now() + this.config.tokenRefreshSkewMs;
    if (!forceRefresh && this.record?.accessToken && this.record.expiresAt > usableUntil) {
      return this.record;
    }

    if (this.pending) return this.pending;

    this.pending = this.#requestToken()
      .then((record) => {
        this.record = record;
        this.emit('refreshed', this.getStatus());
        return record;
      })
      .finally(() => {
        this.pending = null;
      });

    return this.pending;
  }

  async #requestToken() {
    const body = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.connectTimeoutMs);
    timeout.unref?.();

    let response;
    try {
      response = await this.fetchImpl(this.config.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      throw new OpenF1AuthError('Unable to reach the OpenF1 token service', { cause: error });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Never include an upstream response body: it can contain account details.
      throw new OpenF1AuthError('OpenF1 rejected the sponsor credentials', {
        status: response.status,
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new OpenF1AuthError('OpenF1 returned an invalid token response', { cause: error });
    }

    if (typeof payload.access_token !== 'string' || payload.access_token.length < 8) {
      throw new OpenF1AuthError('OpenF1 token response did not include an access token');
    }

    const expiresInSeconds = Math.max(60, Number(payload.expires_in) || 3_600);
    return Object.freeze({
      accessToken: payload.access_token,
      tokenType: payload.token_type || 'bearer',
      issuedAt: this.now(),
      expiresAt: this.now() + expiresInSeconds * 1_000,
    });
  }
}
