import { useEffect, useState, useRef } from 'react';
import './TrackCanvas.css';
import { TrackRenderer } from '../utils/trackRenderer';
import dataManager from '../services/dataManager';

const TrackCanvas = ({ track, onSectorClick, selectedSector }) => {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [hoveredCorner, setHoveredCorner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [telemetryData, setTelemetryData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Initialize Canvas Renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    
    // Set proper canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Scale context for retina displays
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Create renderer with proper dimensions
    rendererRef.current = new TrackRenderer(canvas, track);
    setIsLoading(false);

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      const newRect = container.getBoundingClientRect();
      canvas.width = newRect.width * dpr;
      canvas.height = newRect.height * dpr;
      canvas.style.width = `${newRect.width}px`;
      canvas.style.height = `${newRect.height}px`;
      ctx.scale(dpr, dpr);
      if (rendererRef.current) {
        rendererRef.current.fitTrackToView();
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, [track]);

  // Handle sector selection
  useEffect(() => {
    if (!rendererRef.current) return;

    if (selectedSector) {
      rendererRef.current.zoomToSector(selectedSector.id.replace('sector', ''));
    } else {
      rendererRef.current.resetZoom();
    }
  }, [selectedSector]);

  // Fetch telemetry data
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const data = await dataManager.getCircuitData(track.id, 2024);
        setTelemetryData(data);
        console.log('Telemetry data loaded:', data);
      } catch (error) {
        console.error('Failed to fetch telemetry:', error);
      }
    };

    fetchTelemetry();
  }, [track.id]);

  const handleSectorButtonClick = (sector) => {
    if (selectedSector?.id === sector.id) {
      // Aynı sektöre tıklanırsa zoom'u kapat
      onSectorClick(null);
      setIsSimulating(false);
      if (rendererRef.current) {
        rendererRef.current.stopCarAnimation();
      }
    } else {
      onSectorClick(sector);
    }
  };

  const handleStartSimulation = () => {
    if (!rendererRef.current) return;
    
    setIsSimulating(true);
    rendererRef.current.startCarAnimation();
  };

  const handleStopSimulation = () => {
    if (!rendererRef.current) return;
    
    setIsSimulating(false);
    rendererRef.current.stopCarAnimation();
  };

  return (
    <div className="track-canvas-wrapper">
      <div className="track-info-header">
        <div className="track-title">
          <h1>{track.name.toUpperCase()}</h1>
          <span className="country-badge">{track.country}</span>
        </div>
        <div className="track-stats-mini">
          <span>{track.stats.length}</span>
          <span>•</span>
          <span>{track.stats.laps} LAPS</span>
        </div>
      </div>

      <div className="canvas-track-container">
        {/* Canvas */}
        <canvas 
          ref={canvasRef}
          className="track-canvas"
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loader"></div>
            <span>Loading Track...</span>
          </div>
        )}
        
        {/* Zoom indicator */}
        {selectedSector && (
          <div className="zoom-indicator">
            <div className="zoom-icon">🔍</div>
            <span>ANALYZING {selectedSector.label}</span>
          </div>
        )}
        
        {/* Simulation controls */}
        {selectedSector && (
          <div className="simulation-controls">
            <button 
              className={`sim-btn ${isSimulating ? 'stop' : 'start'}`}
              onClick={isSimulating ? handleStopSimulation : handleStartSimulation}
            >
              {isSimulating ? '⏸ STOP' : '▶ START'} SIMULATION
            </button>
          </div>
        )}



        {/* Viraj Numaraları */}
        {track.corners.map((corner) => (
          <div
            key={corner.id}
            className={`corner-marker ${hoveredCorner === corner.id ? 'hovered' : ''}`}
            style={{
              left: corner.position.x,
              top: corner.position.y
            }}
            onMouseEnter={() => setHoveredCorner(corner.id)}
            onMouseLeave={() => setHoveredCorner(null)}
          >
            <div className="corner-number">{corner.number}</div>
            {hoveredCorner === corner.id && (
              <div className="corner-tooltip">{corner.name}</div>
            )}
          </div>
        ))}

        {/* DRS Zonları */}
        {track.drsZones.map((drs) => (
          <div key={drs.id} className="drs-zone-overlay">
            {/* Detection Point */}
            <div 
              className="drs-detection"
              style={{
                left: drs.detectionPoint.x,
                top: drs.detectionPoint.y
              }}
            >
              <div className="drs-marker detection"></div>
              <div className="drs-label">
                {drs.name}
              </div>
            </div>

            {/* Activation Line (görsel bağlantı) */}
            <svg 
              className="drs-connection-line"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            >
              <line 
                x1={drs.detectionPoint.x}
                y1={drs.detectionPoint.y}
                x2={drs.activationPoint.x}
                y2={drs.activationPoint.y}
                stroke="#00FF41"
                strokeWidth="2"
                strokeDasharray="8 4"
                opacity="0.5"
              />
            </svg>

            {/* Activation Point */}
            <div 
              className="drs-activation"
              style={{
                left: drs.activationPoint.x,
                top: drs.activationPoint.y
              }}
            >
              <div className="drs-marker activation"></div>
            </div>
          </div>
        ))}

        {/* Speed Trap */}
        {track.speedTrap && (
          <div 
            className="speed-trap-marker"
            style={{
              left: track.speedTrap.position.x,
              top: track.speedTrap.position.y
            }}
          >
            <div className="speed-trap-icon">
              <svg width="40" height="40" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" fill="#FF1493"/>
              </svg>
            </div>
            <div className="speed-trap-label">{track.speedTrap.label}</div>
          </div>
        )}

        {/* Start/Finish Line */}
        <div className="finish-line-marker">
          <svg width="50" height="50" viewBox="0 0 24 24">
            <rect x="0" y="0" width="8" height="8" fill="white"/>
            <rect x="8" y="0" width="8" height="8" fill="black"/>
            <rect x="16" y="0" width="8" height="8" fill="white"/>
            <rect x="0" y="8" width="8" height="8" fill="black"/>
            <rect x="8" y="8" width="8" height="8" fill="white"/>
            <rect x="16" y="8" width="8" height="8" fill="black"/>
            <rect x="0" y="16" width="8" height="8" fill="white"/>
            <rect x="8" y="16" width="8" height="8" fill="black"/>
            <rect x="16" y="16" width="8" height="8" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Sector Selection Buttons */}
      <div className="sector-selector">
        {track.sectors.map((sector) => (
          <button
            key={sector.id}
            className={`sector-btn ${selectedSector?.id === sector.id ? 'active' : ''}`}
            style={{
              '--btn-color': sector.color
            }}
            onClick={() => handleSectorButtonClick(sector)}
          >
            <span className="sector-icon" style={{ '--btn-color': sector.color }}></span>
            <span className="sector-number">{sector.label.split(' ')[1]}</span>
            <span className="corner-count">{sector.corners.length} Corners</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TrackCanvas;
