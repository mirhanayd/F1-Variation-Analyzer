import { WebSocket, WebSocketServer } from 'ws';

const LOCAL_ORIGIN = /^(https?|capacitor):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const isOriginAllowed = (origin, configuredOrigins) => {
  if (!origin) return true;
  if (configuredOrigins.length > 0) return configuredOrigins.includes(origin);
  return LOCAL_ORIGIN.test(origin);
};

export class LiveWebSocketGateway {
  constructor({ server, store, config }) {
    this.server = server;
    this.store = store;
    this.config = config;
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 4_096,
      perMessageDeflate: false,
      clientTracking: true,
    });
    this.clientsByIp = new Map();
    this.broadcastTimer = null;
    this.closed = false;
    this.onUpgrade = this.#handleUpgrade.bind(this);
    this.onStoreUpdate = this.#scheduleBroadcast.bind(this);
    server.on('upgrade', this.onUpgrade);
    store.on('update', this.onStoreUpdate);

    this.wss.on('connection', (socket, request, clientIp) => {
      this.#onConnection(socket, request, clientIp);
    });

    this.heartbeatTimer = setInterval(() => this.#heartbeat(), config.wsHeartbeatMs);
    this.heartbeatTimer.unref?.();
  }

  getStatus() {
    return {
      path: '/ws/live',
      connectedClients: this.wss.clients.size,
      maxClients: this.config.maxWsClients,
      heartbeatMs: this.config.wsHeartbeatMs,
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.broadcastTimer);
    this.server.off('upgrade', this.onUpgrade);
    this.store.off('update', this.onStoreUpdate);
    for (const client of this.wss.clients) client.terminate();
    this.wss.close();
  }

  #handleUpgrade(request, socket, head) {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://gateway.local').pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== '/ws/live') return;
    const origin = request.headers.origin;
    const clientIp = request.socket.remoteAddress || 'unknown';
    const perIpCount = this.clientsByIp.get(clientIp) || 0;
    if (
      !isOriginAllowed(origin, this.config.frontendOrigins)
      || this.wss.clients.size >= this.config.maxWsClients
      || perIpCount >= this.config.maxWsClientsPerIp
    ) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request, clientIp);
    });
  }

  #onConnection(socket, _request, clientIp) {
    this.clientsByIp.set(clientIp, (this.clientsByIp.get(clientIp) || 0) + 1);
    socket.isAlive = true;
    socket.messageWindowStartedAt = Date.now();
    socket.messageCount = 0;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', (payload) => {
      if (!this.#allowClientMessage(socket)) {
        socket.close(1008, 'Message rate exceeded');
        return;
      }
      let message;
      try {
        message = JSON.parse(payload.toString('utf8'));
      } catch {
        return;
      }
      if (message?.type === 'ping') {
        this.#send(socket, { type: 'pong', timestamp: new Date().toISOString() });
      } else if (message?.type === 'get_snapshot') {
        this.#sendSnapshot(socket);
      }
    });
    socket.once('close', () => {
      const count = (this.clientsByIp.get(clientIp) || 1) - 1;
      if (count <= 0) this.clientsByIp.delete(clientIp);
      else this.clientsByIp.set(clientIp, count);
    });
    this.#send(socket, {
      type: 'hello',
      protocol: 'pitwall-live-v1',
      heartbeatMs: this.config.wsHeartbeatMs,
    });
    this.#sendSnapshot(socket);
  }

  #allowClientMessage(socket) {
    const now = Date.now();
    if (now - socket.messageWindowStartedAt >= 1_000) {
      socket.messageWindowStartedAt = now;
      socket.messageCount = 0;
    }
    socket.messageCount += 1;
    return socket.messageCount <= 10;
  }

  #heartbeat() {
    for (const client of this.wss.clients) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
      // Browser WebSocket APIs hide protocol ping frames. This small application
      // heartbeat lets React/Capacitor detect a silent mobile connection too.
      this.#send(client, { type: 'ping', timestamp: new Date().toISOString() });
    }
  }

  #scheduleBroadcast() {
    if (this.broadcastTimer || this.closed) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      const message = JSON.stringify({ type: 'snapshot', data: this.store.getSnapshot() });
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 2 * 1024 * 1024) {
          client.send(message);
        }
      }
    }, this.config.broadcastIntervalMs);
    this.broadcastTimer.unref?.();
  }

  #sendSnapshot(socket) {
    this.#send(socket, { type: 'snapshot', data: this.store.getSnapshot() });
  }

  #send(socket, value) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
  }
}

export { isOriginAllowed };
