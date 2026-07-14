# Canonical circuit geometry

The 40 GeoJSON files in `geojson/` mirror every circuit data row in the
user-provided `circuit.md`. They are sourced from
[`bacinger/f1-circuits`](https://github.com/bacinger/f1-circuits), licensed
under the MIT License by Tomislav Bacinger and contributors.

`circuitRegistry.js` eagerly bundles the geometry so track views also work
offline in Capacitor. Matching copies live in `public/circuits/` for consumers
that need a URL; use `getCircuitGeoJsonUrl()` instead of constructing an
absolute path so Vite's configured base URL is respected.

`circuitManifest.js` is deliberately free of Vite/browser APIs. The backend can
import its `CIRCUIT_MANIFEST` export to share circuit IDs and aliases without
loading frontend geometry code.

All display modes must derive from `geometry.points` or
`geometry.stylisedGeometry.points`. Sector boundaries and generated turn
markers are based on normalized arc length, never screen x/y position.
