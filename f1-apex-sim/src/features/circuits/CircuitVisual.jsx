import { useMemo } from 'react';

// Deterministic hash so every circuit gets its own silhouette.
const hashString = (value = '') => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRng = (seed) => {
  let state = seed || 123456789;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
};

// Generates a smooth closed loop that reads as a stylised track outline.
const buildTrackPath = (seed) => {
  const rng = createRng(seed);
  const pointCount = 8 + Math.floor(rng() * 4);
  const cx = 110;
  const cy = 70;

  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * Math.PI * 2;
    const radiusX = 62 + rng() * 34;
    const radiusY = 34 + rng() * 22;
    return {
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
    };
  });

  // Catmull-Rom -> cubic bezier for a smooth closed loop.
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `;
  for (let i = 0; i < pointCount; i += 1) {
    const p0 = points[(i - 1 + pointCount) % pointCount];
    const p1 = points[i];
    const p2 = points[(i + 1) % pointCount];
    const p3 = points[(i + 2) % pointCount];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    path += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }

  return `${path}Z`;
};

const CircuitVisual = ({ circuit, label = null, children = null }) => {
  const trackPath = useMemo(
    () => buildTrackPath(hashString(circuit?.id ?? circuit?.name ?? 'track')),
    [circuit?.id, circuit?.name],
  );

  return (
    <div className={`circuit-visual tone-${circuit?.visualTone ?? 'default'}`}>
      <div className="circuit-visual-grid" />
      <svg className="circuit-silhouette" viewBox="0 0 220 140" aria-hidden="true">
        <path d={trackPath} className="track-outline-glow" />
        <path d={trackPath} className="track-outline" />
        <path d={trackPath} className="racing-line" pathLength="100" />
      </svg>
      {label && <span className="visual-label">{label}</span>}
      {children}
    </div>
  );
};

export default CircuitVisual;
