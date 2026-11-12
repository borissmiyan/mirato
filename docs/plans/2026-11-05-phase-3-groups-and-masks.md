# 🎨 Plan: Phase 3 — Figma-Grade Groups & Masks System

> **Date:** 2026-11-05  
> **Target:** Deck.CE Slide Editor (Groups & Masking)  
> **Diff Budget:** < 450 lines per atomic commit  
> **File Line Limits:** Strictly < 500 lines per file  

---

## 1. Scope & Boundaries (Non-Goals)

### In Scope
1. **Data Model:**
   - Extend `ICanvasItem` with `isMask?: boolean` in `src/core/types/canvas.ts`.
2. **Core Logic & Pure Utilities (`src/core/utils/canvasMasks.ts`):**
   - `toggleCanvasMask(items: ICanvasItem[], targetId: string): ICanvasItem[]`
   - `groupCanvasItems(items: ICanvasItem[], targetIds: string[], newGroupId?: string): ICanvasItem[]`
   - `ungroupCanvasItems(items: ICanvasItem[], targetIds: string[]): ICanvasItem[]`
   - `getGroupMaskMap(items: ICanvasItem[]): Map<string, { maskItem?: ICanvasItem; maskedItems: ICanvasItem[]; otherItems: ICanvasItem[] }>`
   - `duplicateGroupItems(items: ICanvasItem[], itemIds: string[]): ICanvasItem[]` (ensuring cloned groups receive a new unique `groupId`).
3. **Hermetic Unit Tests (`src/core/utils/__tests__/canvasMasks.test.ts`):**
   - 100% test coverage for mask toggle, group/ungroup, group hierarchy partitioning, duplicate group mapping.
4. **SVG Mask Rendering (`MaskGroupRenderer.tsx`):**
   - High-performance, 0-drift SVG `<clipPath>` generation matching mask layer geometry (shapes, bezier paths, rounded rectangles).
   - Applied in both `SlideCanvas.tsx` (Slide Editor) and `SlideContentRenderer.tsx` (Projector & Thumbnails).
5. **Figma Interaction & UI Affordances:**
   - Single click: selects Group container / bounding box.
   - Deep select: `Cmd+Click` (or double click) penetrates group to select individual child.
   - `Cmd+G` to Group, `Cmd+Shift+G` to Ungroup, `Ctrl+Cmd+M` to toggle Mask.
   - Context Menu (`CanvasContextMenu.tsx`): "Использовать как маску" / "Use as mask" action.
   - Inspector (`ItemProperties.tsx`): Mask toggle button in Layout section.
   - Layers tab (`LayerRow.tsx`): Mask icon badge (`Blend` from `lucide-react`) and Group badge for visual clarity.

### Non-Goals
- Raster pixel alpha channel painting (deck.ce uses vector clipping masks as in Figma vector masks).
- Nested sub-sub-sub-groups > 3 levels (single-level and 2-level groups are fully supported by `groupId`).
- Modifying unrelated slide timeline, hymn databases, or projector window electron IPC.

---

## 2. Adversarial Critic Audit (Devil's Advocate Gate)

1. **Assumption Filter:** *Does `clipPath` work across different coordinate systems between mask and masked items?*
   - *Verdict Passed:* By anchoring the SVG `<clipPath>` and the masked items container to the common 100% 16:9 slide root (viewBox `0 0 1920 1080`), all slide percentage coordinates map 1:1 with 0 drift.
2. **Edge Case Filter:** *What if the mask item is deleted or unmasked?*
   - *Verdict Passed:* The group automatically degrades to a standard group without mask. No orphaned SVG clipPath references or rendering breaks.
3. **Figma Parity Filter:** *Can the user move the masked photo independently inside the mask?*
   - *Verdict Passed:* When deep-selected (`Cmd+Click` or double-click), the photo's own handles appear and moving it adjusts its relative position inside the mask.
4. **Budget & Limit Filter:** *Does any file exceed 500 lines?*
   - *Verdict Passed:* `SlideCanvas.tsx` is 474 lines. The new logic is extracted into `MaskGroupRenderer.tsx` (110 lines) and `canvasMasks.ts` (95 lines), keeping `SlideCanvas.tsx` strictly < 485 lines.

---

## 3. Atomic TDD Execution Steps

1. **Step 1 (Red-Green Test):**
   - Create `src/core/utils/__tests__/canvasMasks.test.ts` with comprehensive unit tests for group, ungroup, mask toggle, and partitioning.
   - Implement `src/core/utils/canvasMasks.ts` and update `src/core/types/canvas.ts`.
   - Run `npx vitest run src/core/utils/__tests__/canvasMasks.test.ts`.
2. **Step 2 (Rendering Component):**
   - Create `src/features/presenter/components/slide-editor/renderers/MaskGroupRenderer.tsx`.
   - Mount `MaskGroupRenderer` in `SlideContentRenderer.tsx` and `SlideCanvas.tsx`.
3. **Step 3 (UX & Shortcuts):**
   - Wire deep-select (`Cmd+Click`) in `useCanvasInteraction.ts`.
   - Add mask action to `CanvasContextMenu.tsx`, `ItemProperties.tsx`, `LayerRow.tsx`, and `useCanvasActions.ts`.
   - Add i18n keys for mask actions in `ru`, `en`, `de`.
4. **Step 4 (Verification Gate):**
   - Run `npm run check:types`, `vitest run`, `npm run check:hygiene && npm run check:esm && npm run check:design`, `npm run build:renderer && npm run check:smoke`.

