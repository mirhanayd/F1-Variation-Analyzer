# PITWALL live gateway

This package is the only OpenF1 live client in the application. It exchanges
sponsor credentials for an OAuth token on the server, opens one shared MQTT/WSS
connection, normalizes the stream, and broadcasts safe snapshots to React or a
Capacitor WebView through PITWALL's own WebSocket.

## Run

```bash
cd server
npm install
copy .env.example .env   # use `cp` on macOS/Linux
npm run dev
```

The default listener is `http://localhost:8787`. Production should terminate
TLS in front of the gateway and configure the frontend with an HTTPS/WSS URL.

Required only for sponsor live mode:

- `OPENF1_USERNAME`
- `OPENF1_PASSWORD`

Important server settings:

- `OPENF1_TOKEN_URL`, `OPENF1_MQTT_HOST`, `OPENF1_MQTT_PORT`
- `OPENF1_MQTT_WS_URL` and `OPENF1_MQTT_TRANSPORT=mqtts|wss`
- `LIVE_GATEWAY_PORT`
- `FRONTEND_ORIGIN` (comma-separated exact origins in production)

Tokens, passwords, and MQTT credentials are never returned by an endpoint or
sent over `/ws/live`. The browser should only use `VITE_BACKEND_HTTP_URL` and
`VITE_BACKEND_WS_URL` from the frontend environment.

## Interfaces

- `GET /api/health`
- `GET /api/live/status`
- `GET /api/live/sessions/current`
- `GET /api/live/snapshot`
- `WS /ws/live`
- `GET /api/replay/sessions`
- `GET /api/replay/:sessionKey`
- `GET /api/openf1/:endpoint` (strict historical endpoint/filter allowlist)
- `GET /api/jolpica/...` (strict read-only path/query allowlist)

The OpenF1 source subscribes to location, car data, position, intervals, laps,
drivers, sessions, meetings, race control, and weather. Snapshots are throttled
to 10 Hz by default. MQTT keepalive, WebSocket ping/pong, bounded exponential
reconnect, token renewal, duplicate suppression, out-of-order rejection, stale
driver flags, payload limits, client limits, and request/message rate controls
are enabled.

Without sponsor credentials—or when the broker has no active session—the
coordinator labels the state `openf1-historical-replay` / `replay` and loads a
real JSON artifact from `generated-replays/`, then optionally queries a bounded
historical window from the public OpenF1 REST API. If neither is available it
keeps an empty, clearly explained replay snapshot; it never fabricates motion.

Real GeoJSON files under `src/data/circuits/geojson/` are registered at startup.
The projection service maps live x/y/z samples into the matching circuit,
smooths positions, rejects large short-lived jumps, snaps near-track samples,
and reports normalized arc-length progress.
