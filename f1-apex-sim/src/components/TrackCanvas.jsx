import { useEffect, useState, useRef, useCallback } from 'react';
import './TrackCanvas.css';
import { TrackRenderer } from '../utils/trackRenderer';
import { SVGPathParser } from '../utils/svgPathParser';
import dataManager from '../services/dataManager';

const TrackCanvas = ({ track, onSectorClick, selectedSector }) => {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredCorner, setHoveredCorner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [telemetryData, setTelemetryData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [trackPoints, setTrackPoints] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [cameraState, setCameraState] = useState({ x: 0, y: 0, scale: 1 });

  // Fetch and parse SVG track path
  useEffect(() => {
    const loadTrackPath = async () => {
      try {
        const response = await fetch(track.svgPath);
        const svgText = await response.text();

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const pathElement = svgDoc.querySelector('path');

        if (pathElement) {
          const pathString = pathElement.getAttribute('d');
          const commands = SVGPathParser.parsePath(pathString);
          const points = SVGPathParser.samplePath(commands, 2000);
          setTrackPoints(points);
          console.log('Track points loaded:', points.length);
        }
      } catch (error) {
        console.error('Failed to load track path:', error);
      }
    };

    loadTrackPath();
  }, [track.svgPath]);

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
    setCanvasSize({ width: rect.width, height: rect.height });

    // Scale context for retina displays
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Create renderer with proper dimensions
    rendererRef.current = new TrackRenderer(canvas, track);

    // Subscribe to camera updates
    if (rendererRef.current) {
      rendererRef.current.onCameraUpdate = (camera) => {
        setCameraState({
          x: camera.x,
          y: camera.y,
          scale: camera.scale
        });
      };
    }

    setIsLoading(false);

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      const newRect = container.getBoundingClientRect();
      canvas.width = newRect.width * dpr;
      canvas.height = newRect.height * dpr;
      canvas.style.width = `${newRect.width}px`;
      canvas.style.height = `${newRect.height}px`;
      setCanvasSize({ width: newRect.width, height: newRect.height });
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
      // Extract sector number (sector1 -> 1, sector2 -> 2, etc.)
      const sectorNum = parseInt(selectedSector.id.replace('sector', ''));
      console.log('Selected sector:', selectedSector.id, '-> number:', sectorNum);
      rendererRef.current.zoomToSector(sectorNum);
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

  // Convert track position (0-1) to screen coordinates
  const getScreenPosition = useCallback((trackPosition) => {
    if (trackPoints.length === 0 || !rendererRef.current) {
      return null;
    }

    const pointIndex = Math.floor(trackPosition * (trackPoints.length - 1));
    const point = trackPoints[Math.min(pointIndex, trackPoints.length - 1)];

    if (!point) return null;

    // Get current camera state from renderer
    const camera = rendererRef.current.camera;

    // Transform SVG coordinates to screen coordinates
    const screenX = point.x * camera.scale + camera.x;
    const screenY = point.y * camera.scale + camera.y;

    return { x: screenX, y: screenY };
  }, [trackPoints]);

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

  // Update camera state periodically for marker positioning
  useEffect(() => {
    if (!rendererRef.current) return;

    const updateCamera = () => {
      if (rendererRef.current) {
        const camera = rendererRef.current.camera;
        setCameraState({
          x: camera.x,
          y: camera.y,
          scale: camera.scale
        });
      }
    };

    const interval = setInterval(updateCamera, 16); // ~60fps for smooth transitions
    return () => clearInterval(interval);
  }, [track]);

  return (
    <div className="track-canvas-wrapper" ref={containerRef}>
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

        {/* Viraj Numaraları - Dinamik pozisyonlama */}
        {trackPoints.length > 0 && track.corners.map((corner) => {
          const pos = getScreenPosition(corner.trackPosition);
          if (!pos) return null;

          return (
            <div
              key={corner.id}
              className={`corner-marker ${hoveredCorner === corner.id ? 'hovered' : ''}`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`
              }}
              onMouseEnter={() => setHoveredCorner(corner.id)}
              onMouseLeave={() => setHoveredCorner(null)}
            >
              <div className="corner-number">{corner.number}</div>
              {hoveredCorner === corner.id && (
                <div className="corner-tooltip">{corner.name}</div>
              )}
            </div>
          );
        })}

        {/* DRS Zonları - Dinamik pozisyonlama */}
        {trackPoints.length > 0 && track.drsZones.map((drs) => {
          const detectionPos = getScreenPosition(drs.detectionPosition);
          const activationPos = getScreenPosition(drs.activationPosition);

          if (!detectionPos || !activationPos) return null;

          return (
            <div key={drs.id} className="drs-zone-overlay">
              {/* Detection Point */}
              <div
                className="drs-detection"
                style={{
                  left: `${detectionPos.x}px`,
                  top: `${detectionPos.y}px`
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
                  x1={detectionPos.x}
                  y1={detectionPos.y}
                  x2={activationPos.x}
                  y2={activationPos.y}
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
                  left: `${activationPos.x}px`,
                  top: `${activationPos.y}px`
                }}
              >
                <div className="drs-marker activation"></div>
              </div>
            </div>
          );
        })}

        {/* Speed Trap - Dinamik pozisyonlama */}
        {trackPoints.length > 0 && track.speedTrap && (() => {
          const pos = getScreenPosition(track.speedTrap.trackPosition);
          if (!pos) return null;

          return (
            <div
              className="speed-trap-marker"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`
              }}
            >
              <div className="speed-trap-icon">
                <svg width="40" height="40" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" fill="#FF1493" />
                </svg>
              </div>
              <div className="speed-trap-label">{track.speedTrap.label}</div>
            </div>
          );
        })()}

        {/* Start/Finish Line - Dinamik pozisyonlama */}
        {trackPoints.length > 0 && track.startFinish && (() => {
          const pos = getScreenPosition(track.startFinish.trackPosition);
          if (!pos) return null;

          return (
            <div
              className="finish-line-marker"
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <svg width="50" height="50" viewBox="0 0 24 24">
                <rect x="0" y="0" width="8" height="8" fill="white" />
                <rect x="8" y="0" width="8" height="8" fill="black" />
                <rect x="16" y="0" width="8" height="8" fill="white" />
                <rect x="0" y="8" width="8" height="8" fill="black" />
                <rect x="8" y="8" width="8" height="8" fill="white" />
                <rect x="16" y="8" width="8" height="8" fill="black" />
                <rect x="0" y="16" width="8" height="8" fill="white" />
                <rect x="8" y="16" width="8" height="8" fill="black" />
                <rect x="16" y="16" width="8" height="8" fill="white" />
              </svg>
            </div>
          );
        })()}
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
