import { normalizeCircuitId } from './circuitRegistry';

// ============================================================
// Circuit sections & sectors
// ------------------------------------------------------------
// Curated sector splits, named corners, straights and DRS zones
// per circuit. Circuits without a curated entry fall back to a
// clean generated placeholder structure (clearly marked), so
// every circuit always exposes sector data and the system is
// ready for future detailed data.
// ============================================================

export const SECTOR_COLORS = ['#FF1E46', '#00E5FF', '#FFF01E'];

const CURATED_SECTIONS = {
  istanbul: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T6', highlight: 'The downhill plunge into Turn 1 and the fast T3–T5 sweeps.' },
      { name: 'Sector 2', corners: 'T7 – T8', highlight: 'Dominated by Turn 8 — the legendary quadruple-apex left-hander.' },
      { name: 'Sector 3', corners: 'T9 – T14', highlight: 'Heavy braking into T9, the back straight and the final T12–T14 complex.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'Turn 1', note: 'Downhill off-camber left, a signature overtaking spot' },
      { number: 'T8', name: 'Turn 8', note: 'Quadruple-apex left taken near-flat, up to 5G sustained' },
      { number: 'T9', name: 'Turn 9', note: 'Hard braking after the T8 exit' },
      { number: 'T12', name: 'Turn 12', note: 'Late-braking pass opportunity at the end of the back straight' },
    ],
    straights: [
      { name: 'Start/Finish straight', detail: '~650 m, DRS zone 1' },
      { name: 'Back straight (T10 – T12)', detail: '~720 m, DRS zone 2' },
    ],
    drsZones: ['Start/finish straight', 'Back straight into Turn 12'],
  },
  monza: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T3', highlight: 'Full-throttle main straight into the Rettifilo chicane and Curva Grande.' },
      { name: 'Sector 2', corners: 'T4 – T7', highlight: 'Variante della Roggia and the two Lesmo right-handers.' },
      { name: 'Sector 3', corners: 'T8 – T11', highlight: 'Variante Ascari and the long Parabolica (Curva Alboreto).' },
    ],
    namedCorners: [
      { number: 'T1–T2', name: 'Variante del Rettifilo', note: 'Heaviest braking event of the lap' },
      { number: 'T3', name: 'Curva Grande', note: 'Flat-out sweeping right' },
      { number: 'T4–T5', name: 'Variante della Roggia', note: 'Kerb-riding chicane' },
      { number: 'T6–T7', name: 'Lesmo 1 & 2', note: 'Linked medium-speed rights' },
      { number: 'T8–T10', name: 'Variante Ascari', note: 'Fast triple-apex chicane' },
      { number: 'T11', name: 'Curva Alboreto (Parabolica)', note: 'Long 180° right onto the main straight' },
    ],
    straights: [
      { name: 'Start/Finish straight', detail: '~1,120 m, DRS zone 2' },
      { name: 'Back straight (Serraglio)', detail: 'DRS zone 1 into Ascari' },
    ],
    drsZones: ['Back straight before Ascari', 'Main straight'],
  },
  silverstone: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T6', highlight: 'Abbey, Farm and the Village–Loop–Aintree complex onto the Wellington straight.' },
      { name: 'Sector 2', corners: 'T7 – T9', highlight: 'Brooklands, Luffield and the flat-out Copse.' },
      { name: 'Sector 3', corners: 'T10 – T18', highlight: 'Maggotts–Becketts–Chapel esses, Hangar straight, Stowe and Club.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'Abbey', note: 'Flat-out right kink' },
      { number: 'T3–T4', name: 'Village – The Loop', note: 'Slow technical sequence' },
      { number: 'T9', name: 'Copse', note: 'High-commitment right' },
      { number: 'T10–T13', name: 'Maggotts – Becketts – Chapel', note: 'Iconic high-speed direction changes' },
      { number: 'T15', name: 'Stowe', note: 'Fast right at the end of Hangar straight' },
    ],
    straights: [
      { name: 'Wellington straight', detail: '~770 m, DRS zone 1' },
      { name: 'Hangar straight', detail: '~875 m, DRS zone 2' },
    ],
    drsZones: ['Wellington straight', 'Hangar straight'],
  },
  spa: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T7', highlight: 'La Source hairpin, Eau Rouge–Raidillon and the long Kemmel straight.' },
      { name: 'Sector 2', corners: 'T8 – T14', highlight: 'The fast middle section through Bruxelles, Pouhon and Fagnes.' },
      { name: 'Sector 3', corners: 'T15 – T19', highlight: 'Blanchimont flat-out and the Bus Stop chicane.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'La Source', note: 'First-gear hairpin' },
      { number: 'T3–T5', name: 'Eau Rouge – Raidillon', note: 'Legendary uphill compression' },
      { number: 'T10', name: 'Pouhon', note: 'Double-apex fast left' },
      { number: 'T17', name: 'Blanchimont', note: 'Flat-out left' },
      { number: 'T18–T19', name: 'Bus Stop chicane', note: 'Final overtaking chance' },
    ],
    straights: [
      { name: 'Kemmel straight', detail: '~800 m, DRS zone 1' },
      { name: 'Start/Finish straight', detail: 'DRS zone 2' },
    ],
    drsZones: ['Kemmel straight', 'Start/finish straight'],
  },
  monaco: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T5', highlight: 'Sainte Devote and the uphill run to Casino Square.' },
      { name: 'Sector 2', corners: 'T6 – T11', highlight: 'The Fairmont hairpin, Portier and the tunnel.' },
      { name: 'Sector 3', corners: 'T12 – T19', highlight: 'Nouvelle chicane, Piscine and Rascasse.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'Sainte Devote', note: 'Tight right, wall on exit' },
      { number: 'T6', name: 'Fairmont Hairpin', note: 'Slowest corner in F1 (~48 km/h)' },
      { number: 'T13–T16', name: 'Piscine', note: 'Fast swimming-pool chicanes' },
      { number: 'T18', name: 'Rascasse', note: 'Slow right around the restaurant' },
    ],
    straights: [
      { name: 'Start/Finish straight', detail: 'Short pit straight, DRS zone 1' },
      { name: 'Tunnel run', detail: 'Fastest point of the lap' },
    ],
    drsZones: ['Start/finish straight'],
  },
  suzuka: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T7', highlight: 'First curve and the famous uphill Esses.' },
      { name: 'Sector 2', corners: 'T8 – T14', highlight: 'Degner curves, the hairpin and Spoon.' },
      { name: 'Sector 3', corners: 'T15 – T18', highlight: '130R flat-out and the Casio Triangle chicane.' },
    ],
    namedCorners: [
      { number: 'T3–T6', name: 'The Esses', note: 'Rhythmic uphill direction changes' },
      { number: 'T8–T9', name: 'Degner 1 & 2', note: 'Unforgiving fast rights' },
      { number: 'T13–T14', name: 'Spoon Curve', note: 'Long double-left onto the back straight' },
      { number: 'T15', name: '130R', note: 'Flat-out 300+ km/h left' },
      { number: 'T16–T17', name: 'Casio Triangle', note: 'Final chicane' },
    ],
    straights: [
      { name: 'Back straight (Spoon – 130R)', detail: '~1,200 m' },
      { name: 'Start/Finish straight', detail: 'DRS zone 1' },
    ],
    drsZones: ['Start/finish straight'],
  },
  interlagos: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T5', highlight: 'The downhill Senna S and Curva do Sol.' },
      { name: 'Sector 2', corners: 'T6 – T11', highlight: 'The twisty infield from Ferradura to Mergulho.' },
      { name: 'Sector 3', corners: 'T12 – T15', highlight: 'Juncao and the long uphill drag to the line.' },
    ],
    namedCorners: [
      { number: 'T1–T2', name: 'Senna S', note: 'Downhill left-right, prime overtaking spot' },
      { number: 'T4', name: 'Descida do Lago', note: 'Fast double-left' },
      { number: 'T12', name: 'Juncao', note: 'Critical exit onto the main straight' },
    ],
    straights: [
      { name: 'Reta Oposta', detail: '~700 m back straight, DRS zone 1' },
      { name: 'Start/Finish climb', detail: 'DRS zone 2' },
    ],
    drsZones: ['Reta Oposta', 'Start/finish straight'],
  },
  americas: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T10', highlight: 'The steep Turn 1 hairpin and the Silverstone-inspired esses.' },
      { name: 'Sector 2', corners: 'T11 – T15', highlight: 'The 1.2 km back straight into the Turn 12 braking zone.' },
      { name: 'Sector 3', corners: 'T16 – T20', highlight: 'The triple-apex right and the stadium section.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'Turn 1', note: '133 ft climb into a blind hairpin' },
      { number: 'T3–T6', name: 'The Esses', note: 'High-speed direction changes' },
      { number: 'T11', name: 'Turn 11', note: 'Hairpin onto the back straight' },
      { number: 'T16–T18', name: 'Triple apex', note: 'Long multi-apex right' },
    ],
    straights: [
      { name: 'Back straight (T11 – T12)', detail: '~1,200 m, DRS zone 1' },
      { name: 'Start/Finish straight', detail: 'DRS zone 2' },
    ],
    drsZones: ['Back straight', 'Start/finish straight'],
  },
  bahrain: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T4', highlight: 'Heavy braking into T1 and the fast T2–T3 sweep.' },
      { name: 'Sector 2', corners: 'T5 – T10', highlight: 'The flowing middle section down to the T9–T10 double-left.' },
      { name: 'Sector 3', corners: 'T11 – T15', highlight: 'The T11 climb and the final corners back onto the pit straight.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'Turn 1', note: 'Primary overtaking zone' },
      { number: 'T9–T10', name: 'Turn 9–10', note: 'Tricky off-camber double-left' },
      { number: 'T11', name: 'Turn 11', note: 'Fast uphill left' },
    ],
    straights: [
      { name: 'Start/Finish straight', detail: '~1,090 m, DRS zone 1' },
      { name: 'Back straight (T10 – T11)', detail: 'DRS zone 2' },
    ],
    drsZones: ['Start/finish straight', 'T3–T4 straight', 'T10–T11 straight'],
  },
  red_bull_ring: {
    sectors: [
      { name: 'Sector 1', corners: 'T1 – T3', highlight: 'The uphill drag to Remus, the biggest overtaking spot.' },
      { name: 'Sector 2', corners: 'T4 – T6', highlight: 'Schlossgold and the fast downhill sweeps.' },
      { name: 'Sector 3', corners: 'T7 – T10', highlight: 'Rindt and the final two rights onto the short pit straight.' },
    ],
    namedCorners: [
      { number: 'T1', name: 'Niki Lauda Kurve', note: 'Uphill right' },
      { number: 'T3', name: 'Remus', note: 'Steep 2nd-gear right, key overtaking zone' },
      { number: 'T9–T10', name: 'Rindt', note: 'Fast final rights, exit critical' },
    ],
    straights: [
      { name: 'Uphill straight (T1 – T3)', detail: 'DRS zone 1' },
      { name: 'Start/Finish straight', detail: 'DRS zone 2' },
    ],
    drsZones: ['Run to Remus', 'T3–T4 straight', 'Start/finish straight'],
  },
};

