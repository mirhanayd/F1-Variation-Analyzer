import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { backendWsUrl } from '../config/backend';
import backendApi from '../services/backendApi';

const EMPTY_SNAPSHOT = Object.freeze({
  source: 'offline-demo',
  status: 'idle',
  meetingKey: null,
  meetingName: null,
  sessionKey: null,
  sessionName: null,
  updatedAt: null,
  latencyMs: null,
  driversByNumber: {},
  locationsByDriver: {},
  carDataByDriver: {},
  positionsByDriver: {},
  intervalsByDriver: {},
  lapsByDriver: {},
  projection: null,
  messages: [],
});

const MAX_BACKOFF_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 35_000;

const snapshotFromMessage = (message) => {
  if (!message || typeof message !== 'object') return null;
  if (message.type === 'snapshot') return message.snapshot ?? message.data ?? null;
  if (message.snapshot) return message.snapshot;
  if (message.source && message.status) return message;
  return null;
};

const connectionStateFor = (snapshot, socketReadyState) => {
  if (snapshot?.status === 'replay' || snapshot?.source?.includes('replay')) return 'replay';
  if (snapshot?.status === 'live') return 'live';
  if (snapshot?.status === 'error') return 'error';
  return socketReadyState === WebSocket.OPEN ? 'connecting' : 'reconnecting';
};

export const useLiveGateway = ({ enabled = true, circuitId = null } = {}) => {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [connectionState, setConnectionState] = useState(enabled ? 'connecting' : 'idle');
  const [error, setError] = useState(null);
  const [reconnectInMs, setReconnectInMs] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const heartbeatPingRef = useRef(null);
  const snapshotFrameRef = useRef(null);
  const pendingSnapshotRef = useRef(null);
  const connectRef = useRef(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);
  const lastMessageAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    stoppedRef.current = false;
    let disposed = false;

    const clearTimers = () => {
      window.clearTimeout(reconnectTimerRef.current);
      window.clearTimeout(heartbeatTimerRef.current);
      window.clearInterval(heartbeatPingRef.current);
      window.cancelAnimationFrame(snapshotFrameRef.current);
      reconnectTimerRef.current = null;
      heartbeatTimerRef.current = null;
      heartbeatPingRef.current = null;
      snapshotFrameRef.current = null;
      pendingSnapshotRef.current = null;
    };

    const queueSnapshot = (nextSnapshot) => {
      pendingSnapshotRef.current = nextSnapshot;
      if (snapshotFrameRef.current) return;
      snapshotFrameRef.current = window.requestAnimationFrame(() => {
        snapshotFrameRef.current = null;
        const queued = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;
        if (!queued || disposed) return;
        setSnapshot({ ...EMPTY_SNAPSHOT, ...queued });
        setConnectionState(connectionStateFor(queued, socketRef.current?.readyState));
        setError(null);
      });
    };

    const armHeartbeatGuard = () => {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = window.setTimeout(() => {
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN
          && Date.now() - lastMessageAtRef.current >= HEARTBEAT_TIMEOUT_MS) {
          socket.close(4000, 'Gateway heartbeat timed out');
        }
      }, HEARTBEAT_TIMEOUT_MS + 1_000);
    };

    const scheduleReconnect = () => {
      if (stoppedRef.current || reconnectTimerRef.current) return;
      const baseDelay = Math.min(MAX_BACKOFF_MS, 750 * (2 ** attemptRef.current));
      const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
      attemptRef.current += 1;
      setReconnectInMs(delay);
      setConnectionState('reconnecting');
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        setReconnectInMs(null);
        connectRef.current?.();
      }, delay);
    };

    const connect = () => {
      if (stoppedRef.current) return;
      const existing = socketRef.current;
      if (existing?.readyState === WebSocket.OPEN || existing?.readyState === WebSocket.CONNECTING) return;

      setConnectionState(attemptRef.current > 0 ? 'reconnecting' : 'connecting');
      setError(null);
      const socket = new WebSocket(backendWsUrl({ circuitId }));
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (socket !== socketRef.current) return;
        attemptRef.current = 0;
        lastMessageAtRef.current = Date.now();
        setReconnectInMs(null);
        setConnectionState('connecting');
        socket.send(JSON.stringify({ type: 'subscribe', channel: 'live', circuitId }));
        heartbeatPingRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', at: Date.now() }));
          }
        }, 15_000);
        armHeartbeatGuard();
      });

      socket.addEventListener('message', (event) => {
        if (socket !== socketRef.current) return;
        lastMessageAtRef.current = Date.now();
        armHeartbeatGuard();

        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
            return;
          }

          if (message.type === 'error') {
            setError(new Error(message.message ?? 'Live gateway error'));
            return;
          }

          const nextSnapshot = snapshotFromMessage(message);
          if (!nextSnapshot) return;
          queueSnapshot(nextSnapshot);
        } catch (messageError) {
          setError(new Error(`Invalid live gateway message: ${messageError.message}`));
        }
      });

      socket.addEventListener('error', () => {
        if (socket !== socketRef.current) return;
        setError(new Error('Could not reach the live gateway'));
      });

      socket.addEventListener('close', () => {
        if (socket !== socketRef.current) return;
        socketRef.current = null;
        window.clearTimeout(heartbeatTimerRef.current);
        window.clearInterval(heartbeatPingRef.current);
        scheduleReconnect();
      });
    };

    connectRef.current = connect;
    backendApi.getLiveSnapshot()
      .then(queueSnapshot)
      .catch(() => {});
    connect();

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED) connect();
      else if (Date.now() - lastMessageAtRef.current >= HEARTBEAT_TIMEOUT_MS) {
        socket.close(4001, 'Application resumed');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let appStateHandle;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) handleVisibility();
    }).then((handle) => {
      if (disposed) handle.remove();
      else appStateHandle = handle;
    }).catch(() => {});

    return () => {
      disposed = true;
      stoppedRef.current = true;
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibility);
      appStateHandle?.remove();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Component unmounted');
      connectRef.current = null;
    };
  }, [circuitId, enabled]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    setReconnectInMs(null);
    const socket = socketRef.current;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(4002, 'Manual reconnect');
    } else {
      connectRef.current?.();
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await backendApi.getLiveSnapshot();
      setSnapshot({ ...EMPTY_SNAPSHOT, ...nextSnapshot });
      setConnectionState(connectionStateFor(nextSnapshot, socketRef.current?.readyState));
      return nextSnapshot;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    }
  }, []);

  return useMemo(() => ({
    snapshot,
    connectionState: enabled ? connectionState : 'idle',
    connected: connectionState === 'live' || connectionState === 'replay',
    error,
    reconnectInMs,
    reconnect,
    refreshSnapshot,
  }), [connectionState, enabled, error, reconnect, reconnectInMs, refreshSnapshot, snapshot]);
};

export default useLiveGateway;
