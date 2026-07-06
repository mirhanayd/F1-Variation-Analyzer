import PageShell from '../layout/PageShell';
import { useSeasonSchedule } from '../hooks/useSeasonSchedule';
import {
  NextGrandPrixCard,
  PreviousRoundsStrip,
  UpcomingRoundsGrid,
} from '../features/schedule/RoundCards';

const HomeSchedulePage = () => {
  const seasonYear = new Date().getUTCFullYear();
  const schedule = useSeasonSchedule(seasonYear);

  return (
    <PageShell
      eyebrow="APiEX live season board"
      title="Rounds & Schedule"
      description="Track the season rhythm with previous rounds, the next Grand Prix countdown, session times and circuit links."
    >
      {schedule.status === 'loading' && (
        <div className="page-state">Loading race calendar...</div>
      )}

      {schedule.status === 'error' && (
        <div className="page-state error">Calendar data could not be loaded.</div>
      )}

      {schedule.status === 'ready' && (
        <>
          <PreviousRoundsStrip rounds={schedule.previousRounds} />
          <NextGrandPrixCard round={schedule.nextRound} nextSession={schedule.nextSession} />
          <UpcomingRoundsGrid rounds={schedule.upcomingRounds} />
        </>
      )}
    </PageShell>
  );
};

export default HomeSchedulePage;
