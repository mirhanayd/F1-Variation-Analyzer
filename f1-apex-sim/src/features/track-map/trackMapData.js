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
    sectors: [
      {
        id: 'sector1',
        name: 'Full Circuit',
        color: '#00E5FF',
        label: 'SECTOR 1',
        corners: [],
        pathRange: { start: 0, end: 1 },
      },
    ],
    corners: [],
    drsZones: [],
    speedTrap: null,
    startFinish: { trackPosition: 0 },
  };
};
