import { useMemo } from 'react';

const monogramFor = (circuit) => {
  const source = circuit?.shortName ?? circuit?.name ?? '?';
  const words = source.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

// Real track silhouette with the animated racing-line trace.
const RealOutline = ({ outline }) => (
  <svg
    className="circuit-silhouette"
    viewBox={outline.viewBox}
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <path d={outline.path} className="track-outline-glow" />
    <path d={outline.path} className="track-outline" />
    <path d={outline.path} className="racing-line" pathLength="100" />
  </svg>
);

const geometryToOutline = (circuit) => {
  const geometry = circuit?.stylisedGeometry
    ?? circuit?.geometry?.stylisedGeometry
    ?? circuit?.normalizedDisplayGeometry
    ?? circuit?.geometry
    ?? null;
  const points = geometry?.points;
  if (!points?.length) return null;
  const bbox = geometry.bbox ?? circuit?.geometry?.bbox;
  const minX = bbox?.minX ?? bbox?.x ?? Math.min(...points.map((point) => point.x));
  const minY = bbox?.minY ?? bbox?.y ?? Math.min(...points.map((point) => point.y));
  const width = bbox?.width ?? Math.max(...points.map((point) => point.x)) - minX;
  const height = bbox?.height ?? Math.max(...points.map((point) => point.y)) - minY;
  const padding = Math.max(width, height) * 0.08;

  return {
    path: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
    viewBox: `${minX - padding} ${minY - padding} ${Math.max(1, width + padding * 2)} ${Math.max(1, height + padding * 2)}`,
  };
};

// Deliberately abstract placeholder for circuits with no verified outline —
// it must NOT look like a track layout.
const FallbackVisual = ({ circuit }) => (
  <div className="circuit-visual-fallback" aria-hidden="true">
    <span className="fallback-monogram">{monogramFor(circuit)}</span>
    <span className="fallback-tag">Layout pending</span>
  </div>
);

const CircuitVisual = ({ circuit, label = null, children = null }) => {
  const outline = useMemo(() => geometryToOutline(circuit), [circuit]);

  return (
    <div
      className={`circuit-visual tone-${circuit?.visualTone ?? 'default'}${outline ? '' : ' is-fallback'}`}
    >
      <div className="circuit-visual-grid" />
      {outline ? <RealOutline outline={outline} /> : <FallbackVisual circuit={circuit} />}
      {label && <span className="visual-label">{label}</span>}
      {children}
    </div>
  );
};

export default CircuitVisual;
