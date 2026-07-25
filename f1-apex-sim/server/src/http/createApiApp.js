import express from 'express';

const LOCAL_ORIGIN = /^(https?|capacitor):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const allowedOrigin = (origin, configuredOrigins) => {
  if (!origin) return null;
  if (configuredOrigins.length > 0) return configuredOrigins.includes(origin) ? origin : null;
  return LOCAL_ORIGIN.test(origin) ? origin : null;
};

const createRateLimiter = (maxRequests) => {
  const clients = new Map();
  let requestsUntilCleanup = 500;
  return (request, response, next) => {
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const current = clients.get(ip);
    const entry = !current || now - current.startedAt >= 60_000
      ? { startedAt: now, count: 0 }
      : current;
    entry.count += 1;
    clients.set(ip, entry);
    requestsUntilCleanup -= 1;
    if (requestsUntilCleanup <= 0) {
      requestsUntilCleanup = 500;
      for (const [key, value] of clients) {
        if (now - value.startedAt >= 60_000) clients.delete(key);
      }
    }
    response.setHeader('x-ratelimit-limit', String(maxRequests));
    response.setHeader('x-ratelimit-remaining', String(Math.max(0, maxRequests - entry.count)));
    if (entry.count > maxRequests) {
      response.status(429).json({ error: 'Too many gateway requests' });
      return;
    }
    next();
  };
};

export const createApiApp = ({
  config,
  store,
  liveSource,
  tokenManager,
  replayService,
  historicalProxy,
  getWebSocketStatus = () => null,
}) => {
  const app = express();
  app.disable('x-powered-by');
  // Trust only an explicit number of edge hops. The default never accepts a
  // client-supplied forwarding header.
  app.set('trust proxy', config.trustProxyHops > 0 ? config.trustProxyHops : false);
  app.use((request, response, next) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('cache-control', 'no-store');
    const origin = allowedOrigin(request.headers.origin, config.frontendOrigins);
    if (request.headers.origin && !origin) {
      response.status(403).json({ error: 'Origin is not allowed by the live gateway' });
      return;
    }
    if (origin) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
      response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
      response.setHeader('access-control-allow-headers', 'content-type');
    }
    if (request.method === 'OPTIONS') {
      response.sendStatus(origin || !request.headers.origin ? 204 : 403);
      return;
    }
    next();
  });
  app.use('/api', createRateLimiter(config.live.apiRequestsPerMinute));

  app.get('/api/health', (_request, response) => {
    const source = liveSource.getStatus();
    const snapshot = store.getSnapshot();
    response.status(source.state === 'error' && snapshot.status === 'error' ? 503 : 200).json({
      ok: snapshot.status !== 'error',
      service: 'pitwall-live-gateway',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      mode: snapshot.source,
      status: snapshot.status,
    });
  });

  app.get('/api/live/status', (_request, response) => {
    const snapshot = store.getSnapshot();
    response.json({
      source: snapshot.source,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      credentialsConfigured: tokenManager.isConfigured(),
      upstream: liveSource.getStatus(),
      websocket: getWebSocketStatus(),
    });
  });

  app.get('/api/live/sessions/current', (_request, response) => {
    const snapshot = store.getSnapshot();
    response.json({
      active: snapshot.status === 'live',
      source: snapshot.source,
      meetingKey: snapshot.meetingKey,
      meetingName: snapshot.meetingName,
      sessionKey: snapshot.sessionKey,
      sessionName: snapshot.sessionName,
      circuitKey: snapshot.circuitKey,
      circuitShortName: snapshot.circuitShortName,
      updatedAt: snapshot.updatedAt,
    });
  });

  app.get('/api/live/snapshot', (_request, response) => {
    response.json(store.getSnapshot());
  });

  app.get('/api/openf1/:endpoint', async (request, response) => {
    try {
      const value = await historicalProxy.fetchOpenF1(request.params.endpoint, request.query);
      response.json(value);
    } catch (error) {
      response.status(error.status || 502).json({ error: error.message || 'OpenF1 proxy request failed' });
    }
  });

  // Express middleware is used instead of a wildcard route so nested Jolpica
  // paths work consistently across Express 4/5 path-to-regexp versions.
  app.use('/api/jolpica', async (request, response, next) => {
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Only read-only Jolpica requests are allowed' });
      return;
    }
    const upstreamPath = request.path.replace(/^\/+/, '');
    if (!upstreamPath) {
      next();
      return;
    }
    try {
      const value = await historicalProxy.fetchJolpica(upstreamPath, request.query);
      response.json(value);
    } catch (error) {
      response.status(error.status || 502).json({ error: error.message || 'Jolpica proxy request failed' });
    }
  });

  app.get('/api/replay/sessions', async (request, response) => {
    try {
      const requestedCircuit = request.query.circuitShortName
        ?? request.query.circuitId
        ?? request.query.circuit;
      const circuitShortName = typeof requestedCircuit === 'string'
        ? requestedCircuit.slice(0, 80)
        : null;
      response.json({ sessions: await replayService.listSessions({ circuitShortName }) });
    } catch {
      response.status(503).json({ error: 'Replay catalog is temporarily unavailable' });
    }
  });

  app.get('/api/replay/latest', async (request, response) => {
    const circuitShortName = typeof request.query.circuitShortName === 'string'
      ? request.query.circuitShortName.slice(0, 80)
      : null;
    try {
      const replay = await replayService.getLatestReplay({ circuitShortName });
      if (!replay) {
        response.status(404).json({ error: 'No completed replay is available for this circuit' });
        return;
      }
      response.json(replay);
    } catch {
      response.status(503).json({ error: 'Latest replay is temporarily unavailable' });
    }
  });

  app.get('/api/replay/:sessionKey', async (request, response) => {
    const { sessionKey } = request.params;
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(sessionKey)) {
      response.status(400).json({ error: 'Invalid replay session key' });
      return;
    }
    try {
      const replay = await replayService.getReplay(sessionKey);
      if (!replay) {
        response.status(404).json({ error: 'Replay session not found' });
        return;
      }
      response.json(replay);
    } catch {
      response.status(503).json({ error: 'Replay session is temporarily unavailable' });
    }
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Gateway endpoint not found' });
  });

  return app;
};
