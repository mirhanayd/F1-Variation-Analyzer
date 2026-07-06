const CircuitStatsPanel = ({ track, selectedSector }) => (
  <section className="panel-section">
    <div className="circuit-header">
      <h1>{track.shortName.toUpperCase()}</h1>
      <div className="sub-title">
        <span>{track.name}</span>
        <span>{track.country}</span>
      </div>
    </div>

    {selectedSector ? (
      <>
        <div className="section-kicker" style={{ color: selectedSector.color }}>
          {selectedSector.label} Analysis
        </div>
        <div className="stat-row">
          <span className="stat-label">Sector</span>
          <span className="stat-value" style={{ color: selectedSector.color }}>
            {selectedSector.label}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Corners</span>
          <span className="stat-value">{selectedSector.corners.length}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Path Range</span>
          <span className="stat-value compact">
            {Math.round(selectedSector.pathRange.start * 100)}
            %
            {' '}
            -
            {' '}
            {Math.round(selectedSector.pathRange.end * 100)}
            %
          </span>
        </div>
      </>
    ) : (
      <>
        <div className="stat-row">
          <span className="stat-label">Circuit Length</span>
          <span className="stat-value">{track.stats.length}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">First Grand Prix</span>
          <span className="stat-value">{track.stats.firstGP}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Number of Laps</span>
          <span className="stat-value">{track.stats.laps}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Total Corners</span>
          <span className="stat-value">{track.corners.length}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">DRS Zones</span>
          <span className="stat-value">{track.drsZones?.length ?? 0}</span>
        </div>

        <div className="lap-record-box">
          <div className="lap-record-title">Lap Record</div>
          <div className="lap-record-time">{track.stats.lapRecord.time}</div>
          <div className="lap-record-driver">{track.stats.lapRecord.driver}</div>
        </div>
      </>
    )}
  </section>
);

export default CircuitStatsPanel;
