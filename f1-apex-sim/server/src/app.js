import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApiApp } from './http/createApiApp.js';
import { LiveCoordinator } from './live/LiveCoordinator.js';
import { LiveStateStore } from './live/LiveStateStore.js';
import { LiveWebSocketGateway } from './live/LiveWebSocketGateway.js';
import { OpenF1LiveSource } from './openf1/OpenF1LiveSource.js';
import { OpenF1TokenManager } from './openf1/OpenF1TokenManager.js';
import { CircuitProjectionService } from './projection/CircuitProjectionService.js';
import { loadCanonicalCircuits } from './projection/loadCanonicalCircuits.js';
import { SafeHistoricalProxy } from './proxy/SafeHistoricalProxy.js';
import { HistoricalReplayService } from './replay/HistoricalReplayService.js';
import { ReplayPlayer } from './replay/ReplayPlayer.js';

export const createGatewayRuntime = (config, overrides = {}) => {
  const projectionService = overrides.projectionService ?? new CircuitProjectionService();
  const projectionLoad = overrides.skipProjectionLoad
    ? Promise.resolve({ loaded: 0, aliases: 0 })
    : loadCanonicalCircuits(projectionService, {
      appRoot: fileURLToPath(new URL('../../', import.meta.url)),
    });
  const tokenManager = overrides.tokenManager ?? new OpenF1TokenManager(config.openF1);
  const store = overrides.store ?? new LiveStateStore({
    staleDriverMs: config.live.staleDriverMs,
    projectionService,
    projectionLoad,
  });
  const liveSource = overrides.liveSource ?? new OpenF1LiveSource({
    ...config.openF1,
    sessionIdleTimeoutMs: config.live.sessionIdleTimeoutMs,
  }, tokenManager);
  const replayService = overrides.replayService ?? new HistoricalReplayService({
    ...config.replay,
    apiUrl: config.openF1.apiUrl,
  });
  const replayPlayer = overrides.replayPlayer ?? new ReplayPlayer(replayService, store, {
    speed: config.replay.speed,
  });
  const historicalProxy = overrides.historicalProxy ?? new SafeHistoricalProxy({
    openF1ApiUrl: config.openF1.apiUrl,
  });
  const coordinator = overrides.coordinator ?? new LiveCoordinator({
    source: liveSource,
    store,
    replayPlayer,
  });

  let websocketGateway;
  const app = createApiApp({
    config,
    store,
    liveSource,
    tokenManager,
    replayService,
    historicalProxy,
    getWebSocketStatus: () => websocketGateway?.getStatus() ?? null,
  });
  const server = http.createServer(app);
  websocketGateway = new LiveWebSocketGateway({ server, store, config: {
    ...config.live,
    frontendOrigins: config.frontendOrigins,
  } });

  let started = false;
  return {
    app,
    server,
    store,
    liveSource,
    tokenManager,
    replayService,
    historicalProxy,
    replayPlayer,
    projectionService,
    coordinator,
    websocketGateway,
    async start() {
      if (started) return server.address();
      await projectionLoad;
      coordinator.start();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, () => {
          server.off('error', reject);
          resolve();
        });
      });
      started = true;
      return server.address();
    },
    async stop() {
      coordinator.stop();
      websocketGateway.close();
      if (!started) return;
      await new Promise((resolve) => server.close(resolve));
      started = false;
    },
  };
};
