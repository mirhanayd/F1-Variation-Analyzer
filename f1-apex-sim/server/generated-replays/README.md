# Generated replay artifacts

Place real, precomputed OpenF1 or FastF1-derived replay JSON files in this directory.
The gateway discovers `*.json` files automatically and never fabricates track or
vehicle movement when an artifact is unavailable.

Supported top-level fields include `meeting`, `session`, `drivers`, `location`,
`locationByDriver`, `carData`, `position`, `intervals`, `laps`, and `window`.
FastF1 generation is intentionally backend-only; frontend code consumes these
artifacts through the gateway REST/WebSocket interfaces.
