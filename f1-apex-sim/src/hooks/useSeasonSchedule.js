import { useCallback, useEffect, useMemo, useState } from 'react';
import dataManager from '../services/dataManager';
import { normalizeSchedule } from '../features/schedule/scheduleModel';

export const useSeasonSchedule = (year = new Date().getUTCFullYear()) => {
  const [state, setState] = useState({
    status: 'idle',
    meetings: [],
    sessions: [],
    races: [],
    error: null,
    loadedAtMs: 0,
  });
  const [reloadIndex, setReloadIndex] = useState(0);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

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
            loadedAtMs: Date.now(),
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
            loadedAtMs: Date.now(),
          });
        }
      }
    };

    loadSchedule();

    return () => controller.abort();
  }, [year, reloadIndex]);

  return useMemo(() => {
    // Round statuses are computed against the fetch time — plenty accurate for
    // a schedule whose granularity is whole race weekends.
    const nowMs = state.loadedAtMs;
    const normalized = normalizeSchedule(state, nowMs);
    const upcomingMeetings = normalized.upcomingRounds
      .map((round) => round.meeting)
      .filter(Boolean);

    return {
      ...state,
      ...normalized,
      upcomingMeetings,
      nextMeeting: normalized.nextRound?.meeting ?? null,
      reload,
    };
  }, [state, reload]);
};