// Rough sector corner split when no curated data exists.
const splitCornersIntoSectors = (cornerCount) => {
  if (!Number.isFinite(cornerCount) || cornerCount < 3) {
    return [
      { from: null, to: null },
      { from: null, to: null },
      { from: null, to: null },
    ];
  }

  const third = Math.round(cornerCount / 3);
  return [
    { from: 1, to: third },
    { from: third + 1, to: third * 2 },
    { from: third * 2 + 1, to: cornerCount },
  ];
};

const buildFallbackSections = (circuit) => {
  const cornerCount = circuit?.stats?.corners;
  const drsCount = circuit?.stats?.drsZones;
  const splits = splitCornersIntoSectors(cornerCount);

  return {
    curated: false,
    sectors: splits.map((split, index) => ({
      name: `Sector ${index + 1}`,
      corners: split.from ? `T${split.from} – T${split.to}` : 'TBD',
      highlight: 'Detailed section data is pending for this circuit.',
    })),
    namedCorners: [],
    straights: [
      { name: 'Start/Finish straight', detail: 'Primary straight — detailed data pending' },
    ],
    drsZones: Number.isFinite(drsCount) && drsCount > 0
      ? Array.from({ length: drsCount }, (_, index) => `DRS zone ${index + 1}`)
      : [],
  };
};

