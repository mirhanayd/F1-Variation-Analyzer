import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import test from 'node:test';
import { OPENF1_TOPICS, OpenF1LiveSource } from '../src/openf1/OpenF1LiveSource.js';

class FakeMqttClient extends EventEmitter {
  subscribe(topics, _options, callback) {
    this.topics = topics;
    callback(null);
  }

  end() {}
}

const jsonResponse = (value) => new Response(JSON.stringify(value), { status: 200 });

test('live source subscribes required topics and hydrates circuit metadata before car samples', async () => {
  const client = new FakeMqttClient();
  const messages = [];
  const source = new OpenF1LiveSource({
    username: 'server-account',
    apiUrl: 'https://api.openf1.org/v1',
    mqttTransport: 'mqtts',
    mqttHost: 'mqtt.openf1.org',
    mqttPort: 8883,
    mqttWsUrl: 'wss://mqtt.openf1.org:8084/mqtt',
    connectTimeoutMs: 1_000,
    maxPayloadBytes: 1_048_576,
    maxMessagesPerSecond: 1_000,
    sessionIdleTimeoutMs: 90_000,
    tokenRefreshSkewMs: 60_000,
  }, {
    isConfigured: () => true,
    getTokenRecord: async () => ({ accessToken: 'server-only-token', expiresAt: Date.now() + 3_600_000 }),
    invalidate: () => {},
  }, {
    mqttConnect: () => {
      queueMicrotask(() => client.emit('connect'));
      return client;
    },
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.authorization, 'Bearer server-only-token');
      if (url.pathname.endsWith('/sessions')) {
        return jsonResponse([{ session_key: 100, meeting_key: 200, session_name: 'Race' }]);
      }
      return jsonResponse([{ meeting_key: 200, meeting_name: 'Italian Grand Prix', circuit_short_name: 'Monza' }]);
    },
  });
  source.on('message', (message) => messages.push(message));

  source.start();
  await once(source, 'connected');
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  client.emit('message', 'v1/location', Buffer.from(JSON.stringify({
    _id: 1,
    session_key: 100,
    meeting_key: 200,
    driver_number: 44,
    date: new Date().toISOString(),
    x: 1,
    y: 2,
    z: 3,
  })));

  assert.deepEqual(client.topics, OPENF1_TOPICS);
  assert.deepEqual(messages.map((message) => message.topic), [
    'v1/meetings',
    'v1/sessions',
    'v1/location',
  ]);
  assert.equal(source.getStatus().state, 'live');
  source.stop();
});
