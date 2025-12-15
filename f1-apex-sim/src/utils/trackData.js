export const TRACKS = {
  monza: {
    id: "monza",
    name: "Autodromo Nazionale Monza",
    country: "ITA",
    svgPath: "/RaceCircuitAutodromaDiMonza.svg",
    stats: {
      length: "5.793 km",
      firstGP: "1950",
      laps: "53",
      lapRecord: { time: "1:20.097", driver: "Rubens Barrichello (2004)" }
    },
    viewBox: { width: 516.66, height: 263.84 },

    // Monza SVG Path Analizi:
    // Path sol üstten başlıyor (4, 29), aşağı doğru gidiyor (uzun düzlük)
    // sonra güneye (aşağı) devam ediyor, alt ortaya geliyor, sağa dönüyor
    // üst tarafa çıkıyor ve tekrar başlangıca geliyor
    //
    // Path Direction: Clockwise (saat yönünde)
    // Start position: Sol üst köşe (Start/Finish Line)

    // Sektörler - Path yüzdesine göre
    sectors: [
      {
        id: "sector1",
        name: "SECTOR 1",
        color: "#FF1E46", // Kırmızı
        label: "SECTOR 1",
        corners: [1, 2, 3], // Variante del Rettifilo + Curva Grande
        pathRange: { start: 0, end: 0.33 }
      },
      {
        id: "sector2",
        name: "SECTOR 2",
        color: "#00E5FF", // Cyan
        label: "SECTOR 2",
        corners: [4, 5, 6, 7], // Della Roggia + Lesmos
        pathRange: { start: 0.33, end: 0.60 }
      },
      {
        id: "sector3",
        name: "SECTOR 3",
        color: "#FFF01E", // Sarı
        label: "SECTOR 3",
        corners: [8, 9, 10, 11], // Ascari + Parabolica
        pathRange: { start: 0.60, end: 1.0 }
      }
    ],

    // Virajlar - trackPosition: pistin hangi noktasında (0.0 - 1.0 arası)
    // Monza Layout (saat yönünde):
    // 0.00 - Start/Finish (sol üst)
    // 0.02-0.08 - Aşağıya düzlük
    // 0.08-0.12 - T1-T2 Variante del Rettifilo (şikan)
    // 0.15-0.25 - Curva Grande (büyük sağ dönüş) 
    // 0.30-0.38 - T4-T5 Variante della Roggia (şikan)
    // 0.40-0.45 - T6 Lesmo 1
    // 0.48-0.52 - T7 Lesmo 2
    // 0.58-0.72 - T8-T9-T10 Variante Ascari (3'lü şikan)
    // 0.80-0.95 - T11 Parabolica (uzun sağ dönüş)
    corners: [
      // Sector 1 - Variante del Rettifilo (ilk şikan) + Curva Grande
      { id: 1, name: "T1 Variante del Rettifilo", number: "01", trackPosition: 0.08 },
      { id: 2, name: "T2 Variante del Rettifilo", number: "02", trackPosition: 0.11 },
      { id: 3, name: "T3 Curva Grande", number: "03", trackPosition: 0.22 },

      // Sector 2 - Variante della Roggia + Lesmos
      { id: 4, name: "T4 Variante della Roggia", number: "04", trackPosition: 0.34 },
      { id: 5, name: "T5 Variante della Roggia", number: "05", trackPosition: 0.38 },
      { id: 6, name: "T6 Lesmo 1", number: "06", trackPosition: 0.44 },
      { id: 7, name: "T7 Lesmo 2", number: "07", trackPosition: 0.52 },

      // Sector 3 - Variante Ascari + Parabolica
      { id: 8, name: "T8 Variante Ascari", number: "08", trackPosition: 0.62 },
      { id: 9, name: "T9 Variante Ascari", number: "09", trackPosition: 0.67 },
      { id: 10, name: "T10 Variante Ascari", number: "10", trackPosition: 0.72 },
      { id: 11, name: "T11 Parabolica (Curva Alboreto)", number: "11", trackPosition: 0.88 }
    ],

    // DRS Zonları
    drsZones: [
      {
        id: "drs1",
        name: "DRS ZONE 1",
        detectionPosition: 0.50, // Lesmo 2 çıkışı
        activationPosition: 0.55, // Ascari öncesi düzlük
        color: "#00FF41"
      },
      {
        id: "drs2",
        name: "DRS ZONE 2",
        detectionPosition: 0.92, // Parabolica çıkışı
        activationPosition: 0.98, // Start/Finish düzlüğü
        color: "#00FF41"
      }
    ],

    // Speed Trap - Ana düzlükte (Start/Finish öncesi)
    speedTrap: {
      trackPosition: 0.96,
      label: "SPEED TRAP"
    },

    // Start/Finish line
    startFinish: {
      trackPosition: 0.0
    }
  },

  silverstone: {
    id: "silverstone",
    name: "Silverstone Circuit",
    country: "GBR",
    svgPath: "/RaceCircuitSilverstone.svg",
    stats: {
      length: "5.891 km",
      firstGP: "1950",
      laps: "52",
      lapRecord: { time: "1:27.097", driver: "Max Verstappen (2020)" }
    },
    viewBox: { width: 425.69, height: 327.11 },

    // Silverstone SVG Analizi:
    // Path sol üstten başlıyor, aşağı ve sağa doğru gidiyor
    // Karmaşık bir şekil, ters yönde (counter-clockwise gözüküyor)

    // Sektörler
    sectors: [
      {
        id: "sector1",
        name: "SECTOR 1",
        color: "#FF1E46",
        label: "SECTOR 1",
        corners: [1, 2, 3, 4, 5, 6], // Abbey'den Wellington'a
        pathRange: { start: 0, end: 0.33 }
      },
      {
        id: "sector2",
        name: "SECTOR 2",
        color: "#00E5FF",
        label: "SECTOR 2",
        corners: [7, 8, 9], // Brooklands, Luffield, Copse
        pathRange: { start: 0.33, end: 0.55 }
      },
      {
        id: "sector3",
        name: "SECTOR 3",
        color: "#FFF01E",
        label: "SECTOR 3",
        corners: [10, 11, 12, 13, 14, 15, 16, 17, 18], // Maggots'tan Club'a
        pathRange: { start: 0.55, end: 1.0 }
      }
    ],

    // Virajlar - trackPosition
    // Silverstone Layout:
    // 0.00 - Start/Finish
    // 0.02 - Abbey
    // 0.06 - Farm
    // ... devam ediyor
    corners: [
      // Sector 1 - Abbey'den Wellington'a
      { id: 1, name: "T1 Abbey", number: "01", trackPosition: 0.02 },
      { id: 2, name: "T2 Farm", number: "02", trackPosition: 0.06 },
      { id: 3, name: "T3 Village", number: "03", trackPosition: 0.10 },
      { id: 4, name: "T4 The Loop", number: "04", trackPosition: 0.15 },
      { id: 5, name: "T5 Aintree", number: "05", trackPosition: 0.20 },
      { id: 6, name: "T6 Wellington Straight", number: "06", trackPosition: 0.26 },

      // Sector 2 - Brooklands, Luffield, Copse  
      { id: 7, name: "T7 Brooklands", number: "07", trackPosition: 0.35 },
      { id: 8, name: "T8 Luffield", number: "08", trackPosition: 0.42 },
      { id: 9, name: "T9 Copse", number: "09", trackPosition: 0.52 },

      // Sector 3 - Maggots, Becketts, Chapel, Stowe, Vale, Club
      { id: 10, name: "T10 Maggots", number: "10", trackPosition: 0.58 },
      { id: 11, name: "T11 Becketts", number: "11", trackPosition: 0.62 },
      { id: 12, name: "T12 Chapel", number: "12", trackPosition: 0.66 },
      { id: 13, name: "T13 Hangar Straight", number: "13", trackPosition: 0.72 },
      { id: 14, name: "T14 Stowe", number: "14", trackPosition: 0.78 },
      { id: 15, name: "T15 Vale", number: "15", trackPosition: 0.84 },
      { id: 16, name: "T16 Club", number: "16", trackPosition: 0.88 },
      { id: 17, name: "T17", number: "17", trackPosition: 0.92 },
      { id: 18, name: "T18", number: "18", trackPosition: 0.96 }
    ],

    // DRS Zonları
    drsZones: [
      {
        id: "drs1",
        name: "DRS ZONE 1",
        detectionPosition: 0.40,
        activationPosition: 0.48,
        color: "#00FF41"
      },
      {
        id: "drs2",
        name: "DRS ZONE 2",
        detectionPosition: 0.68,
        activationPosition: 0.74,
        color: "#00FF41"
      }
    ],

    // Speed Trap
    speedTrap: {
      trackPosition: 0.75,
      label: "SPEED TRAP"
    },

    // Start/Finish line
    startFinish: {
      trackPosition: 0.0
    }
  }
};