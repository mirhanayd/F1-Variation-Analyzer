import {
  getCircuitById,
  getCircuitByOpenF1Name,
  normalizeCircuitId,
} from '../../data/circuitRegistry';

export const SESSION_ORDER = [
  'Practice 1',
  'Practice 2',
  'Practice 3',
  'Sprint Qualifying',
  'Sprint',
  'Qualifying',
  'Race',
];

export const SESSION_SHORT_LABELS = {
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
  'Sprint Qualifying': 'SQ',
  Sprint: 'SPR',
  Qualifying: 'Q',
  Race: 'Race',
};

const normalizeName = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const buildRaceDate = (race) => {
  if (!race?.date) return null;
  return `${race.date}T${race.time ?? '00:00:00Z'}`;
};

const groupSessionsByMeeting = (sessions = []) => sessions.reduce((acc, session) => {
  if (!acc.has(session.meeting_key)) acc.set(session.meeting_key, []);
  acc.get(session.meeting_key).push(session);
  return acc;
}, new Map());

const findMeetingForRace = (race, meetings = []) => {
  const circuitId = normalizeCircuitId(race?.Circuit?.circuitId);
  const curatedCircuit = getCircuitById(circuitId);
  const aliases = curatedCircuit?.openF1?.circuitShortNames?.map(normalizeName) ?? [];
  const raceName = normalizeName(race?.raceName);
  const raceDate = Date.parse(buildRaceDate(race));

  return meetings.find((meeting) => {
    const circuitName = normalizeName(meeting.circuit_short_name);
    return aliases.includes(circuitName);
  }) ?? meetings.find((meeting) => {
    const meetingName = normalizeName(meeting.meeting_name);
    return raceName && (meetingName.includes(raceName.replace(' grand prix', '')) || raceName.includes(meetingName));
  }) ?? meetings.find((meeting) => {
    if (!Number.isFinite(raceDate)) return false;
    const meetingStart = Date.parse(meeting.date_start);
    const meetingEnd = Date.parse(meeting.date_end);
    return raceDate >= meetingStart - 48 * 60 * 60 * 1000 && raceDate <= meetingEnd + 48 * 60 * 60 * 1000;
  }) ?? null;
};

const normalizeSessionList = (sessions = []) => sessions
  .slice()
  .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))
  .map((session) => ({
    ...session,
    shortLabel: SESSION_SHORT_LABELS[session.session_name] ?? session.session_name,
    sortIndex: SESSION_ORDER.indexOf(session.session_name),
  }));

export const getSessionByName = (round, sessionName) => round.sessions
  .find((session) => session.session_name === sessionName) ?? null;

export const getRoundPrimaryDate = (round) => getSessionByName(round, 'Race')?.date_start
  ?? round.meeting?.date_end
  ?? round.raceDate;

export const getRoundDateRange = (round) => ({
  start: round.meeting?.date_start ?? round.sessions[0]?.date_start ?? round.raceDate,
  end: round.meeting?.date_end ?? round.sessions.at(-1)?.date_end ?? round.raceDate,
});

export const normalizeSchedule = ({ meetings = [], sessions = [], races = [] }, nowMs = Date.now()) => {
  const sessionsByMeeting = groupSessionsByMeeting(sessions);
  const raceRounds = races
    .filter((race) => race.Circuit?.circuitId)
    .map((race) => {
      const circuitId = normalizeCircuitId(race.Circuit.circuitId);
      const meeting = findMeetingForRace(race, meetings);
      const meetingSessions = normalizeSessionList(meeting ? sessionsByMeeting.get(meeting.meeting_key) : []);
      const raceDate = buildRaceDate(race);
      const circuit = getCircuitById(circuitId) ?? getCircuitByOpenF1Name(meeting?.circuit_short_name) ?? {
        id: circuitId,
        slug: circuitId,
        name: race.Circuit.circuitName,
        shortName: race.Circuit.circuitName,
        country: race.Circuit.Location?.country,
        locality: race.Circuit.Location?.locality,
      };
      const dateRange = getRoundDateRange({ meeting, sessions: meetingSessions, raceDate });
      const startMs = Date.parse(dateRange.start);
      const endMs = Date.parse(dateRange.end);
      const nextSession = meetingSessions.find((session) => Date.parse(session.date_end) > nowMs) ?? null;

      return {
        id: `${race.season}-${race.round}`,
        season: Number(race.season),
        round: Number(race.round),
        grandPrixName: race.raceName,
        raceDate,
        race,
        meeting,
        meetingKey: meeting?.meeting_key ?? null,
        circuit,
        circuitId,
        sessions: meetingSessions,
        nextSession,
        dateRange,
        status: endMs < nowMs ? 'past' : startMs <= nowMs ? 'current' : 'upcoming',
      };
    })
    .sort((a, b) => a.round - b.round);

  const nextRound = raceRounds.find((round) => round.status !== 'past') ?? null;
  const previousRounds = raceRounds.filter((round) => round.status === 'past');
  const upcomingRounds = raceRounds.filter((round) => round.status !== 'past');
  const nextSession = raceRounds
    .flatMap((round) => round.sessions.map((session) => ({ ...session, round, meeting: round.meeting })))
    .filter((session) => Date.parse(session.date_end) > nowMs)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;

  return {
    rounds: raceRounds,
    previousRounds,
    upcomingRounds,
    nextRound,
    nextSession,
  };
};
