import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Line, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SCALE, KERB_WIDTH, buildRibbonGeometry } from '../simulation/trackGeometry3d';
import { FinishGantry } from '../simulation/SimulationScene';

const FULL_TRACK_WIDTH = 10; // metres

const LiveTrackContents3D = ({
  points = [],
  sectors = [],
  positions = [],
  selectedDriverNumber = null,
  onSelectDriver = null,
  onVehicleSelect = null,
}) => {
  const { camera } = useThree();

  const handleSelectDriver = (driverNum) => {
    if (onSelectDriver) onSelectDriver(driverNum);
    if (onVehicleSelect) onVehicleSelect(driverNum);
  };

  // Build geometries
  const trackGeometry = useMemo(
    () => buildRibbonGeometry(points, FULL_TRACK_WIDTH, { yOffset: 0.005 }),
    [points],
  );

  const kerbInner = useMemo(
    () => buildRibbonGeometry(points, KERB_WIDTH, {
      zone: 'arc',
      sideOffset: FULL_TRACK_WIDTH / 2 + KERB_WIDTH / 2 - 0.2,
      yOffset: 0.015,
      stripeColors: ['#d40018', '#e8ecf4'],
    }),
    [points],
  );

  const kerbOuter = useMemo(
    () => buildRibbonGeometry(points, KERB_WIDTH, {
      zone: 'arc',
      sideOffset: -(FULL_TRACK_WIDTH / 2 + KERB_WIDTH / 2 - 0.2),
      yOffset: 0.015,
      stripeColors: ['#d40018', '#e8ecf4'],
    }),
    [points],
  );

  const startLine = useMemo(() => {
    const startPoints = points.filter((point) => point.s <= 6);
    return startPoints.length > 1
      ? buildRibbonGeometry(startPoints, FULL_TRACK_WIDTH, { yOffset: 0.02 })
      : null;
  }, [points]);

  // Sector lines
  const sectorLines = useMemo(() => {
    return (sectors ?? []).map((sector) => {
      // Find range start & end
      const range = sector.pathRange ?? { start: 0, end: 1 };
      const totalLength = points.at(-1)?.s ?? 0;
      const from = range.start * totalLength;
      const to = range.end * totalLength;

      const linePoints = points
        .filter((point) => point.s >= from && point.s <= to)
        .map((point) => [point.x * SCALE, 0.04, -point.y * SCALE]);

      return { id: sector.id, color: sector.color, points: linePoints };
    }).filter((line) => line.points.length > 1);
  }, [points, sectors]);

  // Track framing target & bounds
  const { center, size } = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    const extent = Math.max(maxX - minX, maxY - minY) * SCALE;
    return {
      center: [((minX + maxX) / 2) * SCALE, 0, -((minY + maxY) / 2) * SCALE],
      size: Math.max(60, extent),
    };
  }, [points]);

  // Selected driver details for camera focus tracking
  const selectedDriverPos = useMemo(() => {
    if (!selectedDriverNumber) return null;
    const num = Number(selectedDriverNumber);
    return positions.find(p => p.driverNumber === num || p.driver_number === num);
  }, [positions, selectedDriverNumber]);

  // Auto-chase camera focus target
  const controlsTarget = useMemo(() => {
    if (selectedDriverPos?.projected) {
      return [
        selectedDriverPos.projected.x * SCALE,
        0,
        -selectedDriverPos.projected.y * SCALE
      ];
    }
    return center;
  }, [selectedDriverPos, center]);

  // Frame the camera looking down at the track initially
  useEffect(() => {
    camera.position.set(center[0] - size * 0.28, size * 0.65, center[2] + size * 0.55);
    camera.lookAt(center[0], 0, center[2]);
  }, [camera, center, size]);

  return (
    <>
      <color attach="background" args={['#07090f']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[120, 180, 90]} intensity={1.3} />
      <hemisphereLight args={['#3a4a6b', '#0a0c12', 0.6]} />

      {/* Grid Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.02, center[2]]}>
        <planeGeometry args={[size * 4, size * 4]} />
        <meshStandardMaterial color="#0a0d14" roughness={0.95} />
      </mesh>
      <gridHelper
        args={[size * 4, 90, '#1c2438', '#0e121a']}
        position={[center[0], -0.01, center[2]]}
      />

      {/* Ribbon geometries */}
      <mesh geometry={trackGeometry}>
        <meshStandardMaterial color="#222631" roughness={0.9} />
      </mesh>
      <mesh geometry={kerbInner}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
      <mesh geometry={kerbOuter}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
      {startLine && (
        <mesh geometry={startLine}>
          <meshBasicMaterial color="#e8ecf4" />
        </mesh>
      )}

      {/* Sector boundary lines */}
      {sectorLines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color={line.color}
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* Finish Gantry line */}
      {points.length > 0 && <FinishGantry path={{ points }} />}

      {/* Active Driver Markers */}
      {positions.map((pos) => {
        const dNum = pos.driverNumber ?? pos.driver_number;
        const isSelected = selectedDriverNumber !== null && Number(selectedDriverNumber) === Number(dNum);
        const xVal = pos.projected.x * SCALE;
        const zVal = -pos.projected.y * SCALE;
        const color = pos.color ?? '#ffffff';
        const acronym = pos.acronym ?? `#${dNum}`;

        // Compute rank position from positionsByDriver if present, otherwise fallback to index or none
        const rank = pos.position ?? '';

        return (
          <group key={dNum} position={[xVal, 0.3, zVal]}>
            {/* 3D Vehicle representation pod */}
            <mesh onClick={() => handleSelectDriver(dNum)}>
              <cylinderGeometry args={[0.7, 0.7, 0.4, 16]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color} 
                emissiveIntensity={isSelected ? 0.7 : 0.2}
                roughness={0.2}
              />
            </mesh>
            
            {/* Halo ring for selected driver */}
            {isSelected && (
              <mesh position={[0, 0.1, 0]}>
                <ringGeometry args={[1.0, 1.2, 32]} rotation={[-Math.PI / 2, 0, 0]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} />
              </mesh>
            )}

            {/* Billboarding HTML badge */}
            <Html distanceFactor={28} center style={{ pointerEvents: 'none' }}>
              <div 
                className={`pw-driver-badge-3d ${isSelected ? 'selected' : ''}`}
                style={{ 
                  '--team-color': color,
                  pointerEvents: 'auto' 
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectDriver(dNum);
                }}
              >
                {rank && <span className="badge-rank">{rank}</span>}
                <span className="badge-acronym">{acronym}</span>
              </div>
            </Html>
          </group>
        );
      })}

      <OrbitControls
        enablePan={true}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={8}
        maxDistance={size * 2.5}
        target={controlsTarget}
      />
    </>
  );
};

const LiveTrack3D = ({
  track,
  telemetryPositions = [],
  selectedDriverNumber = null,
  onSelectDriver = null,
  onVehicleSelect = null,
}) => {
  const points = track?.geometry?.points ?? [];
  const sectors = track?.sectors ?? [];

  if (points.length === 0) {
    return (
      <div className="full-sim-empty">
        <p>3D geometry layout is loading or unavailable for this circuit.</p>
      </div>
    );
  }

  return (
    <div className="live-track-3d-shell" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 80, 100], fov: 42, far: 5000 }}
        style={{ width: '100%', height: '100%', background: '#07090f', borderRadius: '12px' }}
      >
        <LiveTrackContents3D
          points={points}
          sectors={sectors}
          positions={telemetryPositions}
          selectedDriverNumber={selectedDriverNumber}
          onSelectDriver={onSelectDriver}
          onVehicleSelect={onVehicleSelect}
        />
      </Canvas>
      <div className="live-track-3d-hint">
        <span>3D GATEWAY TRACKING ACTIVE</span>
        <p>Orbit: Drag Left-Click · Zoom: Scroll/Pinch · Pan: Drag Right-Click</p>
      </div>
    </div>
  );
};

export default LiveTrack3D;
