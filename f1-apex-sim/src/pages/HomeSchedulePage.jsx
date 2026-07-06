import PageShell from '../layout/PageShell';
import { useSeasonSchedule } from '../hooks/useSeasonSchedule';
import {
  NextGrandPrixCard,
  PreviousRoundsStrip,
  UpcomingRoundsGrid,
} from '../features/schedule/RoundCards';

const ScheduleSkeleton = () => (
  <div className="schedule-skeleton" role="status" aria-label="Loading race calendar">
    <div className="skeleton-row">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="skeleton skeleton-chip-card" />
      ))}
    </div>
    <div className="skeleton skeleton-hero" />
    <div className="skeleton-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  </div>
);

const HomeSchedulePage = () => {
  const seasonYear = new Date().getUTCFullYear();
  const schedule = useSeasonSchedule(seasonYear);

  return (
    <PageShell
      eyebrow={`${seasonYear} season`}
      title="Rounds & Schedule"
      description="Every round of the season — completed weekends, the next Grand Prix countdown, and full session times in your local timezone."
    >
      {schedule.status === 'loading' && <ScheduleSkeleton />}

      {schedule.status === 'error' && (
        <div className="page-state error">
          <strong>Calendar data could not be loaded.</strong>
          <p>Check your connection — the OpenF1 and Jolpica services may also be briefly unavailable.</p>
          <button type="button" className="pw-button ghost" onClick={schedule.reload}>
            Try again
          </button>
        </div>
      )}

      {schedule.status === 'ready' && (
        <>
          <PreviousRoundsStrip rounds={schedule.previousRounds} />
          <NextGrandPrixCard round={schedule.nextRound} />
          <UpcomingRoundsGrid rounds={schedule.upcomingRounds} />
        </>
      )}
    </PageShell>
  );
};

export default HomeSchedulePage;
