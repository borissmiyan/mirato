# D-09: Cold Start Zero Black Screen Optimization

## Status
Accepted

## Date
2026-11-05

## Context
On cold launch from scratch, the application exhibited a ~15-second black screen before the loading screen appeared. This was caused by static importing of the monolithic `App` tree in `src/main.tsx` (forcing Vite/Chromium to crawl and evaluate 2,500+ ESM modules before running line 1 of React), an empty `<div id="root">` element displaying unstyled black background, synchronous DevTools startup in Electron, and a monolithic 4.76MB production JS bundle without Rollup chunk splitting.

## Decision
1. **Dynamic Code-Splitting for App Entry (`React.lazy`):**
   - In `src/main.tsx`, `App` is dynamically imported via `React.lazy(() => import('./app/App'))`.
   - `<LoadingScreen />` mounts synchronously in ~15ms, immediately providing animated branding and visual feedback while `App` loads asynchronously in the background.
2. **Zero-JS Inline HTML/CSS Splash Preloader:**
   - In `index.html`, inside `<div id="root">`, an inline CSS preloader with the brand icon and shimmer line renders at 0ms before any JavaScript executes.
   - React automatically replaces this preloader when mounting `LoadingScreen`.
3. **Rollup Vendor Chunk Splitting (`manualChunks`):**
   - In `vite.config.ts`, split large node_modules packages into dedicated chunks (`vendor-react`, `vendor-icons`, `vendor-db`, `vendor-media`, `vendor-i18n`), enabling parallel streaming and long-term HTTP caching.
4. **Non-blocking DevTools & Native Background Color:**
   - In `electron/windows/windowManager.ts`, set `backgroundColor: '#0c0a09'` and guard synchronous `openDevTools()` behind `OPEN_DEVTOOLS=true`, avoiding renderer main thread freezing on macOS.

## Key Invariants
- **Zero Black Screen:** An active visual splash element must be painted at 0ms.
- **Sync LoadingScreen Mount:** The LoadingScreen component must mount within the first render cycle.
- **500-Line Limit:** All modified files must remain under 500 lines.

## Consequences
- **Positive:**
  - Instant (0ms) visual response upon launching the application.
  - Loading screen appears in < 20ms instead of 15 seconds.
  - Faster initial parse and reduced bundle sizes across multiple HTML entries (main, projector, remote, stage).
- **Negative / Trade-offs:**
  - Chunk splitting produces slightly more asset files in `dist/assets/`, easily managed by Vite.

