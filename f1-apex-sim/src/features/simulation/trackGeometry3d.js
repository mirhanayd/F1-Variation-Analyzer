import * as THREE from 'three';

// Shared 3D track-building helpers used by both the corner simulator scene
// and the full-circuit simulation view.

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
