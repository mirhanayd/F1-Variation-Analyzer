import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildNeutralPath,
  getDistanceAtTime,
  getPoseAtDistance,
  getSpeedAtTime,
} from './simulationMath';

export const SCALE = 1 / 6; // metres -> scene units
export const TRACK_WIDTH = 13; // metres
export const KERB_WIDTH = 1.6;

export const toScene = (point) => [point.x * SCALE, 0, -point.y * SCALE];

// Triangle-strip ribbon along a 2D path. Optionally offset sideways (metres)
// and restricted to a zone ('arc' for kerbs), with alternating vertex colors.
export const buildRibbonGeometry = (points, width, {
  sideOffset = 0,
  yOffset = 0.01,
  zone = null,
  stripeColors = null,
  stripeLength = 4,
} = {}) => {
  const positions = [];
  const colors = [];
  const indices = [];
  const half = (width / 2) * SCALE;
  const offset = sideOffset * SCALE;

  const colorA = stripeColors ? new THREE.Color(stripeColors[0]) : null;
  const colorB = stripeColors ? new THREE.Color(stripeColors[1]) : null;

  let stripIndex = -1;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (zone && point.zone !== zone) {
      stripIndex = -1;
      continue;
    }

    const nx = -Math.sin(point.heading);
    const ny = Math.cos(point.heading);
    const cx = point.x + nx * (offset / SCALE);
    const cy = point.y + ny * (offset / SCALE);

    positions.push(
      (cx + nx * (half / SCALE)) * SCALE, yOffset, -(cy + ny * (half / SCALE)) * SCALE,
      (cx - nx * (half / SCALE)) * SCALE, yOffset, -(cy - ny * (half / SCALE)) * SCALE,
    );

    if (stripeColors) {
      const color = Math.floor(point.s / stripeLength) % 2 === 0 ? colorA : colorB;
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const vertexIndex = positions.length / 3 - 2;
    if (stripIndex >= 0) {
      indices.push(stripIndex, stripIndex + 1, vertexIndex);
      indices.push(stripIndex + 1, vertexIndex + 1, vertexIndex);
    }
    stripIndex = vertexIndex;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (stripeColors) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const Wheel = ({ position, spinRef, steerRef, front = false }) => {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    if (front && steerRef?.current !== undefined) {
      groupRef.current.rotation.y = steerRef.current;
    }
    const mesh = groupRef.current.children[0];
    if (mesh && spinRef?.current !== undefined) {
      mesh.rotation.x = spinRef.current;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.36, 20]} />
        <meshStandardMaterial color="#0c0e12" roughness={0.85} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.37, 16]} />
        <meshStandardMaterial color="#8b93a5" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};

// Generic red single-seater built from primitives (deliberately unlicensed).
export const FormulaCar = ({ spinRef, steerRef }) => (
  <group scale={SCALE * 1.9}>
    <mesh position={[0, 0.14, 0]} castShadow>
      <boxGeometry args={[3.4, 0.12, 1.5]} />
      <meshStandardMaterial color="#141414" roughness={0.7} />
    </mesh>
    <mesh position={[0.1, 0.38, 0]} castShadow>
      <boxGeometry args={[2.6, 0.4, 0.72]} />
      <meshStandardMaterial color="#d40018" metalness={0.35} roughness={0.32} />
    </mesh>
    <mesh position={[1.7, 0.3, 0]} rotation={[0, 0, -0.06]} castShadow>
      <coneGeometry args={[0.26, 1.5, 4]} />
      <meshStandardMaterial color="#d40018" metalness={0.35} roughness={0.32} />
    </mesh>
    <mesh position={[2.45, 0.18, 0]} castShadow>
      <boxGeometry args={[0.5, 0.07, 1.9]} />
      <meshStandardMaterial color="#1a1c22" roughness={0.5} />
    </mesh>
    <mesh position={[2.45, 0.32, 0.92]}>
      <boxGeometry args={[0.5, 0.24, 0.05]} />
      <meshStandardMaterial color="#d40018" roughness={0.4} />
    </mesh>
    <mesh position={[2.45, 0.32, -0.92]}>
      <boxGeometry args={[0.5, 0.24, 0.05]} />
      <meshStandardMaterial color="#d40018" roughness={0.4} />
    </mesh>
    <mesh position={[-0.35, 0.62, 0]} castShadow>
      <boxGeometry args={[0.9, 0.34, 0.5]} />
      <meshStandardMaterial color="#d40018" metalness={0.3} roughness={0.36} />
    </mesh>
    <mesh position={[0.45, 0.6, 0]} rotation={[0, 0, 0.5]}>
      <torusGeometry args={[0.3, 0.045, 10, 18, Math.PI]} />
      <meshStandardMaterial color="#15171c" roughness={0.4} />
    </mesh>
    <mesh position={[-1.3, 0.5, 0]} castShadow>
      <boxGeometry args={[0.5, 0.5, 0.4]} />
      <meshStandardMaterial color="#2a0d12" roughness={0.5} />
    </mesh>
    <mesh position={[-1.75, 0.78, 0]} castShadow>
      <boxGeometry args={[0.42, 0.08, 1.5]} />
      <meshStandardMaterial color="#d40018" roughness={0.4} />
    </mesh>
    <mesh position={[-1.75, 0.5, 0.72]}>
      <boxGeometry args={[0.42, 0.5, 0.06]} />
      <meshStandardMaterial color="#15171c" roughness={0.45} />
    </mesh>
    <mesh position={[-1.75, 0.5, -0.72]}>
      <boxGeometry args={[0.42, 0.5, 0.06]} />
      <meshStandardMaterial color="#15171c" roughness={0.45} />
    </mesh>
    <Wheel position={[1.15, 0.34, 0.8]} spinRef={spinRef} steerRef={steerRef} front />
    <Wheel position={[1.15, 0.34, -0.8]} spinRef={spinRef} steerRef={steerRef} front />
    <Wheel position={[-1.25, 0.34, 0.84]} spinRef={spinRef} />
    <Wheel position={[-1.25, 0.34, -0.84]} spinRef={spinRef} />
  </group>
);

