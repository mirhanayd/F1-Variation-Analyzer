import { useEffect, useMemo, useRef, useState } from 'react';
import dataManager from '../services/dataManager';
import { getLocationBounds, interpolateLocation } from '../utils/trackGeometry';

const PLAYBACK_SPEED = 8;

const emptyReplay = {
  status: 'idle',
  package: null,
  error: null,
};

const normalizeDriverColor = (driver) => {
  if (!driver?.team_colour) return '#FFFFFF';
  return driver.team_colour.startsWith('#') ? driver.team_colour : `#${driver.team_colour}`;
};

const normalizeLocations = (locationByDriver = {}) => Object.entries(locationByDriver)
  .reduce((acc, [driverNumber, locations]) => {
    acc[driverNumber] = locations
      .map((location) => ({
        ...location,
        timeMs: Date.parse(location.date),
      }))
      .filter((location) => Number.isFinite(location.timeMs))
      .sort((a, b) => a.timeMs - b.timeMs);

    return acc;
  }, {});

export const useTelemetryReplay = (track, { enabled = true, reloadKey = 0 } = {}) => {
  const [state, setState] = useState(emptyReplay);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastFrameRef = useRef(null);
  const isSupported = Boolean(track?.openF1);

  useEffect(() => {
    if (!isSupported || !enabled) {
      return undefined;
    }

    const controller = new AbortController();

    const loadReplay = async () => {
      setState({ status: 'loading', package: null, error: null });
      setIsPlaying(false);
      setPlayheadMs(0);

      try {
        const replayPackage = await dataManager.getReplayPackage(track, {
          driverLimit: 8,
          replayWindowMs: 2 * 60 * 1000,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setState({
            status: replayPackage ? 'ready' : 'empty',
            package: replayPackage,
            error: null,
          });
          setIsPlaying(Boolean(replayPackage));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            package: null,
            error,
          });
          setIsPlaying(false);
        }
      }
    };

    loadReplay();

    return () => controller.abort();
  }, [isSupported, enabled, reloadKey, track]);

  const processed = useMemo(() => {
    if (!state.package) {
      return {
        drivers: [],
        driverMap: new Map(),
        locationsByDriver: {},
        telemetryBounds: null,
        durationMs: 0,
        windowStartMs: 0,
      };
    }

    const locationsByDriver = normalizeLocations(state.package.locationByDriver);
    const drivers = state.package.drivers.map((driver) => ({
      ...driver,
      color: normalizeDriverColor(driver),
    }));
    const driverMap = new Map(drivers.map((driver) => [String(driver.driver_number), driver]));
    const telemetryBounds = getLocationBounds(state.package.locationByDriver);
    const windowStartMs = Date.parse(state.package.window.start);

    return {
      drivers,
      driverMap,
      locationsByDriver,
      telemetryBounds,
      durationMs: state.package.window.durationMs,
      windowStartMs,
    };
  }, [state.package]);

  useEffect(() => {
    if (!isPlaying || state.status !== 'ready' || !processed.durationMs) {
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
        const next = current + deltaMs * PLAYBACK_SPEED;
        return next > processed.durationMs ? 0 : next;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying, processed.durationMs, state.status]);

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
          acronym: driver?.name_acronym ?? driverNumber,
          driverName: driver?.broadcast_name ?? driver?.full_name ?? `#${driverNumber}`,
          color: driver?.color ?? '#FFFFFF',
        };
      })
      .filter(Boolean);
  }, [playheadMs, processed]);

  if (!isSupported) {
    return {
      status: 'unsupported',
      error: null,
      meeting: null,
      session: null,
      circuitGeometry: null,
      drivers: [],
      positions: [],
      telemetryBounds: null,
      playheadMs: 0,
      durationMs: 0,
      isPlaying: false,
      playbackSpeed: PLAYBACK_SPEED,
      setPlayheadMs,
      setIsPlaying,
      togglePlaying: () => {},
    };
  }

  return {
    status: state.status,
    error: state.error,
    meeting: state.package?.meeting ?? null,
    session: state.package?.session ?? null,
    circuitGeometry: state.package?.circuitGeometry ?? null,
    drivers: processed.drivers,
    positions,
    telemetryBounds: processed.telemetryBounds,
    playheadMs,
    durationMs: processed.durationMs,
    isPlaying,
    playbackSpeed: PLAYBACK_SPEED,
    setPlayheadMs,
    setIsPlaying,
    togglePlaying: () => setIsPlaying((current) => !current),
  };
};
