import { useCountdown } from '../hooks/useCountdown';
import { formatDateTime, formatGmtOffset, formatUtcDateTime, padTime } from '../utils/dateTime';

const CountdownCard = ({ session, compact = false }) => {
  const countdown = useCountdown(session?.date_start);

  if (!session) {
    return (
      <section className={`panel-section countdown-card ${compact ? 'compact' : ''}`}>
        <div className="section-kicker">Next Session</div>
        <p className="muted-text">No upcoming session found.</p>
      </section>
    );
  }

  const { days, hours, minutes, seconds } = countdown.parts;

  return (
    <section className={`panel-section countdown-card ${compact ? 'compact' : ''}`}>
      <div className="section-kicker">Next Session</div>
      <h2>{session.meeting?.meeting_name ?? session.circuit_short_name}</h2>
      <p className="session-name">{session.session_name}</p>

      <div className="countdown-grid" aria-label="Countdown">
        <div>
          <strong>{days}</strong>
          <span>Days</span>
        </div>
        <div>
          <strong>{padTime(hours)}</strong>
          <span>Hours</span>
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

      <div className="time-meta">
        <span>Local: {formatDateTime(session.date_start)}</span>
        <span>UTC: {formatUtcDateTime(session.date_start)}</span>
        <span>Track: {formatGmtOffset(session.gmt_offset)}</span>
      </div>
    </section>
  );
};

export default CountdownCard;
