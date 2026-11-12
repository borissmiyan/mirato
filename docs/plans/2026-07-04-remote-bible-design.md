# Remote Controller - Bible Integration Design

## 1. Problem Statement
The Bible functionality on the Remote Controller currently fails to load data because WebSocket messages are formatted incorrectly. Furthermore, users cannot apply "working overrides" (Blackout, Logo, Whiteout) while in Bible mode, and returning to the Presentation mode does not automatically resume the presentation.

## 2. Proposed Approaches for Overrides in Bible Mode
- **Option A (Recommended): Shared Overrides Bar.** Extract the Media/Overrides controls (currently in `RemoteSlides`) into a standalone component (`RemoteOverrides`). Place it above the `BibleBrowser` in Bible mode, and keep it in `RemoteSlides` for Presentation mode. This keeps the UI familiar and accessible.
- **Option B: Footer Integration.** Move the Blackout/Whiteout/Logo buttons to the global `RemoteFooter`. This ensures they are always accessible but might crowd the bottom navigation bar.

## 3. Detailed Design

### Fixing Bible Data Loading
- **Root Cause:** `useRemoteSocket.ts` sends `{ type: 'COMMAND', command: 'GET_TRANSLATIONS', payload: {...} }` but the PC client (`useGlobalShortcuts.ts`) expects `command === 'BIBLE_QUERY'` and `payload.type === 'GET_TRANSLATIONS'`.
- **Fix:** Update `handleBibleQuery` in `useRemoteSocket.ts` to wrap the query correctly: `sendCommand('BIBLE_QUERY', { type, ...payload, requestId })`.

### Enhancing Bible Mode with Overrides
- Pass `slideState`, `onOverrideToggle`, and `activeLogoUrl` down to `BibleBrowser` (or wrap it in a container).
- Add the Overrides UI (Black, Logo, White) to the top or bottom of `BibleBrowser`.

### Seamless Mode Switching
- **Switch to Bible Mode:** When the user taps "Bible" in the remote footer, we can optionally send a command to switch the PC app mode to `scripture` (or just wait for them to project a verse).
- **Switch back to Slides Mode:** When the user taps "Slides" in the remote footer, the remote will send a `RESUME_PRESENTATION` (or `PROJECTOR_START` with the `liveSlideId`) command. The PC client will catch this and re-project the current active slide, guaranteeing a smooth return exactly where they left off.

## User Review Required
1. Do you prefer **Option A** (Overrides at the top/bottom of the Bible Browser) or **Option B** (Overrides globally in the Footer)?
2. When switching to Bible mode on the remote, should it immediately open the Bible mode on the PC screen (without projecting a verse yet), or just let the remote browse and only project when a verse is selected?
