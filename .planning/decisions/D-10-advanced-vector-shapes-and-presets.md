# D-10: Advanced Vector Shapes Engine, Segmented Donut & Universal Presets System

## Status
Accepted

## Date
2026-11-05

## Context
Standard SVG primitives (static circle, triangle, rect) in Deck.CE lacked the parametric expressive power required for high-end presentation design. Users need:
1. Star customization (points 3..60, depth ratio, inner corner radius, independent per-ray outer corner radius).
2. Polygon customization (unifying triangle and N-gons into a 3..60 sides parametric figure with independent per-vertex corner rounding).
3. Arc & Donut customization with sector segmentation (start/sweep angles, hole ratio, discrete sectors with gaps and weights).
4. A universal preset engine for all shapes with Shift+Click quick access and selective property baking (style, geometry, dimensions, position).

## Decision
1. **Unify Triangle into Polygon:** Triangle is represented as a polygon with `polygonSides: 3`. Legacy `shapeType: 'triangle'` is preserved for backward compatibility and mapped to polygon geometry.
2. **Modular Math Architecture (< 250 lines per module):**
   - `renderers/shapes/starGeometry.ts`
   - `renderers/shapes/polygonGeometry.ts`
   - `renderers/shapes/arcGeometry.ts`
   - `renderers/shapes/shapePresetsData.ts`
3. **Normalized [0, 1] Space & objectBoundingBox:** All parametric shapes are rendered in unit coordinates `[0, 1]` and clipped via `<clipPath clipPathUnits="objectBoundingBox">`, ensuring 100% bounding box fill regardless of container aspect ratio.
4. **SVG Arc 360° Invariant:** Full 360° circles or donuts are constructed from two 180° arcs to prevent SVG zero-length path collapse.
5. **Fillet Clamping Guard:** Vertex fillets are mathematically clamped by adjacent edge lengths to prevent self-intersecting loops: $R_{clamped} = \min(R, \frac{L}{2} \tan(\theta/2))$.
6. **Selective Preset Baking & Non-Enforced Positions:** Presets store partial `ICanvasItem` definitions with explicit baking flags. Coordinates `(x, y)` are omitted by default so presets apply at the user's cursor location.
7. **Shift + Click Toolbar Launcher:** Clicking a shape tool on the toolbar activates creation mode; holding Shift while clicking opens the `ShapePresetsModal`.

## Key Invariants
- **[No Degenerate Arcs]:** SVG arc commands must never have identical start and end coordinates without decomposition.
- **[Backwards Compatibility]:** Legacy slides with `shapeType: 'triangle'` must continue to render correctly without migrations.
- **[Component Size Ceiling]:** No file in the vector geometry or inspector section may exceed 500 lines.

## Consequences
- **Positive:** Figma-grade vector parametric modeling, interactive scrubbing controls, instant preset library, zero regression on existing slides.
- **Negative / Trade-offs:** Increased math complexity for Bezier fillets; requires thorough unit test coverage for degenerate geometries.

