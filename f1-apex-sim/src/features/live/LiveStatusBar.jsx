import LiveSourceBadge from './LiveSourceBadge';

const formatUpdatedAt = (value) => {
  if (!value) return 'Waiting for data';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Waiting for data';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const LiveStatusBar = ({ snapshot, connectionState, error, reconnectInMs, onReconnect }) => {
  const source = snapshot?.source ?? 'offline-demo';
  const displayStatus = connectionState === 'reconnecting'
    ? 'reconnecting'
    : snapshot?.status ?? connectionState;

  return (
    <section className="live-status-bar" aria-live="polite">
      <LiveSourceBadge source={source} status={displayStatus} />
      <div className="live-session-summary">
        <strong>{snapshot?.sessionName ?? 'No active session'}</strong>
        <span>{snapshot?.meetingName ?? 'Gateway standing by'}</span>
      </div>
      <div className="live-status-metrics">
        <span>
          <small>Last update</small>
          <strong>{formatUpdatedAt(snapshot?.updatedAt)}</strong>
        </span>
        <span>
          <small>Latency</small>
          <strong>{Number.isFinite(snapshot?.latencyMs) ? `~${Math.round(snapshot.latencyMs)} ms` : '—'}</strong>
        </span>
      </div>
      {(connectionState === 'reconnecting' || error) && (
        <button type="button" className="live-reconnect" onClick={onReconnect}>
          {reconnectInMs ? `Retry in ${Math.ceil(reconnectInMs / 1000)}s` : 'Reconnect'}
        </button>
      )}
    </section>
  );
};

export default LiveStatusBar;

