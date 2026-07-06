# PITWALL — F1 Race Companion

A modern, dark, mobile-first Formula 1 companion app built with React + Vite.

## Features

- **Rounds & Schedule** — the full season at a glance: compact previous-round cards,
  a Next Grand Prix hero with a live countdown, and every remaining round with
  FP1/FP2/FP3, Sprint Qualifying, Sprint, Qualifying and Race times shown in your
  local timezone.
- **Circuits library** — every F1 venue (current calendar + historic circuits such as
  Istanbul Park, Imola, Sepang, Hockenheim), each with a detail page: length, laps,
  race distance, first GP, lap record, corners, DRS zones, a real track outline from
  OpenF1 where available, and race history from the Jolpica archive.
- **Race replay** — opt-in replay of real car positions from the most recent race at
  a circuit, drawn over the interactive track map.
- **Corner Simulator** — pick any circuit and a signature corner, tune entry speed,
  braking point, apex, steering, throttle, racing line and exit speed, then watch a
  generic red F1 car run the section in 3D with start lights, a chase camera and a
  section-time result compared against the theoretical optimum.

## Data sources

- [OpenF1](https://openf1.org) — meetings, sessions, track geometry, car locations
- [Jolpica (Ergast successor)](https://api.jolpi.ca) — season schedules, circuits, results

PITWALL is an unofficial project and is not associated with Formula 1.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm run lint     # eslint
```

## Stack

React 19 · Vite 7 · react-router 7 · TanStack Query · three.js via @react-three/fiber + drei · GSAP
