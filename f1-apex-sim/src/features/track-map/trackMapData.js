import { getCircuitSections } from '../../data/circuitSections';

export const createTrackMapData = (circuit) => {
  if (circuit?.mapData && !circuit.geometry && !circuit.normalizedDisplayGeometry) {
    return circuit.mapData;
  }

  const sections = getCircuitSections(circuit);

  return {
    id: circuit.id,
    name: circuit.name,
    shortName: circuit.shortName,
    country: circuit.country,
    countryName: circuit.country,
    svgPath: circuit.svgPath,
    geometry: circuit.geometry
      ?? circuit.normalizedDisplayGeometry
      ?? circuit.circuitGeometry
      ?? null,
    geojsonSourcePath: circuit.geojsonSourcePath ?? circuit.geojsonPath ?? null,
    openF1: circuit.openF1,
    stats: {
      length: circuit.stats?.length ?? 'TBA',
      firstGP: circuit.stats?.firstGP ?? 'TBA',
      laps: circuit.stats?.laps ?? 'TBA',
      lapRecord: circuit.stats?.lapRecord ?? { time: 'TBA', driver: 'Data pending' },
    },
    sectors: sections.sectors.map((sector) => ({
      id: sector.id,
      name: sector.name,
      color: sector.color,
      label: sector.label,
      corners: [],
      pathRange: { start: sector.range[0], end: sector.range[1] },
    })),
    corners: (circuit.turns ?? circuit.corners ?? []).map((turn, index) => ({
      id: turn.id ?? `turn-${index + 1}`,
      number: turn.label ?? turn.number ?? `T${index + 1}`,
      name: turn.name ?? `Turn ${index + 1}`,
      trackPosition: turn.progress ?? turn.trackPosition ?? 0,
    })),
    drsZones: [],
    speedTrap: null,
    startFinish: { trackPosition: 0 },
  };
};
