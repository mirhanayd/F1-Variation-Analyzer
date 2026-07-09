import { normalizeCircuitId } from './circuitRegistry';
import { getCornersForCircuit, hasCuratedCorners, CORNER_TYPE_LABELS } from './cornerLibrary';

// Sector and named-section data per circuit.
//
// Every circuit is guaranteed a full structure through getCircuitSections():
// curated entries below are hand-written from public track guides; anything
// else receives a clearly-flagged provisional structure (curated: false) that
// the UI labels as placeholder data. `range` values are fractions of the lap
// (0–1) so they can drive both 2D sector painting and the 3D simulation HUD.

export const SECTOR_COLORS = ['#e10600', '#22d3ee', '#ffd23e'];

const CURATED_SECTIONS = {
  istanbul: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.31], summary: 'Downhill plunge through the T1 “Turkish corkscrew” and the technical T3–T5 loop.' },
      { name: 'Sector 2', range: [0.31, 0.67], summary: 'The signature sector — flowing into the four-apex Turn 8, flat-out commitment all the way.' },
      { name: 'Sector 3', range: [0.67, 1], summary: 'Back straight into the heavy T12 braking zone and the tight final complex.' },
    ],
    corners: [
      { number: 'T1', name: 'Turkish Corkscrew', character: 'Blind downhill left', position: 0.04 },
      { number: 'T3', name: 'Turn 3', character: 'Uphill hairpin-like right', position: 0.15 },
      { number: 'T8', name: 'Quadruple Apex', character: 'Legendary four-apex left, ~5g sustained', position: 0.52 },
      { number: 'T12', name: 'Turn 12', character: 'Hardest braking zone, prime overtaking spot', position: 0.82 },
      { number: 'T14', name: 'Turn 14', character: 'Final right onto the pit straight', position: 0.95 },
    ],
    straights: [
      { name: 'Start/Finish Straight', length: '~650 m', note: 'Slightly downhill run to Turn 1.' },
      { name: 'Back Straight (T10–T12)', length: '~720 m', note: 'Main DRS overtaking run.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Back straight between T10 and T12', detection: 'Before Turn 9' },
      { name: 'DRS Zone 2', zone: 'Start/finish straight', detection: 'Before Turn 14' },
    ],
  },
  monza: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.3], summary: 'Full-throttle blast into the Rettifilo chicane, then Curva Grande.' },
      { name: 'Sector 2', range: [0.3, 0.66], summary: 'Roggia chicane and the two Lesmo right-handers.' },
      { name: 'Sector 3', range: [0.66, 1], summary: 'Ascari chicane and the long Parabolica onto the main straight.' },
    ],
    corners: [
      { number: 'T1–T2', name: 'Variante del Rettifilo', character: 'Heaviest braking of the season', position: 0.11 },
      { number: 'T3', name: 'Curva Grande', character: 'Flat-out right sweep', position: 0.2 },
      { number: 'T4–T5', name: 'Variante della Roggia', character: 'Kerb-riding chicane', position: 0.33 },
      { number: 'T6–T7', name: 'Lesmo 1 & 2', character: 'Paired medium rights', position: 0.45 },
      { number: 'T8–T10', name: 'Variante Ascari', character: 'Fast left-right-left', position: 0.7 },
      { number: 'T11', name: 'Curva Alboreto (Parabolica)', character: 'Long 180° right onto the straight', position: 0.88 },
    ],
    straights: [
      { name: 'Start/Finish Straight', length: '~1,120 m', note: 'Top speeds beyond 360 km/h.' },
      { name: 'Back Straight (Serraglio)', length: '~1,090 m', note: 'Between Lesmo 2 and Ascari.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Main straight', detection: 'Before Parabolica' },
      { name: 'DRS Zone 2', zone: 'Between Lesmo 2 and Ascari', detection: 'Before Lesmo 1' },
    ],
  },
  silverstone: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.32], summary: 'Abbey and Farm flat-out, into the Village–Loop complex and the Wellington straight.' },
      { name: 'Sector 2', range: [0.32, 0.68], summary: 'Brooklands, Luffield, then Copse and the iconic Maggotts–Becketts sweeps.' },
      { name: 'Sector 3', range: [0.68, 1], summary: 'Hangar Straight, Stowe, and the Vale chicane into Club.' },
    ],
    corners: [
      { number: 'T1', name: 'Abbey', character: 'Flat-out right kink', position: 0.03 },
      { number: 'T3–T4', name: 'Village & The Loop', character: 'Slow right-left complex', position: 0.12 },
      { number: 'T9', name: 'Copse', character: 'Legendary high-speed right', position: 0.48 },
      { number: 'T10–T13', name: 'Maggotts–Becketts–Chapel', character: 'The best esses in F1', position: 0.55 },
      { number: 'T15', name: 'Stowe', character: 'Fast right at the end of Hangar Straight', position: 0.75 },
      { number: 'T16–T17', name: 'Vale & Club', character: 'Final chicane-and-right onto the pit straight', position: 0.9 },
    ],
    straights: [
      { name: 'Hangar Straight', length: '~875 m', note: 'Between Chapel and Stowe.' },
      { name: 'Wellington Straight', length: '~770 m', note: 'DRS overtaking into Brooklands.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Wellington Straight', detection: 'Before The Loop' },
      { name: 'DRS Zone 2', zone: 'Hangar Straight', detection: 'Before Chapel' },
    ],
  },
  spa: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.3], summary: 'La Source hairpin, the plunge through Eau Rouge–Raidillon and the Kemmel straight.' },
      { name: 'Sector 2', range: [0.3, 0.72], summary: 'Les Combes to Pouhon — the fast, sweeping heart of the Ardennes.' },
      { name: 'Sector 3', range: [0.72, 1], summary: 'Stavelot, flat-out Blanchimont and the Bus Stop chicane.' },
    ],
    corners: [
      { number: 'T1', name: 'La Source', character: 'Tight opening hairpin', position: 0.02 },
      { number: 'T3–T5', name: 'Eau Rouge – Raidillon', character: 'The most famous compression in racing', position: 0.08 },
      { number: 'T7', name: 'Les Combes', character: 'Right-left at the end of Kemmel', position: 0.3 },
      { number: 'T10', name: 'Pouhon', character: 'Double-apex downhill left', position: 0.48 },
      { number: 'T15', name: 'Curve Paul Frère', character: 'Fast right leading to Blanchimont', position: 0.72 },
      { number: 'T18–T19', name: 'Bus Stop', character: 'Final chicane onto the pit straight', position: 0.94 },
    ],
    straights: [
      { name: 'Kemmel Straight', length: '~800 m', note: 'Uphill run after Raidillon — prime overtaking.' },
      { name: 'Start/Finish Straight', length: '~700 m', note: 'Short blast between Bus Stop and La Source.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Kemmel Straight', detection: 'Before Raidillon' },
      { name: 'DRS Zone 2', zone: 'Start/finish straight', detection: 'Before the Bus Stop' },
    ],
  },
  suzuka: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.33], summary: 'First corner sweep and the rhythm-critical S Curves up the hill.' },
      { name: 'Sector 2', range: [0.33, 0.72], summary: 'Dunlop, both Degners, the hairpin and the long approach to Spoon.' },
      { name: 'Sector 3', range: [0.72, 1], summary: 'Flat-out over the crossover, 130R, and the Casio Triangle chicane.' },
    ],
    corners: [
      { number: 'T1–T2', name: 'First Curve', character: 'Double-apex right taken at speed', position: 0.05 },
      { number: 'T3–T6', name: 'S Curves (Esses)', character: 'Perfect-rhythm left-right sequence', position: 0.14 },
      { number: 'T8–T9', name: 'Degner 1 & 2', character: 'Punishing double right', position: 0.35 },
      { number: 'T11', name: 'Hairpin', character: 'Slowest point of the lap', position: 0.45 },
      { number: 'T13–T14', name: 'Spoon Curve', character: 'Double-left feeding the back straight', position: 0.6 },
      { number: 'T15', name: '130R', character: 'Flat-out 130-metre-radius left', position: 0.8 },
      { number: 'T16–T17', name: 'Casio Triangle', character: 'Final chicane, classic lunge spot', position: 0.92 },
    ],
    straights: [
      { name: 'Crossover Back Straight', length: '~1,200 m', note: 'From Spoon over the bridge to 130R.' },
      { name: 'Start/Finish Straight', length: '~600 m', note: 'Downhill into Turn 1.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Start/finish straight', detection: 'Before the Casio Triangle' },
    ],
  },
  monaco: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.33], summary: 'Sainte Dévote and the climb up Beau Rivage to Casino Square.' },
      { name: 'Sector 2', range: [0.33, 0.7], summary: 'Mirabeau, the Fairmont Hairpin, Portier and the tunnel.' },
      { name: 'Sector 3', range: [0.7, 1], summary: 'Nouvelle Chicane, Tabac, the Swimming Pool and Rascasse.' },
    ],
    corners: [
      { number: 'T1', name: 'Sainte Dévote', character: 'Tight right, lap-one flashpoint', position: 0.04 },
      { number: 'T4', name: 'Casino Square', character: 'Blind crest left-right', position: 0.25 },
      { number: 'T6', name: 'Fairmont Hairpin', character: 'Slowest corner in F1 (~48 km/h)', position: 0.38 },
      { number: 'T8', name: 'Portier', character: 'Right-hander into the tunnel', position: 0.45 },
      { number: 'T10–T11', name: 'Nouvelle Chicane', character: 'Bumpy braking out of the tunnel', position: 0.62 },
      { number: 'T13–T16', name: 'Piscine (Swimming Pool)', character: 'Fast left-right, walls inches away', position: 0.78 },
      { number: 'T18', name: 'Rascasse', character: 'Second-gear left around the restaurant', position: 0.9 },
    ],
    straights: [
      { name: 'Tunnel Run', length: '~670 m', note: 'The only near-straight — curved, at 280+ km/h in the dark.' },
      { name: 'Start/Finish Straight', length: '~500 m', note: 'Short pit straight into Sainte Dévote.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Start/finish straight', detection: 'Before Rascasse' },
    ],
  },
  interlagos: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.3], summary: 'The Senna S plunge and the sweep of Curva do Sol onto Reta Oposta.' },
      { name: 'Sector 2', range: [0.3, 0.7], summary: 'Descida do Lago and the twisty infield up to Bico de Pato.' },
      { name: 'Sector 3', range: [0.7, 1], summary: 'Juncao and the long full-throttle climb across the line.' },
    ],
    corners: [
      { number: 'T1–T2', name: 'Senna S', character: 'Downhill left-right, prime overtaking', position: 0.03 },
      { number: 'T4', name: 'Descida do Lago', character: 'Fast double-left by the lake', position: 0.3 },
      { number: 'T8', name: 'Laranjinha', character: 'Slow infield left', position: 0.52 },
      { number: 'T10', name: 'Bico de Pato', character: 'Duck-bill hairpin right', position: 0.62 },
      { number: 'T12', name: 'Juncao', character: 'Left that decides the whole climb', position: 0.72 },
    ],
    straights: [
      { name: 'Reta Oposta', length: '~660 m', note: 'Back straight after the Senna S.' },
      { name: 'Subida dos Boxes', length: '~1,000 m flat-out', note: 'The uphill drag from Juncao across the line.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Reta Oposta', detection: 'Before the Senna S' },
      { name: 'DRS Zone 2', zone: 'Start/finish climb', detection: 'Before Juncao' },
    ],
  },
  baku: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.3], summary: 'Government House 90-degree corners along the boulevard grid.' },
      { name: 'Sector 2', range: [0.3, 0.62], summary: 'The narrow uphill castle section — millimetre precision required.' },
      { name: 'Sector 3', range: [0.62, 1], summary: 'The 2.2 km flat-out blast along the Caspian seafront.' },
    ],
    corners: [
      { number: 'T1', name: 'Turn 1', character: 'Heavy braking left off the main straight', position: 0.04 },
      { number: 'T3', name: 'Turn 3', character: '90-left, classic lock-up spot', position: 0.12 },
      { number: 'T8–T10', name: 'Castle Section', character: 'Narrowest stretch in F1 (7.6 m)', position: 0.42 },
      { number: 'T15', name: 'Turn 15', character: 'Downhill left onto the promenade', position: 0.6 },
      { number: 'T16–T20', name: 'Seafront Sweeps', character: 'Flat-out kinks building to 340 km/h', position: 0.78 },
    ],
    straights: [
      { name: 'Neftchilar Avenue Straight', length: '~2,200 m', note: 'Longest flat-out stretch on the calendar.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Main straight', detection: 'Before Turn 20' },
      { name: 'DRS Zone 2', zone: 'Between Turn 2 and Turn 3', detection: 'Before Turn 1' },
    ],
  },
  americas: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.32], summary: 'The steep run to the T1 hairpin and the Silverstone-style esses.' },
      { name: 'Sector 2', range: [0.32, 0.68], summary: 'T11 hairpin and the 1.2 km back straight.' },
      { name: 'Sector 3', range: [0.68, 1], summary: 'Stadium section and the triple-apex right onto the pit straight.' },
    ],
    corners: [
      { number: 'T1', name: 'Big Red', character: '40 m uphill braking into a blind hairpin', position: 0.04 },
      { number: 'T3–T6', name: 'The Esses', character: 'Maggotts-Becketts-inspired sweeps', position: 0.14 },
      { number: 'T11', name: 'Turn 11', character: 'Hairpin onto the back straight', position: 0.42 },
      { number: 'T12', name: 'Turn 12', character: 'Big stop at the end of the straight', position: 0.6 },
      { number: 'T16–T18', name: 'Triple Apex', character: 'Istanbul T8-inspired long right', position: 0.8 },
    ],
    straights: [
      { name: 'Back Straight (T11–T12)', length: '~1,200 m', note: 'The main overtaking drag.' },
      { name: 'Start/Finish Straight', length: '~450 m', note: 'Uphill launch toward Turn 1.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Back straight', detection: 'Before Turn 11' },
      { name: 'DRS Zone 2', zone: 'Start/finish straight', detection: 'Before Turn 19' },
    ],
  },
  bahrain: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.31], summary: 'Heavy braking into T1 and the run out to the T4 right-hander.' },
      { name: 'Sector 2', range: [0.31, 0.68], summary: 'The twisty infield: T5–T8 sweeps and the T9–T10 double-apex.' },
      { name: 'Sector 3', range: [0.68, 1], summary: 'T11 long left, the back straight kink and the final two corners.' },
    ],
    corners: [
      { number: 'T1', name: 'Turn 1', character: 'Signature big-stop right, race-deciding', position: 0.03 },
      { number: 'T4', name: 'Turn 4', character: 'Wide-entry right, run-off battles', position: 0.22 },
      { number: 'T9–T10', name: 'Turns 9–10', character: 'Off-camber double-left', position: 0.55 },
      { number: 'T11', name: 'Turn 11', character: 'Long loaded left onto the back section', position: 0.68 },
      { number: 'T13', name: 'Turn 13', character: 'Fast right before the final complex', position: 0.82 },
    ],
    straights: [
      { name: 'Start/Finish Straight', length: '~1,090 m', note: 'Main DRS drag into Turn 1.' },
      { name: 'Back Straight (T10–T11)', length: '~660 m', note: 'Second overtaking zone.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Main straight', detection: 'Before Turn 14' },
      { name: 'DRS Zone 2', zone: 'Between T10 and T11', detection: 'Before Turn 10' },
      { name: 'DRS Zone 3', zone: 'Between T3 and T4', detection: 'Before Turn 3' },
    ],
  },
  zandvoort: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.33], summary: 'Tarzan hairpin and the banked Hugenholtz bowl.' },
      { name: 'Sector 2', range: [0.33, 0.7], summary: 'The dunes rollercoaster through Scheivlak.' },
      { name: 'Sector 3', range: [0.7, 1], summary: 'The chicane and the 18-degree banked final corner.' },
    ],
    corners: [
      { number: 'T1', name: 'Tarzanbocht', character: 'Wide banked hairpin, main overtaking spot', position: 0.05 },
      { number: 'T3', name: 'Hugenholtzbocht', character: '19-degree banked left bowl', position: 0.15 },
      { number: 'T7', name: 'Scheivlak', character: 'Blind, fast right over the dunes', position: 0.38 },
      { number: 'T11–T12', name: 'Hans Ernst Chicane', character: 'Slow left-right', position: 0.68 },
      { number: 'T14', name: 'Arie Luyendykbocht', character: '18-degree banking slingshot onto the straight', position: 0.92 },
    ],
    straights: [
      { name: 'Start/Finish Straight', length: '~680 m', note: 'DRS opens out of the banked final corner.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Main straight', detection: 'Before Turn 13' },
      { name: 'DRS Zone 2', zone: 'Between T10 and T11', detection: 'Before Turn 10' },
    ],
  },
  jeddah: {
    sectors: [
      { name: 'Sector 1', range: [0, 0.33], summary: 'T1–T2 complex and the first high-speed wall-lined esses.' },
      { name: 'Sector 2', range: [0.33, 0.68], summary: 'The banked T13 left and the flowing corniche switchbacks.' },
      { name: 'Sector 3', range: [0.68, 1], summary: 'Flat-out kinks and the T27 final hairpin-right onto the pit straight.' },
    ],
    corners: [
      { number: 'T1', name: 'Turn 1', character: 'Tight left, the only real stop in sector 1', position: 0.03 },
      { number: 'T13', name: 'Turn 13', character: '12-degree banked left', position: 0.42 },
      { number: 'T22–T23', name: 'Corniche Esses', character: 'Fastest street-circuit sweeps in F1', position: 0.72 },
      { number: 'T27', name: 'Turn 27', character: 'Last corner, launching the DRS train', position: 0.95 },
    ],
    straights: [
      { name: 'Start/Finish Straight', length: '~830 m', note: 'Pit straight along the lagoon.' },
      { name: 'Back "Straight" (T25–T27)', length: '~800 m', note: 'Curved full-throttle run.' },
    ],
    drsZones: [
      { name: 'DRS Zone 1', zone: 'Main straight', detection: 'Before Turn 27' },
      { name: 'DRS Zone 2', zone: 'Between T20 and T22', detection: 'Before Turn 19' },
      { name: 'DRS Zone 3', zone: 'Between T25 and T27', detection: 'Before Turn 25' },
    ],
  },
};

