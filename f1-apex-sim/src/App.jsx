import { useState } from 'react'
import './App.css'
import { TRACKS } from './utils/trackData'
import TrackCanvas from './components/TrackCanvas'

function App() {
  const [selectedTrackKey, setSelectedTrackKey] = useState('monza');
  const [selectedSector, setSelectedSector] = useState(null);

  const currentTrack = TRACKS[selectedTrackKey];

  const handleSectorClick = (sector) => {
    setSelectedSector(sector);
  };

  return (
    <div className="dashboard-container">
      {/* Track Selector */}
      <div className="track-selector">
        <button 
          className={`track-btn ${selectedTrackKey === 'monza' ? 'active' : ''}`} 
          onClick={() => { setSelectedTrackKey('monza'); setSelectedSector(null); }}
        >
          Monza
        </button>
        <button 
          className={`track-btn ${selectedTrackKey === 'silverstone' ? 'active' : ''}`} 
          onClick={() => { setSelectedTrackKey('silverstone'); setSelectedSector(null); }}
        >
          Silverstone
        </button>
      </div>

      {/* Main Track Canvas */}
      <div className="map-section">
        <TrackCanvas 
          track={currentTrack} 
          onSectorClick={handleSectorClick}
          selectedSector={selectedSector}
        />
      </div>

      {/* Stats Panel */}
      <div className="stats-panel">
        <div className="circuit-header">
          <h1>{currentTrack.id.toUpperCase()}</h1>
          <div className="sub-title">
            <span>{currentTrack.name}</span>
            <span>{currentTrack.country}</span>
          </div>
        </div>

        {selectedSector ? (
          <>
            <div style={{
              color: 'var(--neon-cyan)', 
              letterSpacing: '4px', 
              marginBottom: '25px', 
              borderBottom: '2px solid rgba(0, 229, 255, 0.3)', 
              paddingBottom: '10px',
              fontWeight: 'bold'
            }}>
              {selectedSector.label} ANALYSIS
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
              <span className="stat-label">Sector Color</span>
              <span className="stat-value">
                <div style={{
                  display: 'inline-block',
                  width: '60px',
                  height: '25px',
                  background: selectedSector.color,
                  borderRadius: '4px',
                  boxShadow: `0 0 15px ${selectedSector.color}`
                }}></div>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="stat-row">
              <span className="stat-label">Circuit Length</span>
              <span className="stat-value">{currentTrack.stats.length}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">First Grand Prix</span>
              <span className="stat-value">{currentTrack.stats.firstGP}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Number of Laps</span>
              <span className="stat-value">{currentTrack.stats.laps}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Corners</span>
              <span className="stat-value">{currentTrack.corners.length}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">DRS Zones</span>
              <span className="stat-value">{currentTrack.drsZones?.length || 0}</span>
            </div>

            <div className="lap-record-box">
              <div className="lap-record-title">LAP RECORD</div>
              <div className="lap-record-time">{currentTrack.stats.lapRecord.time}</div>
              <div className="lap-record-driver">{currentTrack.stats.lapRecord.driver}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App