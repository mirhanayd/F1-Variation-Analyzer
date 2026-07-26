import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

export const Wheel = ({ position, spinRef, steerRef, front = false }) => {
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
export const FormulaCar = ({ spinRef, steerRef, scale = SCALE * 1.9 }) => (
  <group scale={scale}>
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
