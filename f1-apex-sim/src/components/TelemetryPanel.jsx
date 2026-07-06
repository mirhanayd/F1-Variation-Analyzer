import { formatDateTime, formatReplayClock } from '../utils/dateTime';

const TelemetryPanel = ({ replay, onLoad, loadRequested = false }) => {
  const hasReplay = replay.status === 'ready';

  return (
    <section className="panel-section telemetry-panel">
      <div className="section-kicker">Race Replay</div>

      {replay.status === 'unsupported' && (
        <p className="muted-text">
          Replay telemetry is not available for this circuit — it needs an F1 weekend from 2023 onwards.
        </p>
      )}

      {replay.status === 'idle' && !loadRequested && (
        <>
          <p className="muted-text">
            Watch real car positions from the most recent race at this circuit, replayed on the track map.
          </p>
          <button type="button" className="pw-button ghost" onClick={onLoad}>
            Load race replay
          </button>
        </>
      )}

      {replay.status === 'loading' && (
        <div className="panel-loading">
          <span className="pw-spinner" aria-hidden="true" />
          <p className="muted-text">Fetching OpenF1 position data — this takes a few seconds…</p>
        </div>
      )}

      {replay.status === 'empty' && (
        <p className="muted-text">No completed race replay found for this circuit.</p>
      )}

      {replay.status === 'error' && (
        <>
          <p className="error-text">Replay data could not be loaded.</p>
          <button type="button" className="pw-button ghost" onClick={onLoad}>
            Try again
          </button>
        </>
      )}

      {hasReplay && (
        <>
          <div className="telemetry-session">
            <strong>{replay.meeting.meeting_name}</strong>
            <span>
              {replay.session.session_name}
              {' · '}
              {formatDateTime(replay.session.date_start)}
            </span>
          </div>

          <div className="replay-controls">
            <button type="button" onClick={replay.togglePlaying}>
              {replay.isPlaying ? 'Pause' : 'Play'}
            </button>
            <div className="replay-clock">
              {formatReplayClock(replay.playheadMs)}
              {' / '}
              {formatReplayClock(replay.durationMs)}
            </div>
          </div>

          <input
            className="replay-range"
            type="range"
            min="0"
            max={Math.max(0, replay.durationMs)}
            value={Math.min(replay.playheadMs, replay.durationMs)}
            onChange={(event) => replay.setPlayheadMs(Number(event.target.value))}
            aria-label="Replay timeline"
          />

          <div className="driver-chips">
            {replay.drivers.slice(0, 8).map((driver) => (
              <span
                key={driver.driver_number}
                className="driver-chip"
                style={{ '--team-color': driver.color }}
              >
                {driver.name_acronym}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default TelemetryPanel;
