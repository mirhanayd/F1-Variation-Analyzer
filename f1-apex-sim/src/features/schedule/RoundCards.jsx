import { Link } from 'react-router-dom';
import CountdownCard from '../../components/CountdownCard';
import { formatDateTime } from '../../utils/dateTime';
import { getSessionByName, SESSION_ORDER } from './scheduleModel';
import CircuitVisual from '../circuits/CircuitVisual';

const formatDayRange = (round) => {
  const start = round.dateRange.start ? new Date(round.dateRange.start) : null;
  const end = round.dateRange.end ? new Date(round.dateRange.end) : start;
  if (!start) return 'TBA';

  const startDay = new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(start);
  const endDay = new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(end);
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(end).toUpperCase();

  return `${startDay} - ${endDay} ${month}`;
};

const getCircuitLink = (round) => `/circuits/${round.circuit.slug ?? round.circuit.id}`;

export const PreviousRoundsStrip = ({ rounds }) => {
  const previous = rounds.slice(-5).reverse();

  if (previous.length === 0) return null;

  return (
    <section className="schedule-section previous-strip">
      <div className="section-heading">
        <span>Archived pace</span>
        <h2>Previous Rounds</h2>
      </div>
      <div className="previous-rounds-grid">
        {previous.map((round) => (
          <Link key={round.id} to={getCircuitLink(round)} className="previous-round-card">
            <span>Round {round.round}</span>
            <strong>{round.circuit.shortName ?? round.grandPrixName}</strong>
            <small>{formatDayRange(round)}</small>
          </Link>
        ))}
      </div>
    </section>
  );
};

export const NextGrandPrixCard = ({ round, nextSession }) => {
  if (!round) {
    return (
      <section className="next-grand-prix empty-state">
        <p>No upcoming Grand Prix found for this season.</p>
      </section>
    );
  }

  return (
    <section className="next-grand-prix">
      <CircuitVisual circuit={round.circuit} label={`Round ${round.round}`} />
      <div className="next-grand-prix-content">
        <span className="page-eyebrow">Next Grand Prix</span>
        <h2>{round.grandPrixName}</h2>
        <p>
          {round.circuit.name}
          {' '}
          /
          {' '}
          {round.circuit.country}
        </p>
        <div className="next-card-meta">
          <span>{formatDayRange(round)}</span>
          <span>{round.sessions.length} sessions</span>
        </div>
        <Link className="apiex-button" to={getCircuitLink(round)}>Open circuit detail</Link>
      </div>
      <CountdownCard session={nextSession ?? round.nextSession} compact />
    </section>
  );
};

export const SessionSchedule = ({ round }) => {
  const sessions = SESSION_ORDER
    .map((sessionName) => getSessionByName(round, sessionName))
    .filter(Boolean);

  if (sessions.length === 0) {
    return <p className="muted-text">Session times are not published yet.</p>;
  }

  return (
    <div className="session-list">
      {sessions.map((session) => (
        <div key={session.session_key} className="session-pill">
          <span>{session.shortLabel}</span>
          <strong>{formatDateTime(session.date_start, { dateStyle: undefined, timeStyle: 'short' })}</strong>
        </div>
      ))}
    </div>
  );
};

export const UpcomingRoundCard = ({ round }) => (
  <Link to={getCircuitLink(round)} className="upcoming-round-card">
    <CircuitVisual circuit={round.circuit} label={`Round ${round.round}`} />
    <div className="round-card-content">
      <span>Round {round.round}</span>
      <h3>{round.circuit.shortName ?? round.grandPrixName}</h3>
      <p>{round.circuit.name}</p>
      <strong>{formatDayRange(round)}</strong>
      <SessionSchedule round={round} />
    </div>
  </Link>
);

export const UpcomingRoundsGrid = ({ rounds }) => {
  const items = rounds.slice(1);

  if (items.length === 0) return null;

  return (
    <section className="schedule-section">
      <div className="section-heading">
        <span>Upcoming</span>
        <h2>Remaining Grand Prix</h2>
      </div>
      <div className="upcoming-grid">
        {items.map((round) => (
          <UpcomingRoundCard key={round.id} round={round} />
        ))}
      </div>
    </section>
  );
};