export const getCircuitSections = (circuit) => {
  const id = normalizeCircuitId(circuit?.id ?? '');
  const curated = CURATED_SECTIONS[id];

  if (curated) {
    return { curated: true, ...curated };
  }

  return buildFallbackSections(circuit);
};

export const hasCuratedSections = (circuitId) => Boolean(CURATED_SECTIONS[normalizeCircuitId(circuitId)]);

// Sector descriptors for the 2D track canvas: evenly split path ranges with
// the standard F1 sector colours. Corner counts come from the sections data.
export const buildCanvasSectors = (circuit) => {
  const sections = getCircuitSections(circuit);

  return sections.sectors.map((sector, index) => ({
    id: `sector${index + 1}`,
    name: sector.name,
    color: SECTOR_COLORS[index % SECTOR_COLORS.length],
    label: `SECTOR ${index + 1}`,
    corners: parseCornerRange(sector.corners),
    pathRange: {
      start: index / sections.sectors.length,
      end: (index + 1) / sections.sectors.length,
    },
  }));
};

const parseCornerRange = (range = '') => {
  const match = /T(\d+)\s*–\s*T(\d+)/.exec(range);
  if (!match) return [];

  const from = Number.parseInt(match[1], 10);
  const to = Number.parseInt(match[2], 10);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];

  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
};

// Evenly distributed corner markers for circuits without surveyed positions.
export const buildCanvasCorners = (circuit) => {
  const cornerCount = circuit?.stats?.corners;
  if (!Number.isFinite(cornerCount) || cornerCount < 1) return [];

  return Array.from({ length: cornerCount }, (_, index) => {
    const number = index + 1;
    return {
      id: number,
      name: `T${number}`,
      number: String(number).padStart(2, '0'),
      trackPosition: (number / cornerCount) * 0.96 + 0.02,
      approximate: true,
    };
  });
};
