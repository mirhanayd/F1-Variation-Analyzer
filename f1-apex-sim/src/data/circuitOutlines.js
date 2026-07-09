import { normalizeCircuitId } from './circuitRegistry';

// Real circuit outlines.
//
// Two shapes of entry are supported so the library can grow towards higher
// fidelity without rewrites:
//   { svg: { path, viewBox: [w, h] } } — a traced SVG path of the real track.
//   { points: [[x, y], ...] }          — a hand-authored closed polyline of the
//                                        real layout, smoothed at render time.
//
// Points are authored in an arbitrary local space (y grows downwards, like
// SVG) tracing the lap in racing direction, starting near the start/finish
// line. They intentionally simplify the layout while keeping the landmark
// geometry (Suzuka's crossover, Istanbul's Turn 8, Baku's castle section...)
// so a card-sized silhouette is recognisably that circuit.
//
// Circuits with no entry here get NO outline: the UI must show a clearly
// abstract placeholder instead of a fake track.

// Traced from public-domain SVGs shipped in /public.
const MONZA_SVG_PATH = 'm4.1168 29.337c0.31529 7.0558 4.5029 17.045 11.051 32.041 5.5664 12.748 11.227 26.92 12.581 31.494l2.4617 8.3161 4.9113 1.8458c3.6733 1.3807 4.9623 2.4052 5.1167 4.0668 1.4707 15.824 14.607 90.607 17.266 98.292 13.174 38.07 37.939 53.878 83.405 53.242 8.5475-0.11959 15.777-0.10051 16.066 0.0419 0.89783 0.44296 16.804-3.6907 25.946-6.7417 10.262-3.4247 11.317-3.2977 11.731 1.404 0.4861 5.5195-10.851 4.979 107.36 5.1105 18.222 0.0203 53.258 0.31975 77.858 0.66418l44.727 0.62532 26.813-3.3104c41.557-5.1328 54.488-12.178 59.87-32.614 2.5346-9.6255 1.5217-13.709-5.1803-20.862-4.7926-5.1156-7.924-5.7604-29.609-6.1076-10.622-0.17006-56.324-0.87618-101.56-1.5688-104.09-1.5937-99.307-1.2621-104.12-7.2232-5.3784-6.6565-14.936-9.4315-25.946-7.532-8.6364 1.4899-5.0705 3.9952-35.389-24.849-88.19-83.874-79.74-74.371-119-133.8-13.676-20.684-10.76-19.425-35.3-15.25-38.153 6.49-51.665 9.267-51.063 22.737z';

const SILVERSTONE_SVG_PATH = 'm25.198 30.229c-0.31456 1.0094-0.61942 2.0209-0.91904 3.0341-7.834 29.626-14.076 59.7-19.349 89.878-2.535 14.71-1.4856 31.043 8.2385 43.106 10.041 12.782 21.82 24.306 34.577 34.354 5.1918 4.5054 12.826 4.0455 18.004-0.22327 6.4174-3.2681 10.111-11.816 5.677-18.13-5.8251-10.346-19.237-11.651-26.639-20.171-5.6049-6.4993 0.19048-15.56 6.5585-18.909 45.445-27.169 91.127-54.08 137.35-79.839 5.1495-2.9902 10.946-2.7674 16.099-0.0654 10.1 4.7029 20.624 10.845 26.727 20.5 0.0808 3.862-6.0487 2.961-8.6128 3.5071-8.2501 0.97774-17.512-2.1461-25.203 1.9076-4.99 4.9203-0.70564 12.71 0.60533 18.304 4.8212 16.032 13.674 31.093 14.992 47.993-0.24271 16.885-12.901 30.252-16.443 46.332-0.84301 13.01 8.7895 23.588 15.052 34.056 14.712 22.13 31.592 42.83 45.602 65.396 5.8177 10.093 14.253 22.064 27.225 21.989 11.47 0.59815 25.629-0.96669 32.419-11.47 3.6727-5.7698-0.13079-12.116-1.8021-17.732 2.7607-4.9306 10.108-5.2048 14.709-7.9877 20.668-8.6102 40.531-19.776 63.083-22.553 9.496-1.5148 20.474-3.8364 25.382-13.169 4.2381-8.1269 5.1636-18.83-1.0634-26.27-21.629-32.654-51.613-58.448-77.982-87.076-17.562-18.913-36.653-36.457-53.119-56.32-9.2011-11.84-6.159-30.331-18.353-40.334-7.1588-4.9033-16.375-4.6729-24.132-1.3651-9.4575 4.7376-20.293 1.5097-28.217-4.6666-8.7547-6.032-17.465-16.33-29.387-13.706-8.8381 1.3902-17.885 3.6991-26.562 0.60162-35.41-9.071-71.544-19.259-108.45-17.175-10.471 0.0557-19.533 7.548-22.868 17.252-1.2385 2.9204-2.2695 5.9229-3.2131 8.951z';

