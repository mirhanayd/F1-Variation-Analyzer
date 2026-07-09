import { useMemo } from 'react';
import { getCircuitOutline } from '../../data/circuitOutlines';

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

// Deliberately abstract placeholder for circuits with no verified outline —
// it must NOT look like a track layout.
const FallbackVisual = ({ circuit }) => (
  <div className="circuit-visual-fallback" aria-hidden="true">
    <span className="fallback-monogram">{monogramFor(circuit)}</span>
    <span className="fallback-tag">Layout pending</span>
  </div>
);

const CircuitVisual = ({ circuit, label = null, children = null }) => {
  const outline = useMemo(() => getCircuitOutline(circuit?.id), [circuit?.id]);

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
