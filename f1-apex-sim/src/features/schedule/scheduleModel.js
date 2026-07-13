import {
  getCircuitById,
  getCircuitByOpenF1Name,
  normalizeCircuitId,
} from '../../data/circuits';

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
  Qualifying: 'QUALI',
  Race: 'RACE',
};

// Jolpica race payload key -> canonical session name + typical duration.
const JOLPICA_SESSION_MAP = [
  { key: 'FirstPractice', name: 'Practice 1', durationMin: 60 },
  { key: 'SecondPractice', name: 'Practice 2', durationMin: 60 },
  { key: 'ThirdPractice', name: 'Practice 3', durationMin: 60 },
  { key: 'SprintQualifying', name: 'Sprint Qualifying', durationMin: 44 },
  { key: 'SprintShootout', name: 'Sprint Qualifying', durationMin: 44 },
  { key: 'Sprint', name: 'Sprint', durationMin: 40 },
  { key: 'Qualifying', name: 'Qualifying', durationMin: 60 },
];

const RACE_DURATION_MIN = 120;

const normalizeName = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const buildRaceDate = (race) => {
  if (!race?.date) return null;
  return `${race.date}T${race.time ?? '00:00:00Z'}`;
};

const buildJolpicaSessions = (race) => {
  if (!race) return [];

  const sessions = [];

  JOLPICA_SESSION_MAP.forEach(({ key, name, durationMin }) => {
    const entry = race[key];
    if (!entry?.date) return;
    if (sessions.some((session) => session.session_name === name)) return;

    const startIso = `${entry.date}T${entry.time ?? '00:00:00Z'}`;
    const startMs = Date.parse(startIso);
    if (!Number.isFinite(startMs)) return;

    sessions.push({
      session_key: `jolpica-${race.season}-${race.round}-${name}`,
      session_name: name,
      session_type: name.includes('Practice') ? 'Practice' : name,
      date_start: startIso,
      date_end: new Date(startMs + durationMin * 60 * 1000).toISOString(),
      gmt_offset: null,
      source: 'jolpica',
      timeConfirmed: Boolean(entry.time),
    });
  });

  const raceStartIso = buildRaceDate(race);
  const raceStartMs = Date.parse(raceStartIso ?? '');
  if (Number.isFinite(raceStartMs)) {
    sessions.push({
      session_key: `jolpica-${race.season}-${race.round}-Race`,
      session_name: 'Race',
      session_type: 'Race',
      date_start: raceStartIso,
      date_end: new Date(raceStartMs + RACE_DURATION_MIN * 60 * 1000).toISOString(),
      gmt_offset: null,
      source: 'jolpica',
      timeConfirmed: Boolean(race.time),
    });
  }

  return sessions;
};