export const CIRCUIT_OUTLINES = {
  monza: {
    svg: { path: MONZA_SVG_PATH, viewBox: [516.66, 263.84] },
  },
  silverstone: {
    svg: { path: SILVERSTONE_SVG_PATH, viewBox: [425.69, 327.11] },
  },
  istanbul: {
    // Anticlockwise. Pit straight at the top, T1–T2 corkscrew top-left,
    // T3–T7 loop on the left, the quadruple-apex Turn 8 bulging bottom-left,
    // long back straight along the bottom and the T12–T14 complex on the right.
    points: [
      [72, 26], [46, 22], [40, 21], [36, 23], [35, 27], [33, 32], [29, 34],
      [22, 36], [18, 40], [19, 45], [24, 46], [28, 50], [25, 55], [20, 60],
      [17, 66], [20, 71], [26, 76], [34, 80], [43, 82], [52, 81], [58, 78],
      [63, 75], [68, 74], [88, 72], [92, 70], [93, 65], [92, 60], [90, 50],
      [86, 42], [80, 34], [76, 29],
    ],
  },
  suzuka: {
    // The figure-of-eight: esses climbing the left, Degner feeding the
    // underpass, hairpin top right, Spoon at the far left and the crossover
    // back straight up to 130R.
    points: [
      [78, 64], [48, 66], [40, 64], [36, 58], [38, 52], [34, 46], [38, 40],
      [34, 34], [36, 27], [42, 24], [48, 22], [52, 26], [58, 28], [64, 30],
      [68, 32], [72, 28], [71, 22], [66, 20], [62, 24], [58, 20], [50, 16],
      [42, 14], [32, 16], [26, 22], [22, 32], [19, 42], [17, 52], [16, 58],
      [20, 63], [26, 60], [32, 56], [40, 50], [48, 42], [54, 34], [60, 26],
      [66, 18], [70, 13], [76, 14], [80, 18], [78, 24], [82, 28], [85, 36],
      [86, 46], [84, 56],
    ],
  },
  bahrain: {
    points: [
      [22, 78], [20, 44], [20, 38], [24, 32], [30, 33], [35, 37], [41, 35],
      [52, 29], [60, 24], [66, 22], [70, 26], [68, 32], [62, 38], [58, 45],
      [62, 50], [70, 52], [78, 50], [84, 52], [86, 58], [82, 63], [74, 64],
      [64, 62], [54, 64], [46, 70], [40, 78], [36, 84], [30, 86], [24, 84],
    ],
  },
  jeddah: {
    // Long, narrow corniche ribbon with the banked T13 loop at the top.
    points: [
      [58, 88], [60, 80], [57, 72], [60, 64], [56, 56], [59, 48], [55, 40],
      [58, 32], [54, 24], [56, 18], [52, 12], [46, 10], [42, 14], [44, 22],
      [41, 30], [44, 38], [40, 46], [43, 54], [39, 62], [42, 70], [38, 78],
      [40, 84], [44, 89], [52, 90],
    ],
  },
  miami: {
    points: [
      [30, 70], [22, 66], [18, 58], [22, 50], [30, 46], [40, 44], [50, 40],
      [58, 34], [66, 30], [74, 28], [82, 32], [84, 40], [80, 46], [72, 48],
      [64, 52], [58, 58], [62, 64], [70, 66], [78, 68], [86, 70], [90, 76],
      [86, 82], [76, 84], [60, 84], [44, 84], [36, 80],
    ],
  },
  villeneuve: {
    // Slender island track: hairpin at the east end, chicanes down the return.
    points: [
      [12, 44], [24, 40], [38, 37], [52, 34], [66, 31], [78, 28], [86, 26],
      [91, 29], [90, 34], [84, 36], [72, 39], [58, 43], [48, 46], [44, 48],
      [40, 50], [36, 47], [32, 50], [24, 53], [16, 54], [11, 51], [10, 47],
    ],
  },
  monaco: {
    // Harbour loop: climb to Casino top-left, hairpin nub, tunnel arc on the
    // right, Piscine wiggle and Rascasse at the bottom.
    points: [
      [62, 78], [48, 80], [38, 78], [30, 72], [24, 64], [20, 54], [22, 46],
      [27, 40], [33, 36], [38, 32], [36, 26], [30, 24], [26, 20], [30, 16],
      [36, 18], [40, 24], [46, 28], [52, 26], [58, 28], [66, 32], [74, 38],
      [80, 44], [84, 52], [80, 58], [74, 60], [70, 64], [64, 66], [60, 70],
      [56, 72], [58, 76],
    ],
  },
  catalunya: {
    points: [
      [24, 26], [56, 22], [64, 20], [70, 24], [68, 30], [72, 36], [78, 42],
      [80, 50], [76, 56], [70, 58], [66, 64], [60, 68], [52, 66], [46, 70],
      [38, 74], [30, 72], [26, 66], [30, 60], [34, 54], [30, 48], [24, 44],
      [20, 38], [20, 30],
    ],
  },
  red_bull_ring: {
    // Short alpine triangle: uphill run to the top, sweeping right side home.
    points: [
      [20, 74], [52, 72], [58, 70], [60, 64], [56, 56], [46, 44], [38, 32],
      [36, 24], [40, 18], [48, 16], [56, 20], [64, 30], [72, 42], [78, 54],
      [80, 64], [76, 72], [68, 76], [52, 78], [36, 78], [24, 78],
    ],
  },
  spa: {
    // La Source nub top-left, Kemmel diagonal, Rivage lobe, the drop to
    // Stavelot and the long Blanchimont left up the west side.
    points: [
      [26, 22], [32, 17], [39, 20], [48, 26], [58, 32], [68, 38], [76, 42],
      [82, 47], [81, 53], [75, 54], [71, 58], [74, 64], [76, 71], [73, 77],
      [66, 79], [59, 75], [53, 69], [47, 64], [42, 66], [44, 72], [42, 78],
      [36, 81], [30, 78], [27, 70], [25, 60], [23, 50], [22, 40], [24, 33],
      [20, 28],
    ],
  },
  hungaroring: {
    points: [
      [24, 30], [60, 26], [68, 28], [70, 34], [66, 40], [60, 44], [62, 50],
      [68, 54], [70, 60], [66, 66], [58, 68], [50, 64], [44, 68], [38, 72],
      [30, 70], [26, 64], [28, 58], [24, 52], [20, 46], [20, 38],
    ],
  },
  zandvoort: {
    // Tarzan at the end of the pit straight, Hugenholtz nub, banked final corner.
    points: [
      [20, 64], [48, 62], [58, 60], [64, 56], [62, 50], [54, 48], [46, 50],
      [40, 46], [44, 40], [52, 38], [56, 32], [52, 26], [44, 24], [40, 18],
      [48, 14], [58, 14], [68, 18], [76, 26], [80, 36], [82, 46], [80, 56],
      [74, 64], [64, 70], [50, 73], [36, 72], [26, 69],
    ],
  },
  madring: {
    // 2026 Madrid layout: IFEMA loop with the banked La Monumental sweep.
    points: [
      [24, 60], [30, 52], [28, 44], [32, 36], [40, 30], [50, 26], [60, 24],
      [70, 26], [76, 32], [74, 38], [66, 40], [58, 38], [52, 42], [56, 48],
      [64, 50], [72, 54], [76, 62], [72, 70], [62, 74], [50, 76], [38, 74],
      [28, 70],
    ],
  },
  baku: {
    // Long seafront straight, grid-section zigzag on the left, castle nub on top.
    points: [
      [88, 66], [34, 66], [27, 64], [25, 57], [27, 50], [25, 43], [27, 36],
      [25, 29], [28, 23], [35, 21], [38, 26], [36, 31], [41, 33], [44, 28],
      [42, 23], [46, 18], [52, 17], [55, 22], [52, 27], [55, 32], [60, 34],
      [66, 36], [72, 38], [78, 40], [84, 44], [90, 48], [93, 54], [92, 60],
      [90, 64],
    ],
  },
  marina_bay: {
    points: [
      [28, 66], [24, 58], [26, 50], [24, 42], [28, 34], [34, 28], [42, 26],
      [52, 28], [62, 26], [72, 28], [78, 32], [76, 38], [70, 40], [72, 46],
      [78, 48], [80, 54], [74, 58], [68, 56], [62, 60], [56, 58], [50, 62],
      [44, 60], [38, 64], [32, 68],
    ],
  },
  americas: {
    // T1 peak top-left, the esses cascading right, T11 hairpin far right,
    // long back straight and the stadium + triple-apex lobe at the bottom.
    points: [
      [20, 64], [18, 52], [17, 40], [16, 28], [14, 20], [20, 16], [26, 22],
      [32, 18], [38, 24], [44, 20], [50, 26], [56, 22], [62, 26], [70, 24],
      [78, 26], [86, 28], [91, 32], [89, 38], [82, 38], [74, 36], [64, 40],
      [54, 46], [44, 52], [36, 58], [30, 64], [34, 70], [42, 72], [50, 70],
      [56, 74], [52, 80], [44, 82], [34, 82], [26, 78], [21, 72],
    ],
  },
  rodriguez: {
    // Long frontstretch, right-end complex, mid-field esses and the Foro Sol
    // stadium nub before the final run home.
    points: [
      [22, 70], [74, 70], [80, 68], [82, 62], [78, 58], [72, 60], [70, 54],
      [74, 48], [80, 44], [78, 38], [70, 36], [64, 40], [58, 36], [52, 40],
      [46, 36], [40, 40], [34, 36], [26, 34], [20, 38], [17, 46], [18, 54],
      [24, 58], [28, 54], [32, 58], [28, 62], [22, 62], [18, 66],
    ],
  },
  interlagos: {
    // Anticlockwise: Senna S off the pit straight, lake loop and the twisty
    // infield inlet cutting back through the middle.
    points: [
      [62, 20], [38, 24], [30, 30], [26, 38], [22, 48], [20, 58], [24, 66],
      [32, 70], [42, 72], [52, 70], [58, 64], [54, 58], [46, 56], [40, 58],
      [34, 54], [36, 48], [44, 46], [52, 48], [60, 50], [68, 52], [76, 50],
      [80, 44], [78, 36], [72, 28], [68, 22],
    ],
  },
  vegas: {
    // Sphere curl at the top, the long Strip straight down the right side.
    points: [
      [38, 18], [32, 20], [28, 26], [32, 30], [40, 30], [46, 34], [47, 44],
      [47, 56], [47, 68], [46, 78], [42, 84], [34, 86], [28, 82], [27, 72],
      [27, 60], [27, 48], [27, 36], [29, 26], [33, 20],
    ],
  },
  losail: {
    points: [
      [20, 70], [64, 70], [72, 68], [74, 62], [70, 58], [64, 60], [58, 56],
      [62, 50], [68, 48], [70, 42], [64, 38], [58, 42], [52, 38], [56, 32],
      [62, 28], [58, 22], [50, 24], [44, 20], [36, 24], [38, 30], [32, 34],
      [26, 30], [20, 34], [24, 40], [18, 44], [14, 50], [16, 58], [18, 64],
    ],
  },
  yas_marina: {
    // Twin straights into the hairpin, marina hotel curl at the bottom right.
    points: [
      [24, 64], [20, 56], [22, 48], [28, 44], [36, 42], [44, 40], [52, 38],
      [60, 36], [66, 32], [64, 26], [56, 24], [46, 26], [38, 28], [30, 26],
      [26, 20], [32, 16], [42, 14], [54, 14], [66, 16], [76, 20], [82, 28],
      [84, 38], [82, 48], [76, 54], [68, 56], [62, 60], [66, 66], [74, 68],
      [78, 74], [72, 80], [62, 82], [50, 80], [38, 78], [30, 72],
    ],
  },
  shanghai: {
    // The "Snail" spiral top-left, flowing esses and the long back run to the
    // T14 hairpin at the bottom left.
    points: [
      [22, 58], [20, 44], [20, 36], [26, 28], [34, 25], [40, 30], [38, 37],
      [30, 39], [27, 33], [33, 30], [41, 32], [48, 29], [54, 33], [60, 29],
      [66, 33], [72, 28], [78, 26], [84, 30], [87, 38], [84, 46], [78, 50],
      [70, 52], [60, 54], [48, 56], [38, 58], [30, 62], [24, 67], [19, 62],
    ],
  },
  albert_park: {
    points: [
      [26, 64], [20, 58], [18, 50], [22, 44], [28, 40], [34, 36], [40, 32],
      [46, 28], [54, 24], [62, 22], [70, 24], [76, 28], [80, 34], [82, 42],
      [80, 48], [74, 52], [68, 54], [62, 58], [56, 62], [50, 64], [44, 68],
      [36, 70], [30, 68],
    ],
  },
  sepang: {
    // Twin back-to-back straights joined by the T15 hairpin, wide sweepers.
    points: [
      [30, 66], [70, 64], [78, 60], [80, 54], [74, 50], [66, 52], [58, 50],
      [52, 44], [56, 38], [64, 36], [72, 38], [78, 34], [76, 28], [68, 24],
      [58, 22], [48, 24], [40, 22], [32, 26], [26, 32], [24, 42], [23, 52],
      [24, 60],
    ],
  },
  imola: {
    points: [
      [74, 60], [40, 62], [28, 60], [22, 54], [24, 46], [30, 44], [36, 40],
      [34, 32], [28, 28], [32, 22], [40, 20], [46, 26], [52, 30], [60, 28],
      [66, 32], [64, 40], [70, 44], [78, 40], [84, 34], [88, 38], [86, 46],
      [82, 52], [80, 58],
    ],
  },
  portimao: {
    points: [
      [28, 62], [64, 60], [72, 62], [78, 58], [76, 50], [68, 48], [62, 44],
      [66, 38], [74, 36], [78, 30], [72, 24], [62, 22], [52, 26], [44, 22],
      [36, 24], [30, 30], [24, 36], [20, 44], [20, 52], [24, 58],
    ],
  },
  hockenheim: {
    // Compact Motodrom cluster with the long parallel run out to the hairpin.
    points: [
      [30, 66], [26, 58], [28, 50], [34, 46], [42, 44], [50, 40], [58, 34],
      [66, 28], [74, 22], [80, 18], [86, 20], [87, 26], [82, 30], [74, 36],
      [66, 42], [58, 46], [62, 52], [68, 56], [66, 62], [58, 64], [52, 60],
      [46, 64], [40, 68], [34, 70],
    ],
  },
  nurburgring: {
    // GP layout with the Mercedes-Arena curl near the start.
    points: [
      [34, 28], [42, 24], [50, 26], [46, 32], [38, 34], [44, 38], [52, 36],
      [60, 38], [68, 42], [76, 46], [82, 52], [84, 60], [80, 66], [72, 68],
      [62, 70], [52, 72], [42, 70], [32, 68], [24, 62], [20, 54], [22, 46],
      [26, 38], [30, 32],
    ],
  },
  paul_ricard: {
    // The Mistral straight with its chicane, Signes and Beausset on the right.
    points: [
      [24, 64], [20, 56], [24, 50], [32, 48], [40, 46], [38, 40], [32, 38],
      [36, 32], [44, 30], [52, 32], [60, 28], [68, 24], [76, 22], [84, 26],
      [86, 34], [82, 40], [76, 44], [70, 50], [64, 56], [56, 60], [46, 62],
      [36, 64], [30, 66],
    ],
  },
  sochi: {
    // Olympic Park loop with the long constant-radius Turn 3 arc.
    points: [
      [28, 64], [24, 56], [26, 48], [24, 40], [28, 32], [36, 28], [46, 26],
      [56, 24], [66, 26], [74, 30], [78, 38], [76, 46], [70, 50], [62, 52],
      [54, 50], [46, 52], [40, 56], [36, 62], [42, 66], [50, 68], [58, 66],
      [64, 70], [58, 74], [48, 76], [38, 74], [32, 70],
    ],
  },
  indianapolis: {
    // 2000s F1 road course: banked oval Turn 1 with the infield loop.
    points: [
      [24, 30], [70, 28], [80, 30], [86, 36], [86, 44], [80, 50], [70, 52],
      [30, 54], [36, 48], [44, 46], [40, 40], [34, 42], [28, 44], [22, 46],
      [18, 40], [18, 34],
    ],
  },
  mugello: {
    points: [
      [22, 60], [60, 58], [70, 60], [76, 56], [72, 50], [64, 48], [58, 44],
      [62, 38], [70, 36], [74, 30], [68, 24], [58, 26], [50, 22], [42, 26],
      [34, 24], [26, 28], [22, 34], [18, 42], [17, 50], [19, 56],
    ],
  },
  fuji: {
    // 1.5 km main straight with the tight technical final sector.
    points: [
      [20, 58], [70, 56], [80, 54], [84, 48], [80, 42], [72, 44], [66, 40],
      [70, 34], [76, 32], [74, 26], [66, 24], [58, 28], [50, 26], [42, 30],
      [34, 28], [26, 32], [22, 38], [18, 46], [18, 52],
    ],
  },
};

