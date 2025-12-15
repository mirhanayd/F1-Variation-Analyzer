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
    viewBox: "0 0 516.66 263.84",
    
    // Sektörler (Görseldeki gibi)
    sectors: [
      {
        id: "sector1",
        name: "SECTOR 1",
        color: "#FF1E46", // Kırmızı
        label: "SECTOR 1",
        corners: [1, 2, 3, 4, 5]
      },
      {
        id: "sector2",
        name: "SECTOR 2", 
        color: "#00E5FF", // Cyan
        label: "SECTOR 2",
        corners: [6, 7, 8, 9, 10]
      },
      {
        id: "sector3",
        name: "SECTOR 3",
        color: "#FFF01E", // Sarı
        label: "SECTOR 3",
        corners: [11]
      }
    ],

    // Virajlar (SVG koordinatlarına göre düzeltilmiş)
    corners: [
      { id: 1, name: "T1 Rettifilo", number: "01", position: { x: "45%", y: "50%" } },
      { id: 2, name: "T2 Rettifilo", number: "02", position: { x: "40%", y: "62%" } },
      { id: 3, name: "T3 Curva Grande", number: "03", position: { x: "42%", y: "78%" } },
      { id: 4, name: "T4 Variante della Roggia", number: "04", position: { x: "35%", y: "88%" } },
      { id: 5, name: "T5 Variante della Roggia", number: "05", position: { x: "38%", y: "82%" } },
      { id: 6, name: "T6 Lesmo 1", number: "06", position: { x: "58%", y: "65%" } },
      { id: 7, name: "T7 Lesmo 2", number: "07", position: { x: "70%", y: "45%" } },
      { id: 8, name: "T8 Serraglio", number: "08", position: { x: "78%", y: "52%" } },
      { id: 9, name: "T9", number: "09", position: { x: "92%", y: "82%" } },
      { id: 11, name: "T11 Parabolica", number: "11", position: { x: "50%", y: "96%" } },
      { id: 12, name: "T12", number: "12", position: { x: "28%", y: "90%" } },
      { id: 13, name: "T13", number: "13", position: { x: "20%", y: "88%" } },
      { id: 14, name: "T14", number: "14", position: { x: "15%", y: "75%" } }
    ],

    // DRS Zonları
    drsZones: [
      {
        id: "drs1",
        name: "DRS DETECTION ZONE 1",
        detectionPoint: { x: "64%", y: "66%" },
        activationPoint: { x: "67%", y: "42%" },
        color: "#00FF41"
      },
      {
        id: "drs2", 
        name: "DRS DETECTION ZONE 2",
        detectionPoint: { x: "76%", y: "88%" },
        activationPoint: { x: "56%", y: "96%" },
        color: "#00FF41"
      }
    ],

    // Speed Trap
    speedTrap: {
      position: { x: "18%", y: "70%" },
      label: "SPEED TRAP"
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
    viewBox: "0 0 425.69 327.11",

    // Sektörler
    sectors: [
      {
        id: "sector1",
        name: "SECTOR 1",
        color: "#FF1E46",
        label: "SECTOR 1",
        corners: [1, 2, 3, 4, 5, 6]
      },
      {
        id: "sector2",
        name: "SECTOR 2",
        color: "#00E5FF",
        label: "SECTOR 2",
        corners: [7, 8, 9, 10]
      },
      {
        id: "sector3",
        name: "SECTOR 3",
        color: "#FFF01E",
        label: "SECTOR 3",
        corners: [11, 12, 13, 14, 15, 16, 17, 18]
      }
    ],

    // Virajlar (SVG koordinatlarına göre düzeltilmiş)
    corners: [
      { id: 1, name: "T1 Abbey", number: "01", position: { x: "52%", y: "15%" } },
      { id: 2, name: "T2 Farm", number: "02", position: { x: "44%", y: "28%" } },
      { id: 3, name: "T3 Village", number: "03", position: { x: "38%", y: "42%" } },
      { id: 4, name: "T4 The Loop", number: "04", position: { x: "28%", y: "58%" } },
      { id: 5, name: "T5 Aintree", number: "05", position: { x: "28%", y: "70%" } },
      { id: 6, name: "T6 Brooklands", number: "06", position: { x: "25%", y: "85%" } },
      { id: 7, name: "T7 Luffield", number: "07", position: { x: "40%", y: "92%" } },
      { id: 8, name: "T8 Woodcote", number: "08", position: { x: "58%", y: "90%" } },
      { id: 9, name: "T9 Copse", number: "09", position: { x: "68%", y: "78%" } },
      { id: 10, name: "T10 Maggots", number: "10", position: { x: "75%", y: "68%" } },
      { id: 11, name: "T11 Becketts", number: "11", position: { x: "82%", y: "55%" } },
      { id: 12, name: "T12 Chapel", number: "12", position: { x: "75%", y: "42%" } },
      { id: 13, name: "T13 Stowe", number: "13", position: { x: "68%", y: "30%" } },
      { id: 14, name: "T14 Vale", number: "14", position: { x: "62%", y: "20%" } },
      { id: 15, name: "T15 Club", number: "15", position: { x: "58%", y: "12%" } }
    ],

    // DRS Zonları
    drsZones: [
      {
        id: "drs1",
        name: "DRS DETECTION ZONE 1",
        detectionPoint: { x: "32%", y: "12%" },
        activationPoint: { x: "44%", y: "85%" },
        color: "#00FF41"
      }
    ],

    // Speed Trap yok Silverstone'da (görselde görünmüyor)
  }
};