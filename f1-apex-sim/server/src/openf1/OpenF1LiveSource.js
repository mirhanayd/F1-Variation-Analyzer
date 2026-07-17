import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { connect as connectMqtt } from 'mqtt';

export const REQUIRED_OPENF1_TOPICS = Object.freeze([
  'v1/location',
  'v1/car_data',
  'v1/position',
  'v1/intervals',
  'v1/laps',
  'v1/drivers',
]);

export const OPTIONAL_OPENF1_TOPICS = Object.freeze([
  'v1/sessions',
  'v1/meetings',
  'v1/race_control',
  'v1/weather',
]);

export const OPENF1_TOPICS = Object.freeze([
  ...REQUIRED_OPENF1_TOPICS,
  ...OPTIONAL_OPENF1_TOPICS,
]);

const makeClientId = () => `pitwall-gateway-${randomBytes(6).toString('hex')}`;

const parsePayload = (buffer) => {
  const decoded = buffer.toString('utf8');
  const value = JSON.parse(decoded);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [value];
};

/** A single, server-side MQTT connection shared by every frontend client. */
export class OpenF1LiveSource extends EventEmitter {
  constructor(config, tokenManager, {
    mqttConnect = connectMqtt,
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    random = Math.random,
  } = {}) {
    super();
    this.config = config;
    this.tokenManager = tokenManager;
    this.mqttConnect = mqttConnect;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.random = random;
    this.client = null;
    this.stopped = true;
    this.connecting = false;
    this.state = 'idle';
    this.connectedAt = null;
    this.lastMessageAt = null;
    this.lastErrorAt = null;
    this.reconnectAttempt = 0;
    this.nextRetryAt = null;
    this.reconnectTimer = null;
    this.tokenTimer = null;
    this.idleTimer = null;
    this.inactiveEmitted = false;
    this.rateWindowStartedAt = 0;
    this.rateWindowCount = 0;
    this.droppedMessages = 0;
    this.parseErrors = 0;
    this.currentMetadata = [];
  }

  isConfigured() {
    return this.tokenManager.isConfigured();
  }

  getStatus() {
    return {
      state: this.state,
      credentialsConfigured: this.isConfigured(),
      transport: this.config.mqttTransport,
      topics: OPENF1_TOPICS,
      connectedAt: this.connectedAt ? new Date(this.connectedAt).toISOString() : null,
      lastMessageAt: this.lastMessageAt ? new Date(this.lastMessageAt).toISOString() : null,
      lastErrorAt: this.lastErrorAt ? new Date(this.lastErrorAt).toISOString() : null,
      reconnectAttempt: this.reconnectAttempt,
      nextRetryAt: this.nextRetryAt ? new Date(this.nextRetryAt).toISOString() : null,
      droppedMessages: this.droppedMessages,
      parseErrors: this.parseErrors,
    };
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;

    if (!this.isConfigured()) {
      this.#setState('disabled');
      this.emit('unavailable', { reason: 'credentials-missing' });
      return;
    }

    this.#connect();
  }

