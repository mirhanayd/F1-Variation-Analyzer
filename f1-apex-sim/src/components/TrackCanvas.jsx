import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TrackCanvas.css';
import { TrackRenderer } from '../utils/trackRenderer';
import {
  getPointAtProgress,
  projectTelemetryPoint,
  worldToScreen,
} from '../utils/trackGeometry';
import { useTrackGeometry } from '../hooks/useTrackGeometry';

const defaultCamera = { x: 0, y: 0, scale: 1 };

const TrackCanvas = ({
  track,
  onSectorClick,
  selectedSector,
  telemetryPositions = [],
  telemetryBounds = null,
  telemetryGeometry = null,
  replayStatus = 'idle',
  sourceLabel = null,
  selectedDriverNumber = null,
  onVehicleSelect = null,
}) => {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredCorner, setHoveredCorner] = useState(null);
  const [camera, setCamera] = useState(defaultCamera);
  const { status: geometryStatus, geometry, error } = useTrackGeometry(track, telemetryGeometry);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !geometry?.points?.length) return undefined;

    const renderer = new TrackRenderer(canvasRef.current, track, geometry);
    renderer.onCameraUpdate = setCamera;
    rendererRef.current = renderer;

    const resizeRenderer = () => {
      const rect = containerRef.current.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
    };

    resizeRenderer();

    const resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [geometry, track]);

  useEffect(() => {
    if (!rendererRef.current) return;

    if (selectedSector) {
      rendererRef.current.zoomToSector(selectedSector.id);
    } else {
      rendererRef.current.resetZoom();
    }
  }, [selectedSector]);

  const getProgressScreenPosition = useCallback((progress) => {
    const point = getPointAtProgress(geometry?.points, progress);
    return worldToScreen(point, camera);
  }, [camera, geometry?.points]);

  const vehicleMarkers = useMemo(() => telemetryPositions
    .map((position) => {
      const projected = position.projected
        ?? position.trackPoint
        ?? projectTelemetryPoint(position, geometry, telemetryBounds);
      const screen = worldToScreen(projected, camera);
      if (!screen) return null;

      return {
        ...position,
        screen,
      };
    })
    .filter(Boolean), [camera, geometry, telemetryBounds, telemetryPositions]);

  const handleSectorButtonClick = (sector) => {
    onSectorClick(selectedSector?.id === sector.id ? null : sector);
  };

  const isLoading = geometryStatus === 'idle' || geometryStatus === 'loading';

  return (
    <div className="track-canvas-wrapper">
      <div className="track-info-header">
        <div className="track-title">
          <h1>{track.name.toUpperCase()}</h1>
          <span className="country-badge">{track.country}</span>
        </div>
        <div className="track-stats-mini">
          <span>{track.stats.length}</span>
          <span aria-hidden="true">/</span>
          <span>{track.stats.laps} LAPS</span>
        </div>
      </div>

      <div className="canvas-track-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="track-canvas"
          aria-label={`${track.name} circuit map`}
        />

        {isLoading && (
          <div className="loading-overlay">
            <div className="loader" />
            <span>Loading Track</span>
          </div>
        )}

        {geometryStatus === 'error' && (
          <div className="track-error">
            {error?.message ?? 'Track could not be loaded'}
          </div>
        )}

        {geometry?.points?.length > 0 && track.corners.map((corner) => {
          const pos = getProgressScreenPosition(corner.trackPosition);
          if (!pos) return null;

          return (
            <div
              key={corner.id}
              className={`corner-marker ${hoveredCorner === corner.id ? 'hovered' : ''}`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
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

        {geometry?.points?.length > 0 && track.drsZones?.map((drs) => {
          const detectionPos = getProgressScreenPosition(drs.detectionPosition);
          const activationPos = getProgressScreenPosition(drs.activationPosition);

          if (!detectionPos || !activationPos) return null;

          return (
            <div key={drs.id} className="drs-zone-overlay">
              <svg className="drs-connection-line" aria-hidden="true">
                <line
                  x1={detectionPos.x}
                  y1={detectionPos.y}
                  x2={activationPos.x}
                  y2={activationPos.y}
                />
              </svg>

              <div
                className="drs-detection"
                style={{
                  left: `${detectionPos.x}px`,
                  top: `${detectionPos.y}px`,
                }}
              >
                <div className="drs-marker detection" />
                <div className="drs-label">{drs.name}</div>
              </div>

              <div
                className="drs-activation"
                style={{
                  left: `${activationPos.x}px`,
                  top: `${activationPos.y}px`,
                }}
              >
                <div className="drs-marker activation" />
              </div>
            </div>
          );
        })}

        {geometry?.points?.length > 0 && track.speedTrap && (() => {
          const pos = getProgressScreenPosition(track.speedTrap.trackPosition);
          if (!pos) return null;

          return (
            <div
              className="speed-trap-marker"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
            >
              <div className="speed-trap-icon">ST</div>
              <div className="speed-trap-label">{track.speedTrap.label}</div>
            </div>
          );
        })()}

        {geometry?.points?.length > 0 && track.startFinish && (() => {
          const pos = getProgressScreenPosition(track.startFinish.trackPosition);
          if (!pos) return null;

          return (
            <div
              className="finish-line-marker"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              aria-label="Start finish line"
            />
          );
        })()}

        {vehicleMarkers.map((vehicle) => (
          <button
            type="button"
            key={vehicle.driverNumber}
            className={`vehicle-marker${vehicle.stale ? ' stale' : ''}${String(selectedDriverNumber) === String(vehicle.driverNumber) ? ' selected' : ''}`}
            style={{
              left: `${vehicle.screen.x}px`,
              top: `${vehicle.screen.y}px`,
              '--team-color': vehicle.color,
            }}
            title={vehicle.driverName}
            aria-label={`Select ${vehicle.driverName}`}
            aria-pressed={String(selectedDriverNumber) === String(vehicle.driverNumber)}
            onClick={() => onVehicleSelect?.(vehicle.driverNumber)}
          >
            <span>{vehicle.acronym}</span>
          </button>
        ))}

        {(sourceLabel || replayStatus === 'ready') && (
          <div className="replay-badge">
            {sourceLabel ?? 'Historical replay'}
          </div>
        )}
      </div>

      {track.sectors.length > 1 && (
      <div className="sector-selector" aria-label="Track sectors">
        {track.sectors.map((sector) => (
          <button
            key={sector.id}
            className={`sector-btn ${selectedSector?.id === sector.id ? 'active' : ''}`}
            style={{
              '--btn-color': sector.color,
            }}
            onClick={() => handleSectorButtonClick(sector)}
            type="button"
          >
            <span className="sector-icon" />
            <span className="sector-number">{sector.label.split(' ')[1]}</span>
            <span className="corner-count">{sector.corners.length} corners</span>
          </button>
        ))}
      </div>
      )}
    </div>
  );
};

export default TrackCanvas;
