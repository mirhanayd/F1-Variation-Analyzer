export class LiveCoordinator {
  constructor({ source, store, replayPlayer }) {
    this.source = source;
    this.store = store;
    this.replayPlayer = replayPlayer;
    this.started = false;
    this.fallbackPromise = null;
    this.listeners = [];
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.#on(this.source, 'message', ({ topic, data, receivedAt }) => {
      if (this.replayPlayer.isRunning()) this.replayPlayer.stop();
      this.store.beginLive();
      this.store.apply(topic, data, { receivedAt, replay: false });
    });
    this.#on(this.source, 'status', (status) => {
      if (this.store.getSnapshot().status === 'replay') return;
      if (status.state === 'connecting' || status.state === 'connected') {
        this.store.setConnectionStatus('connecting');
      } else if (status.state === 'reconnecting') {
        this.store.setConnectionStatus('connecting', 'OpenF1 live connection is reconnecting.');
      } else if (status.state === 'error') {
        this.store.setConnectionStatus('error', 'OpenF1 live connection is temporarily unavailable.');
      }
    });
    this.#on(this.source, 'unavailable', ({ reason }) => this.#startFallback(reason));
    this.#on(this.source, 'inactive', ({ reason }) => this.#startFallback(reason));

    this.store.setConnectionStatus('connecting');
    this.source.start();
  }

  stop() {
    this.started = false;
    for (const [emitter, event, listener] of this.listeners) emitter.off(event, listener);
    this.listeners = [];
    this.source.stop();
    this.replayPlayer.stop();
  }

  #on(emitter, event, listener) {
    emitter.on(event, listener);
    this.listeners.push([emitter, event, listener]);
  }

  #startFallback(reason) {
    if (this.replayPlayer.isRunning() || this.fallbackPromise) return;
    const messages = {
      'credentials-missing': 'OpenF1 live credentials are not configured. Loading historical replay.',
      'no-active-session': 'There is no active OpenF1 session. Loading historical replay.',
      'authentication-failed': 'OpenF1 live authentication failed. Loading historical replay.',
      'connection-closed': 'OpenF1 live transport disconnected. Loading historical replay.',
    };
    this.store.beginReplay({ message: messages[reason] ?? 'Live data is unavailable. Loading historical replay.' });
    this.fallbackPromise = this.replayPlayer.startLatest()
      .then((started) => {
        if (!started) {
          this.store.beginReplay({
            message: 'No historical replay artifact is currently available. The gateway will keep checking for live data.',
          });
        }
      })
      .catch(() => {
        this.store.beginReplay({
          message: 'Historical replay could not be loaded. The gateway remains available and will keep reconnecting.',
        });
      })
      .finally(() => {
        this.fallbackPromise = null;
      });
  }
}