const FALLBACK_SECTOR_SUMMARIES = [
  'Opening sector — pit straight and the first corner complex.',
  'Middle sector — the technical heart of the lap.',
  'Final sector — the run back to the start/finish line.',
];

const decorateSectors = (sectors) => sectors.map((sector, index) => ({
  id: `sector${index + 1}`,
  label: `SECTOR ${index + 1}`,
  color: SECTOR_COLORS[index % SECTOR_COLORS.length],
  ...sector,
}));

const buildFallbackSections = (circuit) => {
  const circuitId = normalizeCircuitId(circuit?.id ?? '');
  const curatedCorners = hasCuratedCorners(circuitId);
  const corners = curatedCorners
    ? getCornersForCircuit(circuitId).map((corner, index, list) => ({
      number: corner.number,
      name: corner.name,
      character: `${CORNER_TYPE_LABELS[corner.type]} · ${corner.direction === 'left' ? 'Left' : 'Right'}`,
      position: (index + 1) / (list.length + 1),
    }))
    : [];

  const drsCount = Number.parseInt(circuit?.stats?.drsZones ?? '', 10);
  const drsZones = Number.isFinite(drsCount) && drsCount > 0
    ? Array.from({ length: drsCount }, (_, index) => ({
      name: `DRS Zone ${index + 1}`,
      zone: 'Official zone mapping pending',
      detection: 'TBA',
    }))
    : [];

  return {
    circuitId,
    curated: false,
    sectors: decorateSectors(
      FALLBACK_SECTOR_SUMMARIES.map((summary, index) => ({
        name: `Sector ${index + 1}`,
        range: [index / 3, (index + 1) / 3],
        summary,
      })),
    ),
    corners,
    straights: [
      { name: 'Start/Finish Straight', length: 'TBA', note: 'Detailed section data has not been mapped yet.' },
    ],
    drsZones,
    startFinish: { position: 0 },
  };
};

export const getCircuitSections = (circuit) => {
  const circuitId = normalizeCircuitId(circuit?.id ?? '');
  const curated = CURATED_SECTIONS[circuitId];
  if (!curated) return buildFallbackSections(circuit);

  return {
    circuitId,
    curated: true,
    sectors: decorateSectors(curated.sectors),
    corners: curated.corners,
    straights: curated.straights,
    drsZones: curated.drsZones,
    startFinish: { position: 0 },
  };
};

export const hasCuratedSections = (circuitId) => Boolean(CURATED_SECTIONS[normalizeCircuitId(circuitId ?? '')]);

// Sector containing a lap fraction (0–1) — used by the simulation HUD.
export const getSectorAtProgress = (sections, progress) => {
  if (!sections?.sectors?.length) return null;
  const wrapped = ((progress % 1) + 1) % 1;
  return sections.sectors.find(({ range }) => wrapped >= range[0] && wrapped < range[1])
    ?? sections.sectors[sections.sectors.length - 1];
};
