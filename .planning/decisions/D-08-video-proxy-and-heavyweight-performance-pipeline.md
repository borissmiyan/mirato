# D-08: Video Proxy Architecture and Heavyweight Media Performance Pipeline

## Status
Accepted

## Date
2026-11-04

## Context
Video playback in high-resolution presentation apps creates severe CPU/GPU contention between full-quality projector output and a smooth 120 FPS editor interface. Playing uncompressed or 4K/1080p high-bitrate video directly on the editor canvas and mounting full DOM trees for every timeline slide caused noticeable lag, high memory consumption, and slow presentation opening times.

## Decision
1. **Decouple Editor Canvas and Live Output:**
   - The projector (`ProjectorView`) strictly renders master high-resolution media.
   - The editor canvas (`SlideCanvas`) uses lightweight 540p/360p proxies according to the canvas resolution setting (`full`, `half`, `quarter`).
2. **Pre-baked Per-Slide WebP Thumbnails in `.ektp`:**
   - `.ektp` packaging will bundle lightweight 128×72 WebP thumbnails (`thumbnails/<slideId>.webp`) for every slide, eliminating runtime DOM tree mounting on the timeline.
3. **Hardware Video Decoding:**
   - Enable Chromium hardware video decoding and GPU rasterization switches in `electron/main.ts`.
4. **Shader De-escalation:**
   - Replace procedural SVG `feTurbulence` noise with seamless pre-rendered PNG noise tiles to relieve fragment shader load during video playback.

## Key Invariants
- **Zero Output Degradation:** The projector, stage view, and NDI streams MUST ALWAYS receive the original master resolution media regardless of the canvas resolution setting.
- **Master Media Preservation:** Video proxy generation must never overwrite, alter, or compress the original user master file.
- **Zero-Video Timeline:** Timeline slide cards must never instantiate active HTML5 `<video>` tags; they must strictly render static thumbnails or poster frames.

## Consequences
- **Positive:**
  - 120 FPS buttery-smooth canvas interaction and bounding box dragging even with multiple video layers.
  - Sub-50ms cold-start time when opening 50+ slide presentations from `.ektp`.
  - Massive drop in RAM and GPU temperature on user machines.
- **Negative / Trade-offs:**
  - Background proxy generation requires temporary disk space in `userData/media/proxies/`.

