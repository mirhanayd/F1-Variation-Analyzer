# PITWALL — F1 Race Companion

PITWALL is a React/Vite/Capacitor Formula 1 companion with a server-owned
OpenF1 live gateway, clearly labelled historical replay fallback, and one
canonical real-geometry pipeline for circuit cards, maps, stylised outlines,
full-track simulation, and live/replay markers.

## Architecture

```text
OpenF1 OAuth + MQTT/WSS ──> Node live gateway ──> /ws/live ──> React/Capacitor
OpenF1/Jolpica history ───> safe backend proxy ─> /api/* ────> React/Capacitor
FastF1 (optional) ────────> generated JSON ─────> replay service
canonical GeoJSON ───────> shared projection/rendering pipeline
```

The frontend never receives an OpenF1 username, password, access token, MQTT
credential, or upstream live URL. It only uses `VITE_BACKEND_HTTP_URL` and
`VITE_BACKEND_WS_URL`. OpenF1 and Jolpica historical requests are also routed
through narrow read-only backend proxies.

## Run the frontend

```bash
npm install
copy .env.example .env.local
npm run dev
```

On macOS/Linux, use `cp .env.example .env.local`. The default frontend is
served by Vite and expects the gateway on port 8787.

Useful checks:

```bash
npm run lint
npm run build
npm run test:server
```

## Run the gateway

```bash
npm run gateway:install
copy server\.env.example server\.env
npm run gateway:dev
```

Sponsor credentials are optional. Set these only in `server/.env` to enable
live timing:

- `OPENF1_USERNAME`
- `OPENF1_PASSWORD`

Server connection settings include `OPENF1_TOKEN_URL`, `OPENF1_MQTT_HOST`,
`OPENF1_MQTT_PORT`, `OPENF1_MQTT_WS_URL`, `LIVE_GATEWAY_PORT`, and
`FRONTEND_ORIGIN`. `LIVE_GATEWAY_HOST` defaults to loopback; set it explicitly
for a container/LAN deployment. Configure `LIVE_TRUST_PROXY_HOPS` only for the
exact trusted TLS proxy path. For a private sponsor feed, enforce user/session
authentication at that trusted edge; CORS and WebSocket Origin checks are
defence-in-depth, not user authentication. Never prefix a sponsor secret with
`VITE_`.

The gateway exposes:

- `GET /api/health`
- `GET /api/live/status`
- `GET /api/live/sessions/current`
- `GET /api/live/snapshot`
- `WS /ws/live`
- `GET /api/replay/sessions`
- `GET /api/replay/latest?circuitShortName=...`
- `GET /api/replay/:sessionKey`
- allowlisted historical proxies under `/api/openf1/*` and `/api/jolpica/*`

## Live and replay behavior

The gateway exchanges sponsor credentials for an OAuth token in memory,
refreshes it before expiry, and opens one shared MQTT or MQTT-over-WSS
connection. It subscribes to location, car data, position, intervals, laps,
drivers, sessions, meetings, race control, and weather. Incoming records are
deduplicated and normalized into a `LiveSnapshot`, then broadcast at a bounded
rate through PITWALL's WebSocket.

When credentials are missing or no live session is active, the gateway switches
to `openf1-historical-replay`. It first checks `server/generated-replays`, then
can load a bounded historical OpenF1 session. The UI always labels this as
replay; it is never presented as live. If no real replay is available, the app
stays usable with an honest unavailable state and no fabricated animation.

## Real circuit geometry

`src/data/circuits/circuitRegistry.js` represents all 40 rows in the supplied
`circuit.md`, including historic tracks and Intercity Istanbul Park. The copied
GeoJSON files live under `src/data/circuits/geojson/` and come from the MIT
licensed `bacinger/f1-circuits` dataset.

Every geometry is converted from longitude/latitude into local metres and an
aspect-preserving display coordinate system. Sectors are divided by cumulative
arc length. When source turn names are unavailable, generated turns use `T1`,
`T2`, and so on. Stylised outlines are simplified and smoothed derivatives of
the same real points rather than hand-drawn substitutes.

OpenF1 `x/y/z` values are not assumed to align with GeoJSON. The projection
layer calibrates rotation/scale/translation, fits observed bounds, snaps to the
nearest real track segment, computes lap progress, rejects outliers, smooths
updates, and caches transform metadata per circuit/session.

## Optional FastF1 replay generation

FastF1 is backend-only:

```bash
python -m venv server/python/.venv
server\python\.venv\Scripts\pip install -r server\python\requirements.txt
server\python\.venv\Scripts\python server\python\fastf1_replay_generator.py 2025 Monaco R
```

On macOS/Linux, activate the virtual environment from `bin/` instead. Generated
files are written to `server/generated-replays/` and served by the gateway; the
React application never imports Python or FastF1.

## Capacitor / Android

Capacitor and the Android project are already present. For a future native build:

```bash
npm install
npm run android:sync
npm run android:open
```

Or build a debug APK with `npm run android:apk`. Before a device build, set the
frontend URLs to HTTPS/WSS endpoints reachable from the phone. `localhost` on
Android means the device itself, and the configured secure WebView does not
allow a production HTTPS app to connect to insecure HTTP/WS.

PITWALL is unofficial and is not associated with Formula 1.
