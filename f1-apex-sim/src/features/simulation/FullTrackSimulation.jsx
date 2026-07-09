import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { FormulaCar, FinishGantry } from './SimulationScene';
import { SCALE, KERB_WIDTH, buildRibbonGeometry } from './trackGeometry3d';
import {
  getDistanceAtTime,
  getPoseAtDistance,
  getSpeedAtTime,
} from './simulationMath';
import { buildLapSimulation } from './fullTrackMath';
import { getSectorAtProgress } from '../../data/circuitSections';

const FULL_TRACK_WIDTH = 12; // metres — full circuits are narrower than the corner stage

// Animated car lapping the full circuit with the same time->distance->pose
// mechanism as the corner simulator.
const LapCarRig = ({ lap, running, cameraMode, onTelemetry }) => {
  const carRef = useRef();
  const spinRef = useRef(0);
  const steerRef = useRef(0);
  const elapsedRef = useRef(0);
  const lapCountRef = useRef(0);
  const telemetryClockRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    elapsedRef.current = 0;
    lapCountRef.current = 0;
  }, [lap]);

  useFrame((_, delta) => {
    if (!carRef.current) return;

    if (running) {
      elapsedRef.current += delta;
      if (elapsedRef.current >= lap.totalTime) {
        elapsedRef.current -= lap.totalTime;
        lapCountRef.current += 1;
      }
    }

    const elapsed = elapsedRef.current;
    const distance = getDistanceAtTime(lap.samples, elapsed);
    const speed = getSpeedAtTime(lap.samples, elapsed);
    const pose = getPoseAtDistance(lap.path, distance);

    carRef.current.position.set(pose.x * SCALE, 0, -pose.y * SCALE);
    carRef.current.rotation.y = pose.heading;

    spinRef.current += (speed / 0.34) * delta * 0.55;
    const targetSteer = (pose.curvature ?? 0) * 9;
    steerRef.current += (targetSteer - steerRef.current) * Math.min(1, delta * 8);

    telemetryClockRef.current += delta;
    if (telemetryClockRef.current > 0.15) {
      telemetryClockRef.current = 0;
      onTelemetry?.({
        speed: Math.round(speed * 3.6),
        elapsed,
        lap: lapCountRef.current + 1,
        progress: distance / lap.path.totalLength,
      });
    }

    if (cameraMode === 'chase' && running) {
      const back = 6.4;
      const target = new THREE.Vector3(
        pose.x * SCALE - Math.cos(pose.heading) * back,
        3,
        -pose.y * SCALE + Math.sin(pose.heading) * back,
      );
      camera.position.lerp(target, Math.min(1, delta * 3.2));
      camera.lookAt(pose.x * SCALE, 0.4, -pose.y * SCALE);
    }
  });

  return (
    <group ref={carRef}>
      <FormulaCar spinRef={spinRef} steerRef={steerRef} />
    </group>
  );
};

