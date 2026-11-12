# Architecture & Design: High-Performance Video Proxy & Heavyweight Media Pipeline

**Date:** 2026-11-04  
**Status:** Approved  
**Author:** Antigravity & Boris Smiyan  
**ADR Reference:** `D-08-video-proxy-and-heavyweight-performance-pipeline.md`

---

## 1. Context & Motivation

In presentation and live broadcast software (ProPresenter, DaVinci Resolve, Resolume Arena), media playback must satisfy two conflicting demands:
1. **Live Output (Projector / Stage / WebRTC):** Full-fidelity, uncompressed/high-bitrate 4K or 1080p 60 FPS playback with zero dropped frames and perfect audio sync.
2. **Editor Canvas & Timeline:** Ultra-responsive 120 FPS editing experience, instant scrubbing, smooth bounding box dragging, rapid slide reordering, and sub-second project load times.

### Current Bottlenecks Identified in Ekklesienter:
1. **Unoptimized Video Decoding on Canvas:** Editor canvas mounts native `<video>` elements with original 4K/1080p media blobs, saturating GPU/CPU even when scaled down to 40% zoom.
2. **Timeline Slide Over-Mounting:** Each slide tile on the timeline mounts a full 1920×1080 DOM tree (`SlideContentRenderer`), instantiating live `<video>` elements and heavy image layers for thumbnails.
3. **Large Blob Allocations in Memory:** Dexie IndexedDB reads massive 500MB–2GB video blobs into RAM, creating `URL.createObjectURL` references that bloat heap memory.
4. **Heavy Procedural SVG Shaders:** SVG noise (`feTurbulence`) and `backdrop-filter: blur(...)` run expensive GPU fragment shaders on every frame of video playback.
5. **Cold Start Time for Presentations:** `.ektp` packages currently store only one `preview.png` for the entire presentation. Opening a presentation with 50+ slides requires real-time DOM evaluation for every slide.

---

## 2. Core Architecture

```
                                  +---------------------------------------+
                                  |        Media Import (.mp4, .mov)      |
                                  +---------------------------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
         +--------------------------------+                       +---------------------------------+
         |      Original Master File      |                       |       Background Proxy Gen      |
         |    (4K/1080p High-Bitrate)     |                       |       (540p / 360p WebP/MP4)    |
         +--------------------------------+                       +---------------------------------+
                         |                                                         |
                         | (Full Quality)                                          | (Fast Decode)
                         v                                                         v
          +-----------------------------+                           +-----------------------------+
          |   Projector / Stage View    |                           |     Slide Editor Canvas     |
          |  (Hardware Decoded 60 FPS)  |                           | [Full (1x) | 1/2 | 1/4 Res] |
          +-----------------------------+                           +-----------------------------+
```

### 2.1 Video Storage & Proxy Pipeline
* **Master (Original):** Saved to local disk storage (`userData/media/originals/<hash>.<ext>`). Served via `local-resource://` or HTTP Range streaming (`206 Partial Content`).
* **Proxy (Preview):** Generated on-demand or in the background as 540p (960×540, ~1.5 Mbps H.264) in `userData/media/proxies/<hash>.mp4`.
* **Resolution Control:** The slide editor toolbar exposes a compact resolution toggle:
  * `1x (Full)` — original master video.
  * `1/2 (540p)` — default proxy mode (optimal performance/clarity).
  * `1/4 (270p)` — ultra-fast mode for dense multi-layer slides.
* **Projector Isolation:** `ProjectorView` and `StageView` strictly ignore the canvas resolution setting, always consuming the full master stream.

### 2.2 Pre-baked Slide Thumbnails in `.ektp`
* During presentation export (`EktpService.pack`), 128×72 WebP thumbnails are generated for each slide and packed into `thumbnails/<slideId>.webp`.
* On presentation import or opening, the timeline immediately displays pre-baked WebP thumbnails without ever mounting `<video>` tags or complex DOM trees.
* Presentation opening speed drops from ~3000ms to **under 50ms**.

### 2.3 Electron Hardware Acceleration
In `electron/main.ts`, enable Chromium GPU flags before `app.whenReady()`:
```ts
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
```

### 2.4 GPU Shaders: Static Noise Tile Replacement
* Replace procedural SVG `feTurbulence` with a 128×128 seamless tiled noise PNG.
* Eliminates heavy per-frame fragment shader recalculations on GPU during video playback.

### 2.5 Timeline Virtual Windowing & Video Freezing
* Non-visible slides in the timeline are virtualized out of the DOM.
* Slides on the timeline display static thumbnails and never instantiate HTML5 `<video>` decoders.
* Active canvas video temporarily pauses or drops playback to 15 FPS while user actively drags items on the canvas to guarantee 120 FPS UI manipulation.

---

## 3. Scope & Non-Goals

### In Scope:
1. Electron hardware video decoding switches.
2. Pre-baked per-slide WebP thumbnails in `.ektp` and fast timeline rendering.
3. Lightweight video proxy architecture (storage, background worker, fallback to master).
4. Canvas resolution toggle in editor toolbar (`Full`, `1/2`, `1/4`).
5. Replacing SVG `feTurbulence` noise with static tiled noise asset.

### Non-Goals:
* Modifying audio playback engine or audio sync algorithms.
* Re-encoding or compressing user's master video files (master files are preserved intact).
* Changing user interface layouts beyond adding the resolution pill in canvas toolbar.

---

## 4. Phased Implementation Plan

1. **Phase 1: GPU Flags & Shader Optimization (Diff budget < 100 lines)**
   - Electron GPU acceleration switches in `electron/main.ts`.
   - Optimized static noise tile in `NoiseEffectRenderer.tsx`.
2. **Phase 2: Pre-Baked Slide Thumbnails in `.ektp` & Timeline Freeze (Diff budget < 250 lines)**
   - Add `thumbnails/<slideId>.webp` generation to `ektpService.ts`.
   - Update `SlideTile.tsx` to read pre-baked thumbnail if available, completely skipping 1920×1080 DOM tree mounting.
3. **Phase 3: Video Proxy Generation & Cache Service (Diff budget < 350 lines)**
   - Implement `VideoProxyService` with Web Worker / ffmpeg proxy generation.
   - Cache proxy files on disk under `userData/media/proxies/`.
4. **Phase 4: Canvas Resolution Selector & Viewport Integration (Diff budget < 200 lines)**
   - Add `canvasResolution` atom/store setting (`full`, `half`, `quarter`).
   - Add UI segmented pill to `SlideEditorToolbar.tsx`.
   - Update `SlideBackground.tsx` to route canvas to proxy and projector to master.

