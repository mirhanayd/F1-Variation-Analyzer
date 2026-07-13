import { useEffect, useRef, useState } from 'react';
import {
  CircuitProjectionService,
  createProjectionCacheKey,
} from '../../utils/circuitProjection';

const MAX_CALIBRATION_SAMPLES = 2_500;

const normalizeColor = (value) => {
  if (!value) return '#ffffff';
  return String(value).startsWith('#') ? String(value) : `#${value}`;
};

const serverProjectedPoint = (location, geometry) => {
  const projected = location?.projected;
  if (!projected) return null;
  const x = Number(projected.snappedX ?? projected.x);
  const y = Number(projected.snappedY ?? projected.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const bbox = geometry?.bbox;
  if (bbox) {
    const minX = bbox.minX ?? bbox.x;
    const minY = bbox.minY ?? bbox.y;
    const maxX = bbox.maxX ?? minX + bbox.width;
    const maxY = bbox.maxY ?? minY + bbox.height;
    const margin = Math.max(bbox.width, bbox.height) * 0.2;
    if (x < minX - margin || x > maxX + margin || y < minY - margin || y > maxY + margin) {
      return null;
    }
  }
  return {
    ...projected,
    x,
    y,
    progress: projected.progress ?? null,
  };
};

export const useProjectedLivePositions = ({ snapshot, circuit, geometry }) => {
  const [positions, setPositions] = useState([]);
  const serviceRef = useRef(new CircuitProjectionService({
    maxSourceSpeed: Infinity,
    snapStrength: 0.94,
    smoothing: { timeConstantMs: 110 },
  }));
  const samplesRef = useRef([]);
  const sampleIdsRef = useRef(new Set());
  const lastSessionRef = useRef(null);

  useEffect(() => {
    let frameId = null;
    let active = true;
    const commit = (nextPositions) => {
      frameId = window.requestAnimationFrame(() => {
        if (active) setPositions(nextPositions);
      });
    };
    const circuitId = circuit?.id;
    const sessionKey = snapshot?.sessionKey ?? 'current';
    if (!circuitId || !geometry?.points?.length) {
      commit([]);
      return () => {
        active = false;
        window.cancelAnimationFrame(frameId);
      };
    }

    const sessionIdentity = createProjectionCacheKey(circuitId, sessionKey);
    if (lastSessionRef.current !== sessionIdentity) {
      serviceRef.current.clear();
      samplesRef.current = [];
      sampleIdsRef.current.clear();
      lastSessionRef.current = sessionIdentity;
    }

    const locationEntries = Object.entries(snapshot?.locationsByDriver ?? {});
    locationEntries.forEach(([driverNumber, value]) => {
      const location = Array.isArray(value) ? value.at(-1) : value;
      if (!location) return;
      const id = `${driverNumber}:${location._id ?? location.date ?? location.timeMs ?? `${location.x}:${location.y}`}`;
      if (sampleIdsRef.current.has(id)) return;
      sampleIdsRef.current.add(id);
      samplesRef.current.push(location);
    });

    if (samplesRef.current.length > MAX_CALIBRATION_SAMPLES) {
      samplesRef.current.splice(0, samplesRef.current.length - MAX_CALIBRATION_SAMPLES);
      sampleIdsRef.current = new Set(samplesRef.current.map((location) => (
        `${location.driverNumber ?? location.driver_number}:${location._id ?? location.date ?? location.timeMs ?? `${location.x}:${location.y}`}`
      )));
    }

    let calibration = serviceRef.current.getCalibration(circuitId, sessionKey);
    if (!calibration && samplesRef.current.length >= 4) {
      calibration = serviceRef.current.calibrate(circuitId, samplesRef.current, geometry, {
        sessionKey,
        minimumSamples: 4,
        allowReflection: true,
        maxSourceSpeed: Infinity,
      });
    }

    const next = locationEntries.map(([driverNumber, value]) => {
      const location = Array.isArray(value) ? value.at(-1) : value;
      if (!location) return null;
      const driver = snapshot?.driversByNumber?.[driverNumber] ?? {};
      const projected = serverProjectedPoint(location, geometry) ?? serviceRef.current.project(
        circuitId,
        location,
        geometry,
        {
          sessionKey,
          calibration,
          driverKey: driverNumber,
          maxSourceSpeed: Infinity,
          maximumDisplayStep: 90,
        },
      );
      if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;

      return {
        ...location,
        driverNumber: Number(driverNumber),
        acronym: driver.acronym ?? driver.nameAcronym ?? driver.name_acronym ?? driverNumber,
        driverName: driver.broadcastName ?? driver.fullName ?? `#${driverNumber}`,
        color: normalizeColor(driver.teamColor ?? driver.team_colour ?? driver.color),
        stale: Boolean(location.stale || projected.stale),
        projected,
      };
    }).filter(Boolean);

    commit(next);
    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [circuit?.id, geometry, snapshot]);

  return positions;
};

export default useProjectedLivePositions;
