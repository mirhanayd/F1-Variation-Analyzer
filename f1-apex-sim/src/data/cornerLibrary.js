import { normalizeCircuitId } from './circuitRegistry';

// Signature corners per circuit. Geometry values (radius in metres, total direction
// change in degrees, entry/exit straight lengths in metres) are simplified
// approximations tuned for the PITWALL corner simulator — not survey data.
//
// type: hairpin | chicane | slow | medium | fast

export const CORNER_TYPE_LABELS = {
  hairpin: 'Hairpin',
  chicane: 'Chicane',
  slow: 'Slow corner',
  medium: 'Medium corner',
  fast: 'High-speed corner',
};

const CIRCUIT_CORNERS = {
  albert_park: [
    { id: 't1', name: 'Brabham (Turn 1–2)', number: 'T1–T2', type: 'chicane', direction: 'right', radius: 42, angle: 100, entryLength: 300, exitLength: 170 },
    { id: 't6', name: 'Turn 6', number: 'T6', type: 'fast', direction: 'right', radius: 140, angle: 70, entryLength: 220, exitLength: 190 },
    { id: 't11', name: 'Turn 11–12', number: 'T11–T12', type: 'chicane', direction: 'right', radius: 95, angle: 85, entryLength: 280, exitLength: 210 },
  ],
  shanghai: [
    { id: 't1', name: 'The Snail (Turn 1–2)', number: 'T1–T2', type: 'slow', direction: 'right', radius: 36, angle: 170, entryLength: 320, exitLength: 130 },
    { id: 't7', name: 'Turn 7–8 Esses', number: 'T7–T8', type: 'chicane', direction: 'left', radius: 90, angle: 90, entryLength: 190, exitLength: 170 },
    { id: 't14', name: 'Turn 14 Hairpin', number: 'T14', type: 'hairpin', direction: 'right', radius: 18, angle: 160, entryLength: 380, exitLength: 220 },
  ],
  suzuka: [
    { id: 'esses', name: 'The Esses (Turn 3–6)', number: 'T3–T6', type: 'chicane', direction: 'left', radius: 85, angle: 110, entryLength: 210, exitLength: 160 },
    { id: 'spoon', name: 'Spoon Curve', number: 'T13–T14', type: 'medium', direction: 'left', radius: 55, angle: 150, entryLength: 260, exitLength: 240 },
    { id: '130r', name: '130R', number: 'T15', type: 'fast', direction: 'left', radius: 210, angle: 55, entryLength: 300, exitLength: 250 },
    { id: 'casio', name: 'Casio Triangle', number: 'T16–T17', type: 'chicane', direction: 'right', radius: 22, angle: 100, entryLength: 280, exitLength: 150 },
  ],
  bahrain: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'right', radius: 35, angle: 95, entryLength: 340, exitLength: 160 },
    { id: 't9', name: 'Turn 9–10', number: 'T9–T10', type: 'slow', direction: 'left', radius: 40, angle: 120, entryLength: 230, exitLength: 180 },
    { id: 't11', name: 'Turn 11', number: 'T11', type: 'medium', direction: 'left', radius: 70, angle: 90, entryLength: 200, exitLength: 220 },
  ],
  jeddah: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'left', radius: 30, angle: 100, entryLength: 330, exitLength: 150 },
    { id: 't13', name: 'Turn 13 (banked)', number: 'T13', type: 'hairpin', direction: 'left', radius: 60, angle: 180, entryLength: 210, exitLength: 180 },
    { id: 't27', name: 'Turn 27', number: 'T27', type: 'fast', direction: 'right', radius: 150, angle: 70, entryLength: 320, exitLength: 260 },
  ],
  miami: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'medium', direction: 'right', radius: 55, angle: 90, entryLength: 280, exitLength: 170 },
    { id: 't11', name: 'Turn 11', number: 'T11', type: 'hairpin', direction: 'left', radius: 25, angle: 140, entryLength: 260, exitLength: 200 },
    { id: 't17', name: 'Turn 17', number: 'T17', type: 'slow', direction: 'left', radius: 35, angle: 90, entryLength: 350, exitLength: 220 },
  ],
  villeneuve: [
    { id: 't1', name: 'Virage Senna (Turn 1–2)', number: 'T1–T2', type: 'chicane', direction: 'left', radius: 45, angle: 110, entryLength: 260, exitLength: 170 },
    { id: 'hairpin', name: "L'Epingle Hairpin", number: 'T10', type: 'hairpin', direction: 'right', radius: 15, angle: 170, entryLength: 320, exitLength: 250 },
    { id: 'wall', name: 'Wall of Champions Chicane', number: 'T13–T14', type: 'chicane', direction: 'right', radius: 40, angle: 90, entryLength: 340, exitLength: 140 },
  ],
  monaco: [
    { id: 'saintedevote', name: 'Sainte Devote', number: 'T1', type: 'slow', direction: 'right', radius: 28, angle: 85, entryLength: 220, exitLength: 150 },
    { id: 'hairpin', name: 'Fairmont Hairpin', number: 'T6', type: 'hairpin', direction: 'left', radius: 10, angle: 180, entryLength: 130, exitLength: 90 },
    { id: 'piscine', name: 'Piscine (Swimming Pool)', number: 'T13–T16', type: 'chicane', direction: 'left', radius: 45, angle: 85, entryLength: 170, exitLength: 130 },
  ],
  catalunya: [
    { id: 't1', name: 'Elf (Turn 1–2)', number: 'T1–T2', type: 'medium', direction: 'right', radius: 60, angle: 110, entryLength: 320, exitLength: 180 },
    { id: 't3', name: 'Renault (Turn 3)', number: 'T3', type: 'fast', direction: 'right', radius: 130, angle: 90, entryLength: 190, exitLength: 200 },
    { id: 't10', name: 'La Caixa', number: 'T10', type: 'slow', direction: 'left', radius: 35, angle: 120, entryLength: 260, exitLength: 170 },
  ],
  red_bull_ring: [
    { id: 't1', name: 'Niki Lauda Kurve', number: 'T1', type: 'slow', direction: 'right', radius: 40, angle: 75, entryLength: 280, exitLength: 190 },
    { id: 't3', name: 'Remus', number: 'T3', type: 'hairpin', direction: 'right', radius: 25, angle: 120, entryLength: 330, exitLength: 200 },
    { id: 't9', name: 'Rindt (Turn 9–10)', number: 'T9–T10', type: 'fast', direction: 'right', radius: 110, angle: 80, entryLength: 220, exitLength: 240 },
  ],
  silverstone: [
    { id: 'copse', name: 'Copse', number: 'T9', type: 'fast', direction: 'right', radius: 140, angle: 80, entryLength: 260, exitLength: 200 },
    { id: 'maggotts', name: 'Maggotts–Becketts', number: 'T10–T13', type: 'chicane', direction: 'left', radius: 100, angle: 120, entryLength: 240, exitLength: 190 },
    { id: 'stowe', name: 'Stowe', number: 'T15', type: 'fast', direction: 'right', radius: 110, angle: 90, entryLength: 300, exitLength: 170 },
    { id: 'loop', name: 'Village–The Loop', number: 'T3–T4', type: 'chicane', direction: 'right', radius: 30, angle: 130, entryLength: 220, exitLength: 150 },
  ],
  spa: [
    { id: 'lasource', name: 'La Source', number: 'T1', type: 'hairpin', direction: 'right', radius: 20, angle: 150, entryLength: 230, exitLength: 170 },
    { id: 'eaurouge', name: 'Eau Rouge–Raidillon', number: 'T3–T5', type: 'fast', direction: 'left', radius: 160, angle: 90, entryLength: 280, exitLength: 300 },
    { id: 'pouhon', name: 'Pouhon', number: 'T10', type: 'fast', direction: 'left', radius: 120, angle: 100, entryLength: 240, exitLength: 210 },
    { id: 'busstop', name: 'Bus Stop Chicane', number: 'T18–T19', type: 'chicane', direction: 'right', radius: 25, angle: 90, entryLength: 340, exitLength: 110 },
  ],
  hungaroring: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'right', radius: 38, angle: 110, entryLength: 300, exitLength: 180 },
    { id: 't2', name: 'Turn 2', number: 'T2', type: 'medium', direction: 'left', radius: 55, angle: 100, entryLength: 170, exitLength: 160 },
    { id: 't14', name: 'Turn 14', number: 'T14', type: 'medium', direction: 'right', radius: 50, angle: 90, entryLength: 220, exitLength: 260 },
  ],
  zandvoort: [
    { id: 'tarzan', name: 'Tarzanbocht', number: 'T1', type: 'hairpin', direction: 'right', radius: 35, angle: 150, entryLength: 300, exitLength: 180 },
    { id: 'hugenholtz', name: 'Hugenholtzbocht (banked)', number: 'T3', type: 'slow', direction: 'left', radius: 30, angle: 130, entryLength: 170, exitLength: 180 },
    { id: 'luyendyk', name: 'Arie Luyendykbocht (banked)', number: 'T14', type: 'fast', direction: 'right', radius: 160, angle: 110, entryLength: 240, exitLength: 300 },
  ],
  monza: [
    { id: 'rettifilo', name: 'Variante del Rettifilo', number: 'T1–T2', type: 'chicane', direction: 'right', radius: 20, angle: 110, entryLength: 380, exitLength: 170 },
    { id: 'grande', name: 'Curva Grande', number: 'T3', type: 'fast', direction: 'right', radius: 220, angle: 60, entryLength: 200, exitLength: 280 },
    { id: 'roggia', name: 'Variante della Roggia', number: 'T4–T5', type: 'chicane', direction: 'left', radius: 28, angle: 100, entryLength: 300, exitLength: 160 },
    { id: 'lesmo1', name: 'Lesmo 1', number: 'T6', type: 'medium', direction: 'right', radius: 65, angle: 90, entryLength: 180, exitLength: 160 },
    { id: 'parabolica', name: 'Curva Alboreto (Parabolica)', number: 'T11', type: 'fast', direction: 'right', radius: 90, angle: 160, entryLength: 260, exitLength: 300 },
  ],
  madring: [
    { id: 'monumental', name: 'La Monumental (banked)', number: 'T12', type: 'fast', direction: 'left', radius: 130, angle: 120, entryLength: 260, exitLength: 280 },
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'right', radius: 40, angle: 90, entryLength: 300, exitLength: 170 },
    { id: 'chicane', name: 'Chicane complex', number: 'T5–T6', type: 'chicane', direction: 'left', radius: 35, angle: 90, entryLength: 240, exitLength: 150 },
  ],
  baku: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'left', radius: 35, angle: 90, entryLength: 360, exitLength: 170 },
    { id: 'castle', name: 'Castle Section', number: 'T8–T9', type: 'slow', direction: 'left', radius: 20, angle: 80, entryLength: 150, exitLength: 130 },
    { id: 't15', name: 'Turn 15', number: 'T15', type: 'slow', direction: 'left', radius: 30, angle: 100, entryLength: 300, exitLength: 210 },
  ],
  marina_bay: [
    { id: 't1', name: 'Turn 1–3', number: 'T1–T3', type: 'chicane', direction: 'left', radius: 40, angle: 120, entryLength: 280, exitLength: 150 },
    { id: 't10', name: 'Turn 10', number: 'T10', type: 'slow', direction: 'left', radius: 25, angle: 90, entryLength: 230, exitLength: 150 },
    { id: 't14', name: 'Turn 14', number: 'T14', type: 'slow', direction: 'right', radius: 30, angle: 90, entryLength: 260, exitLength: 170 },
  ],
  americas: [
    { id: 't1', name: 'Turn 1 (uphill)', number: 'T1', type: 'hairpin', direction: 'left', radius: 30, angle: 130, entryLength: 320, exitLength: 190 },
    { id: 'esses', name: 'The Esses (Turn 3–6)', number: 'T3–T6', type: 'chicane', direction: 'right', radius: 95, angle: 120, entryLength: 240, exitLength: 190 },
    { id: 't11', name: 'Turn 11 Hairpin', number: 'T11', type: 'hairpin', direction: 'left', radius: 22, angle: 160, entryLength: 300, exitLength: 320 },
  ],
  rodriguez: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'right', radius: 40, angle: 90, entryLength: 380, exitLength: 170 },
    { id: 'esses', name: 'Turn 4–5 Esses', number: 'T4–T5', type: 'chicane', direction: 'left', radius: 60, angle: 100, entryLength: 220, exitLength: 180 },
    { id: 'forosol', name: 'Foro Sol Stadium', number: 'T13–T15', type: 'chicane', direction: 'left', radius: 30, angle: 120, entryLength: 190, exitLength: 150 },
  ],
  interlagos: [
    { id: 'sennas', name: 'Senna S', number: 'T1–T2', type: 'chicane', direction: 'left', radius: 45, angle: 120, entryLength: 300, exitLength: 190 },
    { id: 'lago', name: 'Descida do Lago', number: 'T4', type: 'medium', direction: 'left', radius: 80, angle: 90, entryLength: 240, exitLength: 220 },
    { id: 'juncao', name: 'Juncao', number: 'T12', type: 'medium', direction: 'left', radius: 55, angle: 80, entryLength: 210, exitLength: 300 },
  ],
  vegas: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'slow', direction: 'left', radius: 30, angle: 90, entryLength: 300, exitLength: 170 },
    { id: 't5', name: 'Turn 5', number: 'T5', type: 'medium', direction: 'left', radius: 60, angle: 90, entryLength: 240, exitLength: 210 },
    { id: 't14', name: 'Turn 14 (end of the Strip)', number: 'T14', type: 'slow', direction: 'left', radius: 28, angle: 90, entryLength: 400, exitLength: 190 },
  ],
  losail: [
    { id: 't1', name: 'Turn 1', number: 'T1', type: 'medium', direction: 'right', radius: 70, angle: 90, entryLength: 320, exitLength: 200 },
    { id: 't6', name: 'Turn 6', number: 'T6', type: 'slow', direction: 'left', radius: 40, angle: 80, entryLength: 190, exitLength: 170 },
    { id: 't12', name: 'Turn 12–14 (triple right)', number: 'T12–T14', type: 'fast', direction: 'right', radius: 130, angle: 140, entryLength: 220, exitLength: 220 },
  ],
  yas_marina: [
    { id: 't5', name: 'Turn 5 Hairpin', number: 'T5', type: 'hairpin', direction: 'left', radius: 25, angle: 150, entryLength: 300, exitLength: 250 },
    { id: 't6', name: 'Turn 6–7 Chicane', number: 'T6–T7', type: 'chicane', direction: 'left', radius: 35, angle: 100, entryLength: 260, exitLength: 150 },
    { id: 't9', name: 'Turn 9', number: 'T9', type: 'slow', direction: 'left', radius: 30, angle: 90, entryLength: 380, exitLength: 210 },
  ],
  istanbul: [
    { id: 't1', name: 'Turn 1 (downhill)', number: 'T1', type: 'slow', direction: 'left', radius: 45, angle: 100, entryLength: 300, exitLength: 180 },
    { id: 't8', name: 'Turn 8 (quadruple apex)', number: 'T8', type: 'fast', direction: 'left', radius: 130, angle: 180, entryLength: 240, exitLength: 220 },
    { id: 't12', name: 'Turn 12', number: 'T12', type: 'slow', direction: 'left', radius: 35, angle: 100, entryLength: 340, exitLength: 170 },
  ],
  sepang: [
    { id: 't1', name: 'Turn 1–2', number: 'T1–T2', type: 'slow', direction: 'right', radius: 40, angle: 150, entryLength: 320, exitLength: 150 },
    { id: 'esses', name: 'Turn 5–6 Esses', number: 'T5–T6', type: 'chicane', direction: 'left', radius: 110, angle: 100, entryLength: 220, exitLength: 200 },
    { id: 't15', name: 'Turn 15 Hairpin', number: 'T15', type: 'hairpin', direction: 'left', radius: 22, angle: 170, entryLength: 360, exitLength: 260 },
  ],
  imola: [
    { id: 'tamburello', name: 'Variante Tamburello', number: 'T2–T4', type: 'chicane', direction: 'left', radius: 40, angle: 110, entryLength: 320, exitLength: 190 },
    { id: 'acque', name: 'Acque Minerali', number: 'T11–T12', type: 'medium', direction: 'right', radius: 55, angle: 120, entryLength: 240, exitLength: 170 },
    { id: 'rivazza', name: 'Rivazza', number: 'T17–T18', type: 'slow', direction: 'left', radius: 45, angle: 140, entryLength: 260, exitLength: 220 },
  ],
  portimao: [
    { id: 't1', name: 'Turn 1 (downhill)', number: 'T1', type: 'medium', direction: 'right', radius: 70, angle: 100, entryLength: 320, exitLength: 210 },
    { id: 't5', name: 'Turn 5 Hairpin', number: 'T5', type: 'hairpin', direction: 'left', radius: 25, angle: 150, entryLength: 260, exitLength: 200 },
    { id: 't15', name: 'Turn 15 (uphill exit)', number: 'T15', type: 'fast', direction: 'right', radius: 90, angle: 90, entryLength: 210, exitLength: 280 },
  ],
  hockenheim: [
    { id: 't1', name: 'Nordkurve', number: 'T1', type: 'fast', direction: 'right', radius: 110, angle: 70, entryLength: 280, exitLength: 210 },
    { id: 'spitzkehre', name: 'Spitzkehre Hairpin', number: 'T6', type: 'hairpin', direction: 'right', radius: 20, angle: 170, entryLength: 360, exitLength: 240 },
    { id: 'sachs', name: 'Sachskurve', number: 'T12', type: 'hairpin', direction: 'left', radius: 30, angle: 140, entryLength: 190, exitLength: 170 },
  ],
  nurburgring: [
    { id: 'castrol', name: 'Castrol-S', number: 'T1–T2', type: 'chicane', direction: 'left', radius: 45, angle: 130, entryLength: 300, exitLength: 170 },
    { id: 'dunlop', name: 'Dunlop-Kehre', number: 'T7', type: 'hairpin', direction: 'right', radius: 28, angle: 160, entryLength: 240, exitLength: 210 },
    { id: 'chicane', name: 'NGK Chicane', number: 'T13–T14', type: 'chicane', direction: 'right', radius: 30, angle: 100, entryLength: 320, exitLength: 150 },
  ],
  paul_ricard: [
    { id: 'mistral', name: 'Mistral Chicane', number: 'T8–T9', type: 'chicane', direction: 'right', radius: 60, angle: 90, entryLength: 400, exitLength: 300 },
    { id: 'signes', name: 'Signes', number: 'T10', type: 'fast', direction: 'right', radius: 170, angle: 65, entryLength: 320, exitLength: 240 },
    { id: 'beausset', name: 'Le Beausset', number: 'T11', type: 'medium', direction: 'right', radius: 60, angle: 130, entryLength: 220, exitLength: 210 },
  ],
  sochi: [
    { id: 't2', name: 'Turn 2', number: 'T2', type: 'slow', direction: 'right', radius: 40, angle: 100, entryLength: 320, exitLength: 170 },
    { id: 't3', name: 'Turn 3 (long left)', number: 'T3', type: 'fast', direction: 'left', radius: 140, angle: 170, entryLength: 260, exitLength: 210 },
    { id: 't13', name: 'Turn 13', number: 'T13', type: 'hairpin', direction: 'right', radius: 30, angle: 130, entryLength: 280, exitLength: 190 },
  ],
};

