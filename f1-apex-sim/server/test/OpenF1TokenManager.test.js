import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenF1AuthError, OpenF1TokenManager } from '../src/openf1/OpenF1TokenManager.js';

const config = {
  username: 'server-user',
  password: 'server-password',
  tokenUrl: 'https://api.openf1.org/token',
  tokenRefreshSkewMs: 60_000,
  connectTimeoutMs: 2_000,
};

test('token manager shares concurrent requests and caches a usable token', async () => {
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('username'), 'server-user');
    return {
      ok: true,
      json: async () => ({ access_token: 'private-access-token', expires_in: '3600' }),
    };
  };
  const manager = new OpenF1TokenManager(config, { fetchImpl, now: () => 1_000_000 });
  const [first, second] = await Promise.all([
    manager.getTokenRecord(),
    manager.getTokenRecord(),
  ]);
  const third = await manager.getTokenRecord();

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(manager.getStatus().hasToken, true);
  assert.equal(JSON.stringify(manager.getStatus()).includes('private-access-token'), false);
});

test('token manager refuses to operate without server credentials', async () => {
  const manager = new OpenF1TokenManager({ ...config, username: '', password: '' });
  await assert.rejects(manager.getTokenRecord(), OpenF1AuthError);
});
