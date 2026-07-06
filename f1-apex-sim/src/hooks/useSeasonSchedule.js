import { useEffect, useMemo, useState } from 'react';
import dataManager from '../services/dataManager';

const buildMeetingsWithSessions = ({ meetings = [], sessions = [] }, nowMs) => {
  const sessionsByMeeting = sessions.reduce((acc, session) => {
    const key = session.meeting_key;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(session);
    return acc;
  }, new Map());

  return meetings
    .filter((meeting) => !meeting.is_cancelled && meeting.meeting_name !== 'Pre-Season Testing')
    .map((meeting) => {
      const meetingSessions = (sessionsByMeeting.get(meeting.meeting_key) ?? [])
        .slice()
        .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

      const nextSession = meetingSessions.find((session) => Date.parse(session.date_end) > nowMs) ?? null;

      return {
        ...meeting,
        sessions: meetingSessions,
        nextSession,
        isPast: Date.parse(meeting.date_end) < nowMs,
        isCurrent: Date.parse(meeting.date_start) <= nowMs && Date.parse(meeting.date_end) >= nowMs,
      };
    })
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
};

export const useSeasonSchedule = (year = new Date().getUTCFullYear()) => {
  const [state, setState] = useState({
    status: 'idle',
    meetings: [],
    sessions: [],
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const loadSchedule = async () => {
      setState((current) => ({ ...current, status: 'loading', error: null }));

      try {
        const data = await dataManager.getSeasonSchedule(year, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setState({
            status: 'ready',
            meetings: data.meetings ?? [],
            sessions: data.sessions ?? [],
            error: null,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            meetings: [],
            sessions: [],
            error,
          });
        }
      }
    };

    loadSchedule();

    return () => controller.abort();
  }, [year]);

  return useMemo(() => {
    const nowMs = Date.now();
    const meetings = buildMeetingsWithSessions(state, nowMs);
    const upcomingMeetings = meetings.filter((meeting) => Date.parse(meeting.date_end) > nowMs);
    const nextMeeting = upcomingMeetings[0] ?? null;
    const allUpcomingSessions = meetings
      .flatMap((meeting) => meeting.sessions.map((session) => ({
        ...session,
        meeting,
      })))
      .filter((session) => Date.parse(session.date_end) > nowMs)
      .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

    return {
      ...state,
      meetings,
      upcomingMeetings,
      nextMeeting,
      nextSession: allUpcomingSessions[0] ?? null,
    };
  }, [state]);
};
