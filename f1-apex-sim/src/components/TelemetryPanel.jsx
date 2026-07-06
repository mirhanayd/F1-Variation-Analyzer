import { formatDateTime, formatReplayClock } from '../utils/dateTime';

const TelemetryPanel = ({ replay }) => {
  const hasReplay = replay.status === 'ready';

  return (
    <section className="panel-section telemetry-panel">
      <div className="section-kicker">Telemetry Replay</div>

      {replay.status === 'loading' && (
        <p className="muted-text">Loading historical OpenF1 location data...</p>
      )}

      {replay.status === 'unsupported' && (
        <p className="muted-text">This track is not mapped to OpenF1 yet.</p>
      )}

      {replay.status === 'empty' && (
        <p className="muted-text">No completed race replay found for this track.</p>
      )}

      {replay.status === 'error' && (
        <p className="error-text">Replay data could not be loaded.</p>
      )}

      {hasReplay && (
        <>
          <div className="telemetry-session">
            <strong>{replay.meeting.meeting_name}</strong>
            <span>
              {replay.session.session_name}
              {' '}
              /
              {' '}
              {formatDateTime(replay.session.date_start)}
            </span>
          </div>

          <div className="replay-controls">
            <button type="button" onClick={replay.togglePlaying}>
              {replay.isPlaying ? 'Pause' : 'Play'}
            </button>
            <div className="replay-clock">
              {formatReplayClock(replay.playheadMs)}
              {' '}
              /
              {' '}
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
