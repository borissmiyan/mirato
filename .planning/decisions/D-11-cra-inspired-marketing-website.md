# D-11: Cra-Inspired Marketing & Presentation Portal Architecture

## Status
Accepted

## Date
2026-11-11

## Context
Ekklesienter required a high-craft marketing and presentation portal mirroring the minimalist Apple aesthetic of Cra browser (`crabrowser.app`). The portal needed to serve both as a standalone public web landing site (deployable to static web hosting, GitHub Pages, Vercel, Cloudflare Pages) and as an embedded in-app presentation window without bloating the primary Electron controller bundle.

## Decision
1. **Isolated Feature Module (`src/features/website/`)**:
   All marketing, landing, feature wall, release notes, and privacy manifesto components are strictly encapsulated in `src/features/website/` under individual modular files (<250 lines per component), exposing a clean public API via `src/features/website/index.ts`.
2. **Dual-Target Vite Rollup Entry (`landing.html` + `src/landing.tsx`)**:
   Registered `landing: path.resolve(__dirname, 'landing.html')` in `vite.config.ts`. This produces a separate code-split bundle (`dist/landing.html`, `dist/assets/landing-*.js`) that does not impact cold-start latency of `index.html`.
3. **Cra Design Philosophy & Typography Matching**:
   - Deep stone background (`#0c0a09`), subtle radial mesh glows.
   - High-contrast editorial serif headlines paired with modern UI sans (`Inter`) and tabular figures (`tabular-nums`).
   - Floating frosted glass navigation pill (`WebsiteHeader.tsx`) with route persistence.
   - Interactive macOS window mockup (`MacWindowMockup.tsx`) showcasing live Scripture, Hymn with musician chords, Stage Confidence Monitor, and Bézier vector editing.
   - Side-by-side migration matrix ("Coming from ProPresenter / EasyWorship").
   - Categorized feature wall (`/features`) with search and keyboard shortcut indicators (`Kbd`).
   - Transparent version timeline (`/release-notes`) and privacy manifesto (`/privacy`).
4. **Zero-Emoji and Design Invariant Adherence**:
   Only vector SVG icons from `lucide-react` are permitted. All components memoized with `React.memo`.

## Key Invariants
- **Offline & Zero-Telemetry:** The website and its assets contain zero tracking scripts, remote analytics, or third-party cookies.
- **Component Budget Compliance:** Every component is decoupled into sub-250 line files with zero circular dependencies.

## Consequences
- **Positive:** Pristine, Apple-grade marketing and documentation surface that can be hosted statically or rendered offline. 100% test coverage with hermetic vitest tests.
- **Negative / Trade-offs:** An additional HTML entrypoint in Vite configuration, requiring standard MPA build monitoring.