const Marker = ({ path, distance, color }) => {
  const pose = useMemo(() => getPoseAtDistance(path, distance), [path, distance]);

  return (
    <group position={[pose.x * SCALE, 0, -pose.y * SCALE]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.5, 0.72, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

export const FinishGantry = ({ path }) => {
  const pose = useMemo(() => getPoseAtDistance(path, path.totalLength - 2), [path]);
  const width = (TRACK_WIDTH / 2 + 2) * SCALE;

  return (
    <group
      position={[pose.x * SCALE, 0, -pose.y * SCALE]}
      rotation={[0, pose.heading, 0]}
    >
      <mesh position={[0, 1.4, width]}>
        <cylinderGeometry args={[0.09, 0.09, 2.8, 8]} />
        <meshStandardMaterial color="#3a4152" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.4, -width]}>
        <cylinderGeometry args={[0.09, 0.09, 2.8, 8]} />
        <meshStandardMaterial color="#3a4152" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[width * 2, 0.5, 0.18]} />
        <meshStandardMaterial color="#12151d" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[width * 1.2, 0.28, 0.2]} />
        <meshBasicMaterial color="#e8ecf4" />
      </mesh>
    </group>
  );
};

const CarRig = ({ result, runState, onRunComplete, onTelemetry }) => {
  const carRef = useRef();
  const spinRef = useRef(0);
  const steerRef = useRef(0);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const telemetryClockRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    elapsedRef.current = 0;
    completedRef.current = false;
    if (runState !== 'running') {
      onTelemetry?.({ speed: 0, elapsed: 0, progress: 0 });
    }
  }, [runState, result, onTelemetry]);

  useFrame((_, delta) => {
    if (!carRef.current) return;

    const running = runState === 'running';
    if (running && !completedRef.current) {
      elapsedRef.current += delta;
    }

    const elapsed = runState === 'finished'
      ? result.totalTime
      : Math.min(elapsedRef.current, result.totalTime);
    const distance = getDistanceAtTime(result.samples, elapsed);
    const speed = getSpeedAtTime(result.samples, elapsed);
    const pose = getPoseAtDistance(result.path, distance);

    carRef.current.position.set(pose.x * SCALE, 0, -pose.y * SCALE);
    carRef.current.rotation.y = pose.heading;

    spinRef.current += (speed / 0.34) * delta * 0.55;
    const targetSteer = (pose.curvature ?? 0) * (result.corner.direction === 'left' ? 1 : -1) * 9;
    steerRef.current += (targetSteer - steerRef.current) * Math.min(1, delta * 8);

    if (running && !completedRef.current) {
      telemetryClockRef.current += delta;
      if (telemetryClockRef.current > 0.1) {
        telemetryClockRef.current = 0;
        onTelemetry?.({
          speed: Math.round(speed * 3.6),
          elapsed,
          progress: distance / result.path.totalLength,
        });
      }

      if (elapsedRef.current >= result.totalTime) {
        completedRef.current = true;
        onTelemetry?.({ speed: Math.round(speed * 3.6), elapsed: result.totalTime, progress: 1 });
        onRunComplete?.();
      }

      // Chase camera while the lap is live.
      const back = 5.2;
      const target = new THREE.Vector3(
        pose.x * SCALE - Math.cos(pose.heading) * back,
        2.6,
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

// Frames the whole corner when a new section loads or a run resets.
const CameraFraming = ({ center, size, runState }) => {
  const { camera } = useThree();
  const lastKeyRef = useRef(null);

  useEffect(() => {
    const key = `${center[0]}:${center[2]}:${size}`;
    if (runState === 'running' || lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    camera.position.set(center[0] - size * 0.3, size * 0.42, center[2] + size * 0.62);
    camera.lookAt(center[0], 0, center[2]);
  }, [camera, center, size, runState]);

  return null;
};

const SceneContents = ({ result, runState, onRunComplete, onTelemetry }) => {
  const neutralPath = useMemo(() => buildNeutralPath(result.corner), [result.corner]);

  const trackGeometry = useMemo(
    () => buildRibbonGeometry(neutralPath.points, TRACK_WIDTH, { yOffset: 0.005 }),
    [neutralPath],
  );
  const kerbInner = useMemo(
    () => buildRibbonGeometry(neutralPath.points, KERB_WIDTH, {
      zone: 'arc',
      sideOffset: TRACK_WIDTH / 2 + KERB_WIDTH / 2 - 0.3,
      yOffset: 0.02,
      stripeColors: ['#d40018', '#e8ecf4'],
    }),
    [neutralPath],
  );
  const kerbOuter = useMemo(
    () => buildRibbonGeometry(neutralPath.points, KERB_WIDTH, {
      zone: 'arc',
      sideOffset: -(TRACK_WIDTH / 2 + KERB_WIDTH / 2 - 0.3),
      yOffset: 0.02,
      stripeColors: ['#d40018', '#e8ecf4'],
    }),
    [neutralPath],
  );
  const startLine = useMemo(() => {
    const startPoints = neutralPath.points.filter((point) => point.s <= 3);
    return startPoints.length > 1
      ? buildRibbonGeometry(startPoints, TRACK_WIDTH, { yOffset: 0.025 })
      : null;
  }, [neutralPath]);

  const racingLinePoints = useMemo(
    () => result.path.points.map(toScene).map(([x, , z]) => [x, 0.05, z]),
    [result.path],
  );

  const sceneCenter = useMemo(() => {
    const points = neutralPath.points;
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
    return [((minX + maxX) / 2) * SCALE, 0, -((minY + maxY) / 2) * SCALE];
  }, [neutralPath]);

  const sceneSize = useMemo(
    () => Math.min(150, Math.max(28, neutralPath.totalLength * SCALE * 0.85)),
    [neutralPath],
  );

  const orbitEnabled = runState !== 'running';

  return (
    <>
      <color attach="background" args={['#07090f']} />
      <fog attach="fog" args={['#07090f', 60, 220]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[30, 40, 20]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={['#3a4a6b', '#0a0c12', 0.5]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sceneCenter[0], -0.02, sceneCenter[2]]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#0b0f16" roughness={0.95} />
      </mesh>
      <gridHelper
        args={[600, 120, '#182031', '#10141d']}
        position={[sceneCenter[0], -0.01, sceneCenter[2]]}
      />

      <mesh geometry={trackGeometry} receiveShadow>
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

      <Line points={racingLinePoints} color="#22d3ee" lineWidth={1.6} transparent opacity={0.85} dashed={false} />

      <Marker path={result.path} distance={result.markers.brakeDistance} color="#ff2743" />
      <Marker path={result.path} distance={result.markers.apexDistance} color="#ffd23e" />
      <Marker path={result.path} distance={result.markers.arcEnd} color="#34d97b" />
      <FinishGantry path={result.path} />

      <CarRig
        result={result}
        runState={runState}
        onRunComplete={onRunComplete}
        onTelemetry={onTelemetry}
      />

      <CameraFraming center={sceneCenter} size={sceneSize} runState={runState} />
      <OrbitControls
        enabled={orbitEnabled}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={4}
        maxDistance={180}
        target={sceneCenter}
        autoRotate={runState === 'setup'}
        autoRotateSpeed={0.5}
      />
    </>
  );
};

const SimulationScene = ({ result, runState, onRunComplete, onTelemetry }) => (
  <Canvas
    shadows
    dpr={[1, 1.8]}
    camera={{ position: [-6, 9, 18], fov: 46 }}
    style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
  >
    <SceneContents
      result={result}
      runState={runState}
      onRunComplete={onRunComplete}
      onTelemetry={onTelemetry}
    />
  </Canvas>
);

export default SimulationScene;