// Frames the whole circuit whenever geometry or camera mode changes.
const CircuitFraming = ({ center, size, cameraMode }) => {
  const { camera } = useThree();
  const lastKeyRef = useRef(null);

  useEffect(() => {
    const key = `${center[0]}:${center[2]}:${size}:${cameraMode}`;
    if (cameraMode === 'chase' || lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    camera.position.set(center[0] - size * 0.28, size * 0.62, center[2] + size * 0.55);
    camera.lookAt(center[0], 0, center[2]);
  }, [camera, center, size, cameraMode]);

  return null;
};

const FullTrackContents = ({ lap, sections, running, cameraMode, onTelemetry }) => {
  const trackGeometry = useMemo(
    () => buildRibbonGeometry(lap.path.points, FULL_TRACK_WIDTH, { yOffset: 0.005 }),
    [lap],
  );
  const kerbInner = useMemo(
    () => buildRibbonGeometry(lap.path.points, KERB_WIDTH, {
      zone: 'arc',
      sideOffset: FULL_TRACK_WIDTH / 2 + KERB_WIDTH / 2 - 0.3,
      yOffset: 0.02,
      stripeColors: ['#d40018', '#e8ecf4'],
    }),
    [lap],
  );
  const kerbOuter = useMemo(
    () => buildRibbonGeometry(lap.path.points, KERB_WIDTH, {
      zone: 'arc',
      sideOffset: -(FULL_TRACK_WIDTH / 2 + KERB_WIDTH / 2 - 0.3),
      yOffset: 0.02,
      stripeColors: ['#d40018', '#e8ecf4'],
    }),
    [lap],
  );
  const startLine = useMemo(() => {
    const startPoints = lap.path.points.filter((point) => point.s <= 6);
    return startPoints.length > 1
      ? buildRibbonGeometry(startPoints, FULL_TRACK_WIDTH, { yOffset: 0.03 })
      : null;
  }, [lap]);

  // Centre line split into sector-coloured segments.
  const sectorLines = useMemo(() => {
    const { points, totalLength } = lap.path;
    return (sections?.sectors ?? []).map((sector) => {
      const from = sector.range[0] * totalLength;
      const to = sector.range[1] * totalLength;
      const linePoints = points
        .filter((point) => point.s >= from && point.s <= to)
        .map((point) => [point.x * SCALE, 0.05, -point.y * SCALE]);
      return { id: sector.id, color: sector.color, points: linePoints };
    }).filter((line) => line.points.length > 1);
  }, [lap, sections]);

  const { center, size } = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    lap.path.points.forEach((point) => {
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
  }, [lap]);

  return (
    <>
      <color attach="background" args={['#07090f']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[120, 180, 90]} intensity={1.2} />
      <hemisphereLight args={['#3a4a6b', '#0a0c12', 0.55]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.02, center[2]]}>
        <planeGeometry args={[size * 4, size * 4]} />
        <meshStandardMaterial color="#0b0f16" roughness={0.95} />
      </mesh>
      <gridHelper
        args={[size * 4, 90, '#182031', '#10141d']}
        position={[center[0], -0.01, center[2]]}
      />

      <mesh geometry={trackGeometry}>
        <meshStandardMaterial color="#2a2f3a" roughness={0.92} />
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

      {sectorLines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color={line.color}
          lineWidth={1.4}
          transparent
          opacity={0.8}
        />
      ))}

      <FinishGantry path={lap.path} />

      <LapCarRig
        lap={lap}
        running={running}
        cameraMode={cameraMode}
        onTelemetry={onTelemetry}
      />

      <CircuitFraming center={center} size={size} cameraMode={cameraMode} />
      <OrbitControls
        enabled={cameraMode === 'orbit'}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={10}
        maxDistance={size * 2.2}
        target={center}
        autoRotate={cameraMode === 'orbit' && running}
        autoRotateSpeed={0.35}
      />
    </>
  );
};

// Full-circuit simulation view — the whole track rendered and lapped with the
// Simulation page's mechanism, embeddable on the circuit detail page.
const FullTrackSimulation = ({ circuit, outlinePoints, sections }) => {
  const lap = useMemo(
    () => (outlinePoints ? buildLapSimulation(outlinePoints, circuit) : null),
    [outlinePoints, circuit],
  );
  const [running, setRunning] = useState(true);
  const [cameraMode, setCameraMode] = useState('orbit');
  const [telemetry, setTelemetry] = useState({ speed: 0, elapsed: 0, lap: 1, progress: 0 });

  if (!lap) {
    return (
      <div className="full-sim-empty">
        <p>No simulation geometry is available for this circuit yet.</p>
      </div>
    );
  }

  const activeSector = getSectorAtProgress(sections, telemetry.progress);

  return (
    <div className="full-sim-shell">
      <div className="full-sim-canvas">
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [-40, 70, 70], fov: 46, far: 4000 }}
          style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
        >
          <FullTrackContents
            lap={lap}
            sections={sections}
            running={running}
            cameraMode={cameraMode}
            onTelemetry={setTelemetry}
          />
        </Canvas>

        <div className="full-sim-hud" aria-live="off">
          <div className="full-sim-hud-block">
            <span>Speed</span>
            <strong>{telemetry.speed}<em> km/h</em></strong>
          </div>
          <div className="full-sim-hud-block">
            <span>Lap {telemetry.lap}</span>
            <strong>{telemetry.elapsed.toFixed(1)}<em> s</em></strong>
          </div>
          {activeSector && (
            <div className="full-sim-hud-block sector" style={{ '--sector-color': activeSector.color }}>
              <span>On track</span>
              <strong>{activeSector.name}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="full-sim-controls">
        <button
          type="button"
          className="pw-button ghost"
          onClick={() => setRunning((value) => !value)}
        >
          {running ? 'Pause lap' : 'Resume lap'}
        </button>
        <button
          type="button"
          className="pw-button ghost"
          onClick={() => setCameraMode((mode) => (mode === 'orbit' ? 'chase' : 'orbit'))}
        >
          {cameraMode === 'orbit' ? 'Chase camera' : 'Orbit camera'}
        </button>
        <div className="full-sim-stats">
          <span>Simulated lap <strong>{lap.formattedTime}</strong></span>
          <span>Top speed <strong>{lap.topSpeed} km/h</strong></span>
          <span>Track length <strong>{(lap.lengthMeters / 1000).toFixed(3)} km</strong></span>
        </div>
      </div>
    </div>
  );
};

export default FullTrackSimulation;
