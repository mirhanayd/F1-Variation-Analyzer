import assert from 'node:assert/strict';
import test from 'node:test';
import { clientIpFromRequest, isOriginAllowed } from '../src/live/LiveWebSocketGateway.js';

test('configured WebSocket origins reject missing and unlisted origins', () => {
  const origins = ['https://pitwall.example'];
  assert.equal(isOriginAllowed('https://pitwall.example', origins), true);
  assert.equal(isOriginAllowed('https://evil.example', origins), false);
  assert.equal(isOriginAllowed(undefined, origins), false);
  assert.equal(isOriginAllowed(undefined, []), true);
  assert.equal(isOriginAllowed('https://localhost', []), true);
});

test('WebSocket client IP trusts only the configured number of proxy hops', () => {
  const request = {
    headers: { 'x-forwarded-for': '198.51.100.20, 10.0.0.3' },
    socket: { remoteAddress: '10.0.0.2' },
  };
  assert.equal(clientIpFromRequest(request, 0), '10.0.0.2');
  assert.equal(clientIpFromRequest(request, 1), '10.0.0.3');
  assert.equal(clientIpFromRequest(request, 2), '198.51.100.20');
});
