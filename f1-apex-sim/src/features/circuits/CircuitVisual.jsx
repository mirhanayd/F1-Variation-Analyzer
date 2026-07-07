import { useMemo } from 'react';
import { getOutlinePathD, hasCuratedOutline } from '../../data/circuitOutlines';

// Renders the circuit's real (curated) outline when one exists.
// Circuits without an outline get a clearly-separated fallback design —
// never a fake generic track shape.
const CircuitVisual = ({ circuit, label = null, children = null }) => {
  const trackPath = useMemo(() => getOutlinePathD(circuit?.id), [circuit?.id]);
  const hasOutline = Boolean(trackPath) && hasCuratedOutline(circuit?.id);

  if (!hasOutline) {
    return (
      <div className={`circuit-visual circuit-visual-fallback tone-${circuit?.visualTone ?? 'default'}`}>
        <div className="circuit-visual-grid" />
        <div className="outline-pending" aria-hidden="true">
          <span className="outline-pending-ring" />
          <span className="outline-pending-flag">?</span>
        </div>
        <span className="outline-pending-note">Track outline coming soon</span>
        {label && <span className="visual-label">{label}</span>}
        {children}
      </div>
    );
  }

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
