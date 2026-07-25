import { sourceLabel } from './liveLabels';

const STATUS_LABELS = {
  idle: 'Idle',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  live: 'Live',
  replay: 'Replay',
  error: 'Error',
};

const LiveSourceBadge = ({ source, status }) => (
  <span className={`live-source-badge source-${source ?? 'offline-demo'} status-${status ?? 'idle'}`}>
    <i aria-hidden="true" />
    <span>{sourceLabel(source)}</span>
    <small>{STATUS_LABELS[status] ?? status ?? 'Idle'}</small>
  </span>
);

export default LiveSourceBadge;