const OUTLINE_PADDING = 8;

// Catmull-Rom -> cubic bezier over a closed loop of [x, y] pairs.
const buildSmoothClosedPath = (points) => {
  const count = points.length;
  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)} `;

  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count];
    const p1 = points[i];
    const p2 = points[(i + 1) % count];
    const p3 = points[(i + 2) % count];

    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;

    path += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `;
  }

  return `${path}Z`;
};

const computeBounds = (points) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  return { minX, minY, maxX, maxY };
};

const outlineCache = new Map();

// Resolved outline for a circuit: { path, viewBox: 'x y w h', source }.
export const getCircuitOutline = (circuitId) => {
  if (!circuitId) return null;
  const id = normalizeCircuitId(circuitId);
  if (outlineCache.has(id)) return outlineCache.get(id);

  const entry = CIRCUIT_OUTLINES[id];
  if (!entry) {
    outlineCache.set(id, null);
    return null;
  }

  let resolved;
  if (entry.svg) {
    resolved = {
      id,
      path: entry.svg.path,
      viewBox: `0 0 ${entry.svg.viewBox[0]} ${entry.svg.viewBox[1]}`,
      source: 'traced-svg',
    };
  } else {
    const bounds = computeBounds(entry.points);
    resolved = {
      id,
      path: buildSmoothClosedPath(entry.points),
      viewBox: [
        bounds.minX - OUTLINE_PADDING,
        bounds.minY - OUTLINE_PADDING,
        bounds.maxX - bounds.minX + OUTLINE_PADDING * 2,
        bounds.maxY - bounds.minY + OUTLINE_PADDING * 2,
      ].map((value) => value.toFixed(1)).join(' '),
      source: 'authored-points',
      points: entry.points,
    };
  }

  outlineCache.set(id, resolved);
  return resolved;
};

