import { useCountdown } from '../hooks/useCountdown';
import { formatDateTime, formatUtcDateTime, padTime } from '../utils/dateTime';

const CountdownCard = ({ session, title = 'Next session', compact = false }) => {
  const countdown = useCountdown(session?.date_start);

  if (!session) {
    return (
      <section className={`countdown-card ${compact ? 'compact' : ''}`}>
        <div className="section-kicker">{title}</div>
        <p className="muted-text">No upcoming session found.</p>
      </section>
    );
  }

  const { days, hours, minutes, seconds } = countdown.parts;
  // remainingMs goes negative once the session starts; live until it has been
  // running for the session's full duration.
  const sessionDurationMs = session.date_end
    ? Date.parse(session.date_end) - Date.parse(session.date_start)
    : 0;
  const isLive = countdown.status === 'elapsed'
    && -countdown.remainingMs < sessionDurationMs;

  return (
    <section className={`countdown-card ${compact ? 'compact' : ''}`}>
      <div className="section-kicker">{title}</div>
      <p className="session-name">{session.session_name}</p>

      {isLive ? (
        <div className="live-now" role="status">
          <span className="live-dot" aria-hidden="true" />
          Live now
        </div>
      ) : (
        <div className="countdown-grid" aria-label="Countdown">
          <div>
            <strong>{padTime(days)}</strong>
            <span>Days</span>
          </div>
          <div>
            <strong>{padTime(hours)}</strong>
            <span>Hrs</span>
          </div>
          <div>
            <strong>{padTime(minutes)}</strong>
            <span>Min</span>
          </div>
          <div>
            <strong>{padTime(seconds)}</strong>
            <span>Sec</span>
          </div>
        </div>
      )}

      <div className="time-meta">
        <span>
          <em>Local</em>
          {formatDateTime(session.date_start)}
        </span>
        <span>
          <em>UTC</em>
          {formatUtcDateTime(session.date_start)}
        </span>
      </div>
    </section>
  );
};

export default CountdownCard;
