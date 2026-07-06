const CircuitVisual = ({ circuit, label = null, children = null }) => (
  <div className={`circuit-visual tone-${circuit?.visualTone ?? 'default'}`}>
    <div className="circuit-visual-grid" />
    <svg className="circuit-silhouette" viewBox="0 0 220 140" aria-hidden="true">
      <path
        d="M30 85 C40 18 86 19 112 50 C139 83 177 31 193 68 C207 100 168 123 129 107 C91 92 62 135 39 111 C30 101 27 94 30 85Z"
      />
      <path
        d="M63 87 C77 67 88 61 103 70 C122 82 134 80 152 65"
        className="racing-line"
      />
    </svg>
    {label && <span className="visual-label">{label}</span>}
    {children}
  </div>
);

export default CircuitVisual;