  stop() {
    this.stopped = true;
    this.connecting = false;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.tokenTimer);
    clearInterval(this.idleTimer);
    this.reconnectTimer = null;
    this.tokenTimer = null;
    this.idleTimer = null;
    this.currentMetadata = [];
    this.#disposeClient();
    this.#setState('idle');
  }

  async #connect() {
    if (this.stopped || this.connecting || this.client) return;
    this.connecting = true;
    this.nextRetryAt = null;
    this.#setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    let tokenRecord;
    try {
      tokenRecord = await this.tokenManager.getTokenRecord();
    } catch {
      this.connecting = false;
      this.lastErrorAt = this.now();
      this.#setState('error');
      this.emit('unavailable', { reason: 'authentication-failed' });
      this.#scheduleReconnect('authentication-failed');
      return;
    }

    if (this.stopped) {
      this.connecting = false;
      return;
    }

    const brokerUrl = this.config.mqttTransport === 'wss'
      ? this.config.mqttWsUrl
      : `mqtts://${this.config.mqttHost}:${this.config.mqttPort}`;

    let client;
    try {
      client = this.mqttConnect(brokerUrl, {
        username: this.config.username || 'pitwall-gateway',
        password: tokenRecord.accessToken,
        clientId: makeClientId(),
        clean: true,
        keepalive: 30,
        connectTimeout: this.config.connectTimeoutMs,
        reconnectPeriod: 0,
        rejectUnauthorized: true,
        protocolVersion: 4,
      });
    } catch {
      this.connecting = false;
      this.lastErrorAt = this.now();
      this.#setState('error');
      this.#scheduleReconnect('connect-failed');
      return;
    }

    this.client = client;
    client.on('connect', () => this.#onConnect(tokenRecord));
    client.on('message', (topic, payload) => this.#onMessage(topic, payload));
    client.on('error', () => {
      this.lastErrorAt = this.now();
      this.emit('source-error', { code: 'mqtt-error' });
    });
    client.on('close', () => this.#onClose());
    client.on('offline', () => {
      if (!this.stopped) this.#setState('reconnecting');
    });
  }

  #onConnect(tokenRecord) {
    if (!this.client || this.stopped) return;
    this.connecting = false;
    this.connectedAt = this.now();
    this.lastMessageAt = null;
    this.inactiveEmitted = false;
    this.currentMetadata = [];
    this.reconnectAttempt = 0;

    this.client.subscribe(OPENF1_TOPICS, { qos: 0 }, (error) => {
      if (error) {
        this.lastErrorAt = this.now();
        this.#replaceConnection('subscribe-failed');
        return;
      }
      this.#setState('connected');
      this.emit('connected', this.getStatus());
      // MQTT session/meeting messages are not guaranteed to be replayed when
      // the gateway joins mid-session. Cache authenticated REST metadata and
      // flush it immediately before (or during) the first real live samples.
      void this.#hydrateCurrentMetadata(tokenRecord.accessToken);
    });

    clearTimeout(this.tokenTimer);
    const refreshIn = Math.max(
      10_000,
      tokenRecord.expiresAt - this.now() - this.config.tokenRefreshSkewMs,
    );
    this.tokenTimer = setTimeout(() => {
      this.tokenManager.invalidate();
      this.#replaceConnection('token-refresh', 0);
    }, refreshIn);
    this.tokenTimer.unref?.();

    clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      const activityAt = this.lastMessageAt || this.connectedAt;
      if (
        !this.inactiveEmitted
        && activityAt
        && this.now() - activityAt >= this.config.sessionIdleTimeoutMs
      ) {
        this.inactiveEmitted = true;
        this.emit('inactive', { reason: 'no-active-session' });
      }
    }, Math.min(15_000, Math.max(2_000, this.config.sessionIdleTimeoutMs / 3)));
    this.idleTimer.unref?.();
  }

  #onMessage(topic, payload) {
    if (!OPENF1_TOPICS.includes(topic)) return;
    if (payload.length > this.config.maxPayloadBytes || !this.#withinRateLimit()) {
      this.droppedMessages += 1;
      return;
    }

    let records;
    try {
      records = parsePayload(payload);
    } catch {
      this.parseErrors += 1;
      return;
    }

    this.lastMessageAt = this.now();
    this.inactiveEmitted = false;
    if (this.state !== 'live') this.#setState('live');
    this.#flushCurrentMetadata();

    for (const record of records) {
      if (record && typeof record === 'object') {
        this.emit('message', { topic, data: record, receivedAt: this.lastMessageAt });
      }
    }
  }

  #withinRateLimit() {
    const now = this.now();
    if (now - this.rateWindowStartedAt >= 1_000) {
      this.rateWindowStartedAt = now;
      this.rateWindowCount = 0;
    }
    this.rateWindowCount += 1;
    return this.rateWindowCount <= this.config.maxMessagesPerSecond;
  }

  async #hydrateCurrentMetadata(accessToken) {
    const fetchRecords = async (endpoint, filterName, filterValue) => {
      const url = new URL(`${this.config.apiUrl}/${endpoint}`);
      url.searchParams.set(filterName, String(filterValue));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.connectTimeoutMs);
      timeout.unref?.();
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });
        if (!response.ok) return [];
        const text = await response.text();
        if (Buffer.byteLength(text) > this.config.maxPayloadBytes) return [];
        const value = JSON.parse(text);
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    };

    const sessions = await fetchRecords('sessions', 'session_key', 'latest');
    const meetingKey = sessions[0]?.meeting_key ?? 'latest';
    const meetings = await fetchRecords('meetings', 'meeting_key', meetingKey);
    if (this.stopped) return;
    this.currentMetadata = [
      ...meetings.map((data) => ({ topic: 'v1/meetings', data })),
      ...sessions.map((data) => ({ topic: 'v1/sessions', data })),
    ];
    if (this.state === 'live') this.#flushCurrentMetadata();
  }

  #flushCurrentMetadata() {
    if (this.currentMetadata.length === 0) return;
    const receivedAt = this.now();
    for (const value of this.currentMetadata) {
      this.emit('message', { ...value, receivedAt });
    }
    this.currentMetadata = [];
  }

  #onClose() {
    this.client = null;
    this.connecting = false;
    clearInterval(this.idleTimer);
    this.idleTimer = null;
    if (this.stopped) return;
    this.emit('unavailable', { reason: 'connection-closed' });
    this.#scheduleReconnect('connection-closed');
  }

  #replaceConnection(reason, delay = null) {
    const client = this.client;
    this.client = null;
    this.connecting = false;
    if (client) {
      client.removeAllListeners();
      client.end(true);
    }
    this.#scheduleReconnect(reason, delay);
  }

  #disposeClient() {
    const client = this.client;
    this.client = null;
    if (client) {
      client.removeAllListeners();
      client.end(true);
    }
  }

  #scheduleReconnect(reason, delayOverride = null) {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const exponential = Math.min(60_000, 1_000 * (2 ** Math.min(6, this.reconnectAttempt - 1)));
    const jittered = Math.round(exponential * (0.75 + this.random() * 0.5));
    const delay = delayOverride ?? jittered;
    this.nextRetryAt = this.now() + delay;
    this.#setState('reconnecting');
    this.emit('reconnecting', { reason, delayMs: delay, attempt: this.reconnectAttempt });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.#connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  #setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('status', this.getStatus());
  }
}
