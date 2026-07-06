import { Link } from 'react-router-dom';
import CountdownCard from '../../components/CountdownCard';
import CircuitVisual from '../circuits/CircuitVisual';
import { getSessionByName, SESSION_ORDER } from './scheduleModel';

const formatDayRange = (round) => {
  const start = round.dateRange.start ? new Date(round.dateRange.start) : null;
  const end = round.dateRange.end ? new Date(round.dateRange.end) : start;
  if (!start) return 'TBA';

  const day = new Intl.DateTimeFormat(undefined, { day: '2-digit' });
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const startMonth = month.format(start).toUpperCase();
  const endMonth = month.format(end).toUpperCase();

  if (startMonth !== endMonth) {
    return `${day.format(start)} ${startMonth} – ${day.format(end)} ${endMonth}`;
  }

  return `${day.format(start)} – ${day.format(end)} ${endMonth}`;
};

const formatSessionSlot = (session) => {
  const date = new Date(session.date_start);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).toUpperCase();

  if (session.timeConfirmed === false) {
    return { weekday, time: 'TBA' };
  }

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return { weekday, time };
};

const getCircuitLink = (round) => `/circuits/${round.circuit.slug ?? round.circuit.id}`;

export const SessionTimeline = ({ round, dense = false }) => {
  const sessions = SESSION_ORDER
    .map((sessionName) => getSessionByName(round, sessionName))
    .filter(Boolean);

  if (sessions.length === 0) {
    return <p className="muted-text">Session times are not published yet.</p>;
  }

  return (
    <div className={`session-list ${dense ? 'dense' : ''}`}>
      {sessions.map((session) => {
        const slot = formatSessionSlot(session);
        const isRace = session.session_name === 'Race';

        return (
          <div key={session.session_key} className={`session-pill ${isRace ? 'race' : ''}`}>
            <span>{session.shortLabel}</span>
            <strong>{slot.weekday}</strong>
            <em>{slot.time}</em>
          </div>
        );
      })}
    </div>
  );
};

export const PreviousRoundsStrip = ({ rounds }) => {
  if (rounds.length === 0) return null;

  const previous = rounds.slice().reverse();

  return (
    <section className="schedule-section previous-strip">
      <div className="section-heading">
        <span>Season so far</span>
        <h2>Previous Rounds</h2>
      </div>
      <div className="previous-rounds-scroll" role="list">
        {previous.map((round) => (
          <Link key={round.id} to={getCircuitLink(round)} className="previous-round-card" role="listitem">
            <span className="round-chip">R{round.round}</span>
            <strong>{round.circuit.shortName ?? round.grandPrixName}</strong>
            <small>{formatDayRange(round)}</small>
            <em className="chequered" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
};

export const NextGrandPrixCard = ({ round }) => {
  if (!round) {
    return (
      <section className="next-grand-prix empty-state">
        <div className="empty-state-inner">
          <h2>Season complete</h2>
          <p>No upcoming Grand Prix left this season. Explore the circuit library or run a simulation.</p>
          <div className="empty-state-actions">
            <Link className="pw-button" to="/circuits">Browse circuits</Link>
            <Link className="pw-button ghost" to="/simulation">Open simulator</Link>
          </div>
        </div>
      </section>
    );
  }

  const isLive = round.status === 'current';
  const countdownSession = round.nextSession ?? getSessionByName(round, 'Race');

  return (
    <section className={`next-grand-prix ${isLive ? 'is-live' : ''}`}>
      <div className="next-grand-prix-visual">
        <CircuitVisual circuit={round.circuit} label={`Round ${round.round}`} />
      </div>

      <div className="next-grand-prix-content">
        <div className="next-gp-eyebrow-row">
          <span className="page-eyebrow">{isLive ? 'Race weekend live' : 'Next Grand Prix'}</span>
          {isLive && (
            <span className="live-chip">
              <span className="live-dot" aria-hidden="true" />
              LIVE
            </span>
          )}
        </div>
        <h2>{round.grandPrixName}</h2>
        <p className="next-gp-location">
          {round.circuit.name}
          <span> · {round.circuit.locality ? `${round.circuit.locality}, ` : ''}{round.circuit.country}</span>
        </p>
        <div className="next-card-meta">
          <span>{formatDayRange(round)}</span>
          <span>Round {round.round} / {round.season}</span>
        </div>
        <SessionTimeline round={round} />
        <Link className="pw-button" to={getCircuitLink(round)}>Circuit details</Link>
      </div>

      <CountdownCard
        session={countdownSession}
        title={isLive ? 'Up next on track' : 'Lights out in'}
        compact
      />
    </section>
  );
};

export const UpcomingRoundCard = ({ round }) => (
  <Link to={getCircuitLink(round)} className="upcoming-round-card">
    <div className="upcoming-card-head">
      <span className="round-chip">Round {round.round}</span>
      <strong className="round-dates">{formatDayRange(round)}</strong>
    </div>
    <div className="round-card-content">
      <h3>{round.grandPrixName}</h3>
      <p className="round-card-circuit">
        {round.circuit.name}
        <span> · {round.circuit.country}</span>
      </p>
      <SessionTimeline round={round} dense />
    </div>
  </Link>
);

export const UpcomingRoundsGrid = ({ rounds }) => {
  const items = rounds.slice(1);

  if (items.length === 0) return null;

  return (
    <section className="schedule-section">
      <div className="section-heading">
        <span>Remaining calendar</span>
        <h2>Upcoming Grand Prix</h2>
      </div>
      <div className="upcoming-grid">
        {items.map((round) => (
          <UpcomingRoundCard key={round.id} round={round} />
        ))}
      </div>
    </section>
  );
};
