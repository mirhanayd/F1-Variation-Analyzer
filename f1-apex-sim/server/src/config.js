import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const numberFromEnv = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

const booleanFromEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
};

const originsFromEnv = (raw = '') => raw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const loadConfig = () => Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: numberFromEnv('LIVE_GATEWAY_PORT', 8787, { min: 1, max: 65535 }),
  frontendOrigins: originsFromEnv(process.env.FRONTEND_ORIGIN),
  openF1: Object.freeze({
    username: process.env.OPENF1_USERNAME?.trim() || '',
    password: process.env.OPENF1_PASSWORD || '',
    tokenUrl: process.env.OPENF1_TOKEN_URL || 'https://api.openf1.org/token',
    apiUrl: (process.env.OPENF1_API_URL || 'https://api.openf1.org/v1').replace(/\/$/, ''),
    mqttHost: process.env.OPENF1_MQTT_HOST || 'mqtt.openf1.org',
    mqttPort: numberFromEnv('OPENF1_MQTT_PORT', 8883, { min: 1, max: 65535 }),
    mqttWsUrl: process.env.OPENF1_MQTT_WS_URL || 'wss://mqtt.openf1.org:8084/mqtt',
    mqttTransport: process.env.OPENF1_MQTT_TRANSPORT === 'wss' ? 'wss' : 'mqtts',
    tokenRefreshSkewMs: numberFromEnv('OPENF1_TOKEN_REFRESH_SKEW_MS', 60_000, { min: 10_000 }),
    connectTimeoutMs: numberFromEnv('OPENF1_CONNECT_TIMEOUT_MS', 15_000, { min: 1_000 }),
    maxPayloadBytes: numberFromEnv('OPENF1_MAX_PAYLOAD_BYTES', 1_048_576, { min: 1_024 }),
    maxMessagesPerSecond: numberFromEnv('OPENF1_MAX_MESSAGES_PER_SECOND', 15_000, { min: 100 }),
  }),
  live: Object.freeze({
    broadcastIntervalMs: numberFromEnv('LIVE_BROADCAST_INTERVAL_MS', 100, { min: 50, max: 5_000 }),
    sessionIdleTimeoutMs: numberFromEnv('LIVE_SESSION_IDLE_TIMEOUT_MS', 90_000, { min: 10_000 }),
    staleDriverMs: numberFromEnv('LIVE_STALE_DRIVER_MS', 10_000, { min: 1_000 }),
    maxWsClients: numberFromEnv('LIVE_MAX_WS_CLIENTS', 100, { min: 1, max: 10_000 }),
    maxWsClientsPerIp: numberFromEnv('LIVE_MAX_WS_CLIENTS_PER_IP', 10, { min: 1, max: 1_000 }),
    wsHeartbeatMs: numberFromEnv('LIVE_WS_HEARTBEAT_MS', 25_000, { min: 5_000 }),
    apiRequestsPerMinute: numberFromEnv('LIVE_API_REQUESTS_PER_MINUTE', 180, { min: 10 }),
  }),
  replay: Object.freeze({
    generatedDirectory: path.resolve(serverRoot, 'generated-replays'),
    remoteFallback: booleanFromEnv('LIVE_REMOTE_REPLAY_FALLBACK', true),
    windowMs: numberFromEnv('LIVE_REPLAY_WINDOW_MS', 120_000, { min: 10_000, max: 900_000 }),
    speed: numberFromEnv('LIVE_REPLAY_SPEED', 4, { min: 0.25, max: 64 }),
    apiMinIntervalMs: numberFromEnv('OPENF1_REPLAY_REQUEST_INTERVAL_MS', 400, { min: 170 }),
  }),
});

export const hasOpenF1Credentials = (config) => Boolean(
  config?.openF1?.username && config?.openF1?.password,
);

export const getPublicConfig = (config) => ({
  environment: config.env,
  liveCredentialsConfigured: hasOpenF1Credentials(config),
  mqttTransport: config.openF1.mqttTransport,
  replayFallbackEnabled: config.replay.remoteFallback,
});
