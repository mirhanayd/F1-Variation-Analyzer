import { buildCanvasCorners, buildCanvasSectors } from '../../data/circuitSections';

// Normalises any circuit (current, historic or manual fallback) into the
// track-map data shape used by TrackCanvas and the simulation views.
// Circuits with hand-surveyed mapData (e.g. Monza, Silverstone) keep it;
// everything else gets sector splits + evenly-distributed corner markers
// derived from the circuit sections registry.
export const createTrackMapData = (circuit) => {
  if (circuit?.mapData) return circuit.mapData;

  return {
    id: circuit.id,
    name: circuit.name,
    shortName: circuit.shortName,
    country: circuit.country,
    countryName: circuit.country,
    svgPath: circuit.svgPath,
    openF1: circuit.openF1,
    stats: {
      length: circuit.stats?.length ?? 'TBA',
      firstGP: circuit.stats?.firstGP ?? 'TBA',
      laps: circuit.stats?.laps ?? 'TBA',
      lapRecord: circuit.stats?.lapRecord ?? { time: 'TBA', driver: 'Data pending' },
    },
    sectors: buildCanvasSectors(circuit),
    corners: buildCanvasCorners(circuit),
    drsZones: [],
    speedTrap: null,
    startFinish: { trackPosition: 0 },
  };
};