export const hasRealOutline = (circuitId) => Boolean(getCircuitOutline(circuitId));

// --- Simulation geometry sampling ------------------------------------------

// Evaluates the closed Catmull-Rom spline analytically so the simulator can
// consume authored outlines without any DOM dependency.
const sampleAuthoredPoints = (points, samplesPerSegment = 14) => {
  const count = points.length;
  const sampled = [];

  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count];
    const p1 = points[i];
    const p2 = points[(i + 1) % count];
    const p3 = points[(i + 2) % count];

    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      // Standard centripetal-ish Catmull-Rom basis (tension 0.5).
      const x = 0.5 * ((2 * p1[0])
        + (-p0[0] + p2[0]) * t
        + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
        + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1])
        + (-p0[1] + p2[1]) * t
        + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
        + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      sampled.push({ x, y });
    }
  }

  return sampled;
};

// Samples an arbitrary traced SVG path via a temporary off-screen element.
const sampleSvgPathPoints = (pathD, sampleCount = 700) => {
  if (typeof document === 'undefined') return [];

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  const pathEl = document.createElementNS(NS, 'path');
  pathEl.setAttribute('d', pathD);
  svg.appendChild(pathEl);
  document.body.appendChild(svg);

  try {
    const total = pathEl.getTotalLength();
    if (!total) return [];
    const sampled = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const point = pathEl.getPointAtLength((i / sampleCount) * total);
      sampled.push({ x: point.x, y: point.y });
    }
    return sampled;
  } finally {
    document.body.removeChild(svg);
  }
};

// Raw closed-loop sample points (outline units) for simulation geometry.
export const getOutlineSamplePoints = (circuitId) => {
  const outline = getCircuitOutline(circuitId);
  if (!outline) return null;

  const entry = CIRCUIT_OUTLINES[outline.id];
  const sampled = entry.svg
    ? sampleSvgPathPoints(entry.svg.path)
    : sampleAuthoredPoints(entry.points);

  return sampled.length > 8 ? sampled : null;
};
