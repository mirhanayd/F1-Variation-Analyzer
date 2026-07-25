import assert from 'node:assert/strict';
import test from 'node:test';
import { SafeHistoricalProxy, SafeProxyError } from '../src/proxy/SafeHistoricalProxy.js';

const jsonResponse = (value) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('OpenF1 proxy permits only known read-only data endpoints and filters', async () => {
  let requestedUrl;
  const proxy = new SafeHistoricalProxy({
    openF1ApiUrl: 'https://api.openf1.org/v1',
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers.authorization, undefined);
      return jsonResponse([{ session_key: 1 }]);
    },
  });
  const value = await proxy.fetchOpenF1('location', {
    session_key: '123',
    'date>': '2026-01-01T00:00:00Z',
  });
  assert.equal(value[0].session_key, 1);
  assert.equal(requestedUrl.hostname, 'api.openf1.org');
  assert.equal(requestedUrl.searchParams.get('session_key'), '123');
  assert.equal(requestedUrl.searchParams.get('date>'), '2026-01-01T00:00:00Z');
  assert.match(requestedUrl.search, /date%3E=2026-01-01/);
  await assert.rejects(proxy.fetchOpenF1('token', {}), SafeProxyError);
  await assert.rejects(proxy.fetchOpenF1('location', { password: 'nope' }), SafeProxyError);
});

test('Jolpica proxy enforces its path grammar and bounded pagination', async () => {
  const proxy = new SafeHistoricalProxy({
    openF1ApiUrl: 'https://api.openf1.org/v1',
    fetchImpl: async () => jsonResponse({ MRData: {} }),
  });
  await proxy.fetchJolpica('2025/circuits/istanbul/results.json', { limit: 100 });
  await assert.rejects(proxy.fetchJolpica('../admin', {}), SafeProxyError);
  await assert.rejects(proxy.fetchJolpica('circuits.json', { limit: 100_000 }), SafeProxyError);
});