export const GENERIC_CORNERS = [
  { id: 'generic-hairpin', name: 'Heavy-braking hairpin', number: 'S1', type: 'hairpin', direction: 'right', radius: 22, angle: 165, entryLength: 340, exitLength: 240, generic: true },
  { id: 'generic-chicane', name: 'Technical chicane', number: 'S2', type: 'chicane', direction: 'left', radius: 35, angle: 100, entryLength: 280, exitLength: 170, generic: true },
  { id: 'generic-sweeper', name: 'Flowing sweeper', number: 'S3', type: 'fast', direction: 'right', radius: 150, angle: 80, entryLength: 260, exitLength: 240, generic: true },
  { id: 'generic-ninety', name: 'Standard 90° corner', number: 'S4', type: 'slow', direction: 'right', radius: 45, angle: 90, entryLength: 300, exitLength: 190, generic: true },
];

export const getCornersForCircuit = (circuitId) => {
  const corners = CIRCUIT_CORNERS[normalizeCircuitId(circuitId)];
  if (!corners?.length) return GENERIC_CORNERS;

  return corners.map((corner) => ({
    ...corner,
    id: `${normalizeCircuitId(circuitId)}-${corner.id}`,
  }));
};

export const hasCuratedCorners = (circuitId) => Boolean(CIRCUIT_CORNERS[normalizeCircuitId(circuitId)]?.length);