// OpenF1 sessions win (they carry gmt offsets and confirmed times); Jolpica fills the gaps
// so future rounds still show a full weekend timetable.
const mergeSessions = (openF1Sessions = [], jolpicaSessions = []) => {
  const byName = new Map();

  jolpicaSessions.forEach((session) => byName.set(session.session_name, session));
  openF1Sessions.forEach((session) => byName.set(session.session_name, {
    ...session,
    source: 'openf1',
    timeConfirmed: true,
  }));

  return Array.from(byName.values());
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

const findRaceForMeeting = (meeting, races = []) => {
  const curatedCircuit = getCircuitByOpenF1Name(meeting.circuit_short_name);
  const aliases = curatedCircuit?.openF1?.circuitShortNames?.map(normalizeName) ?? [];
  const meetingName = normalizeName(meeting.meeting_name);
  const meetingStart = Date.parse(meeting.date_start);
  const meetingEnd = Date.parse(meeting.date_end);

  return races.find((race) => {
    const raceCircuit = getCircuitById(normalizeCircuitId(race.Circuit?.circuitId));
    const raceAliases = raceCircuit?.openF1?.circuitShortNames?.map(normalizeName) ?? [];
    const circuitMatches = aliases.some((alias) => raceAliases.includes(alias));
    if (circuitMatches) return true;

    const raceDate = Date.parse(buildRaceDate(race));
    if (!Number.isFinite(raceDate)) return false;
    return raceDate >= meetingStart - 48 * 60 * 60 * 1000 && raceDate <= meetingEnd + 48 * 60 * 60 * 1000;
  }) ?? races.find((race) => {
    const raceName = normalizeName(race.raceName);
    return meetingName && raceName && (raceName.includes(meetingName.replace(' grand prix', '')) || meetingName.includes(raceName.replace(' grand prix', '')));
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

const buildRoundFromMeeting = (meeting, index, sessionsByMeeting, races, nowMs) => {
  const race = findRaceForMeeting(meeting, races);
  const circuit = getCircuitByOpenF1Name(meeting.circuit_short_name)
    ?? getCircuitById(normalizeCircuitId(race?.Circuit?.circuitId))
    ?? {
      id: normalizeCircuitId(meeting.circuit_short_name),
      slug: normalizeCircuitId(meeting.circuit_short_name),
      name: meeting.circuit_short_name,
      shortName: meeting.circuit_short_name,
      country: meeting.country_name,
      locality: meeting.location,
    };
  const openF1Sessions = sessionsByMeeting.get(meeting.meeting_key) ?? [];
  const meetingSessions = normalizeSessionList(
    mergeSessions(openF1Sessions, buildJolpicaSessions(race)),
  );
  const raceDate = race ? buildRaceDate(race) : getSessionByName({ sessions: meetingSessions }, 'Race')?.date_start ?? meeting.date_end;
  const dateRange = getRoundDateRange({ meeting, sessions: meetingSessions, raceDate });
  const startMs = Date.parse(dateRange.start);
  const endMs = Date.parse(dateRange.end);
  const nextSession = meetingSessions.find((session) => Date.parse(session.date_end) > nowMs) ?? null;

  return {
    id: `${meeting.year ?? 'season'}-${meeting.meeting_key}`,
    season: Number(meeting.year ?? race?.season ?? new Date(meeting.date_start).getUTCFullYear()),
    round: Number(race?.round ?? index + 1),
    grandPrixName: race?.raceName ?? meeting.meeting_name ?? `${circuit.shortName} Grand Prix`,
    officialName: meeting.meeting_official_name ?? null,
    raceDate,
    race,
    meeting,
    meetingKey: meeting.meeting_key,
    circuit,
    circuitId: circuit.id,
    sessions: meetingSessions,
    nextSession,
    dateRange,
    status: endMs < nowMs ? 'past' : startMs <= nowMs ? 'current' : 'upcoming',
  };
};

const buildRoundFromRace = (race, meetings, sessionsByMeeting, nowMs) => {
  const circuitId = normalizeCircuitId(race.Circuit.circuitId);
  const meeting = findMeetingForRace(race, meetings);
  const openF1Sessions = meeting ? sessionsByMeeting.get(meeting.meeting_key) ?? [] : [];
  const meetingSessions = normalizeSessionList(
    mergeSessions(openF1Sessions, buildJolpicaSessions(race)),
  );
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
    officialName: meeting?.meeting_official_name ?? null,
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
};

export const normalizeSchedule = ({ meetings = [], sessions = [], races = [] }, nowMs = Date.now()) => {
  const sessionsByMeeting = groupSessionsByMeeting(sessions);
  const raceMeetings = meetings
    .filter((meeting) => !meeting.is_cancelled && meeting.meeting_name !== 'Pre-Season Testing')
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

  const raceRounds = raceMeetings.length
    ? raceMeetings.map((meeting, index) => buildRoundFromMeeting(meeting, index, sessionsByMeeting, races, nowMs))
    : races
      .filter((race) => race.Circuit?.circuitId)
      .map((race) => buildRoundFromRace(race, meetings, sessionsByMeeting, nowMs))
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
