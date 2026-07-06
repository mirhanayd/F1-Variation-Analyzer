import { useEffect, useMemo, useState } from 'react';
import dataManager from '../services/dataManager';
import { normalizeSchedule } from '../features/schedule/scheduleModel';

export const useSeasonSchedule = (year = new Date().getUTCFullYear()) => {
  const [state, setState] = useState({
    status: 'idle',
    meetings: [],
    sessions: [],
    races: [],
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
            races: data.races ?? [],
            error: null,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            meetings: [],
            sessions: [],
            races: [],
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
    const normalized = normalizeSchedule(state, nowMs);
    const upcomingMeetings = normalized.upcomingRounds
      .map((round) => round.meeting)
      .filter(Boolean);

    return {
      ...state,
      ...normalized,
      upcomingMeetings,
      nextMeeting: normalized.nextRound?.meeting ?? null,
    };
  }, [state]);
};
