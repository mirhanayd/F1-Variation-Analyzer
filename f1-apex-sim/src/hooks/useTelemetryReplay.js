import { useEffect, useMemo, useRef, useState } from 'react';
import dataManager from '../services/dataManager';
import { getLocationBounds, interpolateLocation } from '../utils/trackGeometry';

const DEFAULT_PLAYBACK_SPEED = 8;

const emptyReplay = {
  status: 'idle',
  package: null,
  error: null,
  trackId: null,
};

const normalizeDriverColor = (driver) => {
  const value = driver?.team_colour ?? driver?.teamColor ?? driver?.color;
  if (!value) return '#FFFFFF';
  return String(value).startsWith('#') ? String(value) : `#${value}`;
};

const asRecords = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const recordTime = (record) => {
  const parsed = Date.parse(record?.date ?? record?.date_start ?? record?.updatedAt);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLocations = (locationByDriver = {}) => Object.entries(locationByDriver)
  .reduce((acc, [driverNumber, locations]) => {
    acc[driverNumber] = asRecords(locations)
      .map((location) => ({
        ...location,
        driverNumber: location.driverNumber ?? location.driver_number ?? Number(driverNumber),
        timeMs: recordTime(location),
      }))
      .filter((location) => Number.isFinite(location.timeMs))
      .sort((a, b) => a.timeMs - b.timeMs);

    return acc;
  }, {});

const normalizeTimedRecords = (recordsByDriver = {}) => Object.entries(recordsByDriver)
  .reduce((acc, [driverNumber, records]) => {
    acc[driverNumber] = asRecords(records)
      .map((record) => ({ ...record, timeMs: recordTime(record) }))
      .sort((left, right) => (left.timeMs ?? -Infinity) - (right.timeMs ?? -Infinity));
    return acc;
  }, {});

const recordAtTime = (records, targetTimeMs) => {
  if (!records?.length) return null;
  let low = 0;
  let high = records.length - 1;
  let match = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const timeMs = records[middle].timeMs ?? -Infinity;
    if (timeMs <= targetTimeMs) {
      match = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return match >= 0 ? records[match] : null;
};

const recordsAtTime = (recordsByDriver, targetTimeMs) => Object.entries(recordsByDriver)
  .reduce((acc, [driverNumber, records]) => {
    const record = recordAtTime(records, targetTimeMs);
    if (record) acc[driverNumber] = record;
    return acc;
  }, {});

const replaySource = (value) => (
  value === 'fastf1-generated-replay' ? value : 'openf1-historical-replay'
);

const hasReplayLocations = (replayPackage) => Object.values(
  replayPackage?.locationByDriver ?? {},
).some((records) => asRecords(records).length > 0);

export const useTelemetryReplay = (track, { enabled = true, reloadKey = 0 } = {}) => {
  const [state, setState] = useState(emptyReplay);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(DEFAULT_PLAYBACK_SPEED);
  const lastFrameRef = useRef(null);
  const isSupported = Boolean(track?.openF1);

  useEffect(() => {
    if (!isSupported || !enabled) {
      return undefined;
    }

    const controller = new AbortController();

    const loadReplay = async () => {
      setState({ status: 'loading', package: null, error: null, trackId: track.id });
      setIsPlaying(false);
      setPlayheadMs(0);

      try {
        const replayPackage = await dataManager.getReplayPackage(track, {
          driverLimit: 8,
          replayWindowMs: 2 * 60 * 1000,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          const usableReplay = hasReplayLocations(replayPackage);
          setState({
            status: usableReplay ? 'ready' : 'empty',
            package: usableReplay ? replayPackage : null,
            error: null,
            trackId: track.id,
          });
          setIsPlaying(usableReplay);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            package: null,
            error,
            trackId: track.id,
          });
          setIsPlaying(false);
        }
      }
    };

    loadReplay();

    return () => controller.abort();
  }, [isSupported, enabled, reloadKey, track]);

  const packageMatchesTrack = state.trackId === track?.id;
  const activePackage = packageMatchesTrack ? state.package : null;
  const activeStatus = enabled
    ? (packageMatchesTrack ? state.status : 'loading')
    : 'idle';

  const processed = useMemo(() => {
    if (!activePackage) {
      return {
        drivers: [],
        driverMap: new Map(),
        driversByNumber: {},
        locationsByDriver: {},
        carDataByDriver: {},
        positionsByDriver: {},
        intervalsByDriver: {},
        lapsByDriver: {},
        telemetryBounds: null,
        durationMs: 0,
        windowStartMs: 0,
        calibrationSamples: [],
      };
    }

    const locationsByDriver = normalizeLocations(activePackage.locationByDriver);
    const drivers = (activePackage.drivers ?? Object.values(activePackage.driversByNumber ?? {}))
      .map((driver) => {
        const driverNumber = driver.driverNumber ?? driver.driver_number;
        const acronym = driver.acronym ?? driver.nameAcronym ?? driver.name_acronym ?? driverNumber;
        const teamColor = normalizeDriverColor(driver);
        return {
          ...driver,
          driverNumber,
          driver_number: driverNumber,
          acronym,
          name_acronym: acronym,
          broadcastName: driver.broadcastName ?? driver.broadcast_name,
          broadcast_name: driver.broadcast_name ?? driver.broadcastName,
          fullName: driver.fullName ?? driver.full_name,
          full_name: driver.full_name ?? driver.fullName,
          teamName: driver.teamName ?? driver.team_name,
          team_name: driver.team_name ?? driver.teamName,
          teamColor,
          team_colour: driver.team_colour ?? teamColor,
          color: teamColor,
        };
      });
    const driverMap = new Map(drivers.map((driver) => [String(driver.driverNumber), driver]));
    Object.keys(locationsByDriver).forEach((driverNumber) => {
      if (!driverMap.has(driverNumber)) {
        const driver = {
          driverNumber: Number(driverNumber),
          driver_number: Number(driverNumber),
          acronym: driverNumber,
          name_acronym: driverNumber,
          color: '#FFFFFF',
          teamColor: '#FFFFFF',
          team_colour: '#FFFFFF',
        };
        drivers.push(driver);
        driverMap.set(driverNumber, driver);
      }
    });
    const driversByNumber = Object.fromEntries(driverMap);
    const telemetryBounds = getLocationBounds(locationsByDriver);
    const windowStartMs = Date.parse(activePackage.window.start);
    const allCalibrationSamples = Object.values(locationsByDriver).flat();
    const calibrationStride = Math.max(1, Math.ceil(allCalibrationSamples.length / 2_500));

    return {
      drivers,
      driverMap,
      driversByNumber,
      locationsByDriver,
      carDataByDriver: normalizeTimedRecords(activePackage.carDataByDriver),
      positionsByDriver: normalizeTimedRecords(
        activePackage.positionByDriver ?? activePackage.positionsByDriver,
      ),
      intervalsByDriver: normalizeTimedRecords(activePackage.intervalsByDriver),
      lapsByDriver: normalizeTimedRecords(activePackage.lapsByDriver),
      telemetryBounds,
      durationMs: activePackage.window.durationMs,
      windowStartMs,
      calibrationSamples: allCalibrationSamples.filter((_, index) => index % calibrationStride === 0),
    };
  }, [activePackage]);

  useEffect(() => {
    if (!enabled || !isPlaying || activeStatus !== 'ready' || !processed.durationMs) {
      lastFrameRef.current = null;
      return undefined;
    }

    let frameId = 0;

    const tick = (time) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = time;
      }

      const deltaMs = time - lastFrameRef.current;
      lastFrameRef.current = time;

      setPlayheadMs((current) => {
        const next = current + deltaMs * playbackSpeed;
        return next > processed.durationMs ? 0 : next;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [activeStatus, enabled, isPlaying, playbackSpeed, processed.durationMs]);

  useEffect(() => {
    const resetFrameClock = () => {
      lastFrameRef.current = null;
    };
    document.addEventListener('visibilitychange', resetFrameClock);
    return () => document.removeEventListener('visibilitychange', resetFrameClock);
  }, []);

  const positions = useMemo(() => {
    if (!processed.windowStartMs) return [];

    const targetTimeMs = processed.windowStartMs + playheadMs;

    return Object.entries(processed.locationsByDriver)
      .map(([driverNumber, locations]) => {
        const location = interpolateLocation(locations, targetTimeMs);
        if (!location) return null;

        const driver = processed.driverMap.get(String(driverNumber));

        return {
          ...location,
          driverNumber: Number(driverNumber),
          acronym: driver?.acronym ?? driver?.name_acronym ?? driverNumber,
          driverName: driver?.broadcastName ?? driver?.broadcast_name
            ?? driver?.fullName ?? driver?.full_name ?? `#${driverNumber}`,
          color: driver?.color ?? '#FFFFFF',
        };
      })
      .filter(Boolean);
  }, [playheadMs, processed]);

  const snapshot = useMemo(() => {
    if (!enabled || activeStatus !== 'ready' || !activePackage || !processed.windowStartMs) {
      return null;
    }

    const targetTimeMs = processed.windowStartMs + playheadMs;
    const locationsByDriver = Object.fromEntries(positions.map((position) => [
      String(position.driverNumber),
      {
        ...position,
        date: new Date(targetTimeMs).toISOString(),
        timeMs: targetTimeMs,
      },
    ]));
    let carDataByDriver = recordsAtTime(processed.carDataByDriver, targetTimeMs);
    if (activePackage.source === 'fastf1-generated-replay' && Object.keys(carDataByDriver).length === 0) {
      carDataByDriver = locationsByDriver;
    }

    const meeting = activePackage.meeting ?? {};
    const session = activePackage.session ?? {};
    const source = replaySource(activePackage.source);
    return {
      source,
      status: 'replay',
      meetingKey: meeting.meeting_key ?? meeting.meetingKey ?? session.meeting_key ?? null,
      meetingName: meeting.meeting_name ?? meeting.meetingName ?? session.meetingName ?? 'Historical replay',
      sessionKey: session.session_key ?? session.sessionKey ?? null,
      sessionName: session.session_name ?? session.sessionName ?? session.name ?? 'Race',
      circuitShortName: meeting.circuit_short_name ?? session.circuit_short_name ?? session.circuitName ?? null,
      updatedAt: new Date(targetTimeMs).toISOString(),
      latencyMs: null,
      driversByNumber: processed.driversByNumber,
      locationsByDriver,
      carDataByDriver,
      positionsByDriver: recordsAtTime(processed.positionsByDriver, targetTimeMs),
      intervalsByDriver: recordsAtTime(processed.intervalsByDriver, targetTimeMs),
      lapsByDriver: recordsAtTime(processed.lapsByDriver, targetTimeMs),
      projection: null,
      messages: [{
        level: 'info',
        text: source === 'fastf1-generated-replay'
          ? 'Showing a real FastF1-generated historical replay; this is not live.'
          : 'Showing real OpenF1 historical replay data for the selected circuit; this is not live.',
      }],
    };
  }, [activePackage, activeStatus, enabled, playheadMs, positions, processed]);

  if (!isSupported) {
    return {
      status: 'unsupported',
      error: null,
      meeting: null,
      session: null,
      circuitGeometry: null,
      drivers: [],
      positions: [],
      snapshot: null,
      calibrationSamples: [],
      telemetryBounds: null,
      playheadMs: 0,
      durationMs: 0,
      isPlaying: false,
      playbackSpeed,
      setPlaybackSpeed,
      setPlayheadMs,
      setIsPlaying,
      togglePlaying: () => {},
    };
  }

  return {
    status: activeStatus,
    error: state.error,
    meeting: activePackage?.meeting ?? null,
    session: activePackage?.session ?? null,
    circuitGeometry: activePackage?.circuitGeometry ?? null,
    drivers: processed.drivers,
    positions,
    snapshot,
    calibrationSamples: processed.calibrationSamples,
    telemetryBounds: processed.telemetryBounds,
    playheadMs,
    durationMs: processed.durationMs,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    setPlayheadMs,
    setIsPlaying,
    togglePlaying: () => setIsPlaying((current) => !current),
  };
};
