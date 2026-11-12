# COMPONENTS.md — Component Registry

> ⚠️ **MANDATORY FOR AI AGENTS:** CHECK THIS REGISTRY BEFORE CREATING ANY NEW COMPONENT.  
> If a component exists → reuse it. If not found → create it and register it here.

**Status values:** `stable` | `in-progress` | `deprecated` | `needs-review`

---

## 1. Modals & Drawers

| Component | Path | Props / Purpose | Status | Updated |
| :--- | :--- | :--- | :--- | :--- |
| `Modal` | `src/shared/ui/Modal.tsx` | `isOpen`, `onClose`, `title`, `children` — Base centered dialog | stable | 2026-10-09 |
| `SpringSheet` | `src/shared/ui/SpringSheet.tsx` | Bottom drawer with swipe-down dismiss and spring physics | stable | 2026-10-09 |
| `WirelessRelayModal` | `src/features/presenter/components/relay/WirelessRelayModal.tsx` | `isOpen`, `onClose`, `initialTab` — Apple HIG 2-column modal for presentation cast & AirDeck | stable | 2026-10-27 |
| `WirelessRelaySidebar` | `src/features/presenter/components/relay/WirelessRelaySidebar.tsx` | `activeTab`, `setActiveTab` — Left navigation sidebar for AirDeck modal | stable | 2026-10-27 |
| `DeckCastTab` | `src/features/presenter/components/relay/DeckCastTab.tsx` | Native presentation casting tab with privacy mode and slide navigation | stable | 2026-10-27 |

---

## 2. Buttons & Inputs

| Component | Path | Props / Purpose | Status | Updated |
| :--- | :--- | :--- | :--- | :--- |
| `Button` | `src/shared/ui/Button.tsx` | `variant`, `size`, `isLoading`, `leftIcon`, `children` | stable | 2026-10-09 |
| `Input` | `src/shared/ui/Input.tsx` | `label`, `error`, `icon`, `value`, `onChange` | stable | 2026-10-09 |
| `SortDropdown` | `src/shared/ui/SortDropdown.tsx` | `options`, `value`, `onChange` — Tactile sort selector | stable | 2026-10-09 |

---

## 3. Feedback & Status Badges

| Component | Path | Props / Purpose | Status | Updated |
| :--- | :--- | :--- | :--- | :--- |
| `Badge` | `src/shared/ui/Badge.tsx` | `variant` (`success`, `warning`, `danger`, `info`) | stable | 2026-10-09 |
| `Skeleton` | `src/shared/ui/Skeleton.tsx` | Content placeholder loading pulse | stable | 2026-10-09 |

| `Card` | `src/shared/ui/Card.tsx` | Карточка контента с дизайн-токенами скруглений и бордеров | stable | 2026-10-09 |
| `ConfirmDialog` | `src/shared/ui/ConfirmDialog.tsx` | Auto-registered component | stable | 2026-10-25 |
| `ContextMenu` | `src/shared/ui/ContextMenu.tsx` | Auto-registered component | stable | 2026-10-25 |
| `DropdownSelector` | `src/shared/ui/DropdownSelector.tsx` | Auto-registered component | stable | 2026-10-25 |
| `EmptyState` | `src/shared/ui/EmptyState.tsx` | Auto-registered component | stable | 2026-10-25 |
| `ErrorBoundary` | `src/shared/ui/ErrorBoundary.tsx` | Auto-registered component | stable | 2026-10-25 |
| `IconButton` | `src/shared/ui/IconButton.tsx` | Auto-registered component | stable | 2026-10-25 |
| `Kbd` | `src/shared/ui/Kbd.tsx` | Auto-registered component | stable | 2026-10-25 |
| `NavigationSelectorCard` | `src/shared/ui/NavigationSelectorCard.tsx` | Auto-registered component | stable | 2026-10-25 |
| `PinInput` | `src/shared/ui/PinInput.tsx` | Auto-registered component | stable | 2026-10-25 |
| `SearchInput` | `src/shared/ui/SearchInput.tsx` | Auto-registered component | stable | 2026-10-25 |
| `SegmentedControl` | `src/shared/ui/SegmentedControl.tsx` | Auto-registered component | stable | 2026-10-25 |
| `Separator` | `src/shared/ui/Separator.tsx` | Auto-registered component | stable | 2026-10-25 |
| `Slider` | `src/shared/ui/Slider.tsx` | Auto-registered component | stable | 2026-10-25 |
| `Switch` | `src/shared/ui/Switch.tsx` | Auto-registered component | stable | 2026-10-25 |
| `Tooltip` | `src/shared/ui/Tooltip.tsx` | Auto-registered component | stable | 2026-10-25 |
| `TranslationPicker` | `src/shared/ui/TranslationPicker.tsx` | Auto-registered component | stable | 2026-10-25 |
| `ConfirmModal` | `src/shared/ui/modals/ConfirmModal.tsx` | Auto-registered component | stable | 2026-10-25 |
| `PromptModal` | `src/shared/ui/modals/PromptModal.tsx` | Auto-registered component | stable | 2026-10-25 |
