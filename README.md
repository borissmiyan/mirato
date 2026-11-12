<p align="center">
  <img src="public/favicon.png" width="108" height="108" alt="Mirato Logo" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />
</p>

<h1 align="center">Mirato</h1>

<p align="center">
  <strong>Next-generation presentation studio: Scripture projection, church hymnals, vector canvas slide editor, and wireless stage prompter for churches and media teams.</strong><br>
  <em>(Formerly known as Ekklesienter)</em>
</p>

<p align="center">
  <strong>Language / Язык / Sprache:</strong><br>
  <a href="README.md"><strong>English</strong></a> •
  <a href="README.ru.md">Русский</a> •
  <a href="README.de.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://github.com/borissmiyan/mirato/releases/latest"><img src="https://img.shields.io/badge/Release-v2.3.0-amber.svg?style=flat-square&color=f59e0b" alt="Latest Release" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Platform-macOS%20|%20Windows%20|%20Linux-blue.svg?style=flat-square" alt="Platforms" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Architecture-Apple%20Silicon%20|%20Intel%20|%20x64-stone.svg?style=flat-square" alt="Arch" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square" alt="React 19" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-emerald.svg?style=flat-square" alt="License: GPL-3.0" /></a>
  <a href="https://discord.gg/mirato"><img src="https://img.shields.io/badge/Discord-Community-5865F2.svg?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
</p>

---

## 🌟 About Mirato

**Mirato** was crafted with a singular mission: to provide churches, worship teams, and live events with a rock-solid, lightning-fast, and beautiful presentation tool that eliminates technical disruptions during services.

It combines the capabilities of expensive proprietary broadcast software (such as ProPresenter) with the intuitive simplicity of modern vector tools and complete independence from cloud services during live production.

> [!TIP]
> **Mirato is 100% offline-first.** Bible translations, hymnals, media backgrounds, and presentations are stored locally on your machine via IndexedDB. The software operates with absolute stability even if the internet connection goes completely down in the sanctuary.

---

## ⚡ Key Capabilities

### 📖 Instant Scripture Search (Sub-5ms)
- **Fuzzy Reference Parser:** Type `Jn 3 16`, `Rom 8:28`, or `Ps 23` — the verse is instantly parsed and previewed.
- **Parallel Translations:** Display two translations side-by-side (e.g., KJV + ESV or Synodal + NIV) with synchronized verse numbers.
- **Dynamic Auto-Fit:** Scripture passages automatically calculate typography size, line-height, and margins to ensure no word ever overflows off-screen.

### 📱 Mobile Web Remote Controller
- **Zero App Installation:** Anyone with permission can scan a QR code on any iPhone, Android phone, or tablet over local Wi-Fi.
- **Live Slide & Bible Control:** Operators, pastors, or speakers can flip slides, view live previews, or search and project Bible verses directly from their mobile screen.
- **Live Broadcast Overrides:** Toggle Blackout (`B`), Whiteout (`W`), or church Logo (`L`) with a single tap from anywhere in the hall.
- **PIN-Protected Security:** Customizable PIN authentication prevents unauthorized access to the projection stream.

### 🎵 Church Hymnals & Songbooks
- **Built-in Hymnal Database:** Comprehensive collections with fast lookup by song number, title, or lyric text.
- **Structured Stanzas:** Automatic separation into verses, choruses, and bridges with one-click slide creation.
- **Worship Themes:** Pre-designed visual templates tailored specifically for worship song display.

### 📐 Vector Canvas & Slide Editor
- **Precision Canvas Engine:** Freely position text blocks, shapes (rectangles, circles, lines), images, video backgrounds, and vector paths with the Pen tool.
- **Smart Magnetic Guides:** Automatic alignment snapping to slide centers and neighboring objects.
- **Live Aspect Ratio Portal:** Switch canvas ratios (16:9, 16:10, 4:3, 9:16) via an overlay portal rendered above all panels.

### 🖥️ Dual-Window Architecture & Presenter Workflow
- **Independent Projector Process:** Secondary screen output runs in a dedicated window, leaving the operator with 100% cursor freedom without losing window focus.
- **Live Editing on the Fly:** Modify slide content, fix typos, or add new slides during a live service without interrupting the projector display.

### 🚨 Direct Broadcast Overrides
- Dedicated single-key hotkeys without frantic mouse searching:
  - `B` — **Blackout** (smooth blackout transition).
  - `W` — **Whiteout** (solid white screen transition).
  - `L` — **Logo** (display church emblem / logo overlay).
  - `Esc` — Close projector window or cancel current selection.

---

## 📊 Comparison: Mirato vs PowerPoint vs ProPresenter

| Feature | 👑 Mirato 2.3 | 📄 MS PowerPoint | 🎥 ProPresenter |
| :--- | :---: | :---: | :---: |
| **Dual-Screen & Cursor Freedom** | Independent window, operator has full mouse freedom | Captures mouse focus; clicking outside drops slideshow | Complex multi-panel UI, heavy GPU overhead |
| **Live Editing During Service** | Instant real-time updates without leaving presentation | Impossible without stopping the slideshow | Supported, but requires opening a heavy modal editor |
| **Instant Scripture Search** | Sub-5ms (`Jn 3:16`), parallel translations, auto-fit | None (manual copy-paste from browser) | Available, but modern translations require paid modules |
| **Mobile Web Remote** | Built-in via local Wi-Fi & QR code (no app needed, with Bible search) | Basic hardware clicker or PowerPoint mobile app (Office 365 required) | Requires separate ProRemote app with manual port configuration |
| **Stage Display (StageView)** | Built-in stage monitor (clock, countdown timer, mini slides) | None | Requires separate screen configuration module |
| **Church Hymnals & Songbooks** | Built-in hymnal library with instant lookup by number | None (each song requires manual slides) | Basic text import / CCLI SongSelect subscription |
| **Broadcast Overrides (Blackout/Logo)** | Direct hotkeys (`B`, `W`, `L`) | Key `B` only (black screen) | Configurable |
| **License & Pricing** | **Free for Churches (GPL-3.0 / Dual-License)** | Microsoft 365 Subscription | From \$399 + annual upgrade maintenance |

---

## ⌨️ Complete Keyboard Shortcuts (In-App Cheatsheet)

The following is the complete and exact list of keyboard shortcuts implemented in Mirato (matching the in-app settings panel):

### 🎬 Navigation & Playback

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `→` / `↓` / `Space` | **Next Slide** | Move to the next slide in sequence |
| `←` / `↑` | **Previous Slide** | Return to the previous slide |
| `Enter` | **Go Live** | Project currently selected slide to the live screen |
| `Space` | **Play / Pause Media** | Toggle active live background video playback (outside canvas) |
| `Esc` | **Close Projector** | Close projection window / cancel active editing mode |
| `H` | **Sync Preview to Live** | Synchronize preview viewport with current live slide |
| `⌘F` (Mac) / `Ctrl+F` (Win) | **Search** | Open global search palette |
| `⌘H` (Mac) / `Ctrl+H` (Win) | **History** | Open recent slide presentation history |

### 🚨 Live Broadcast Overrides

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `B` | **Blackout** | Smoothly fade the projector to solid black |
| `W` | **Whiteout** | Fade the projector to solid white |
| `L` | **Logo Mode** | Display church logo on live screen |

### 📂 Slide & Presentation Management

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `⌘S` (Mac) / `Ctrl+S` (Win) | **Save** | Save active service plan or presentation file |
| `⌘Z` (Mac) / `Ctrl+Z` (Win) | **Undo** | Undo last user action |
| `⌘Shift+Z` / `Ctrl+Y` | **Redo** | Redo previously undone action |
| `⌘D` (Mac) / `Ctrl+D` (Win) | **Duplicate** | Duplicate selected slide or canvas element |
| `Delete` / `Backspace` | **Delete** | Remove selected slide or canvas element |
| `⌘[` / `⌘]` | **Slide Order** | Move slide backward / forward in timeline |

### 🎨 Canvas Editor

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `V` | **Select Tool** | Select and move canvas elements |
| `H` | **Hand Tool** | Pan canvas viewport |
| `P` | **Vector Pen** | Draw custom vector paths and shapes |
| `T` | **Add Text** | Create a new text block |
| `R` | **Add Rectangle** | Draw a rectangle shape |
| `O` | **Add Circle** | Draw an ellipse / circle |
| `L` | **Add Line** | Create a vector line stroke |
| `I` | **EyeDropper** | Sample color directly from canvas elements |
| `Space + Drag` | **Pan Canvas** | Quick mouse pan while holding spacebar |
| `↑` `↓` `←` `→` (Arrows) | **Nudge Element** | Move selected element by 1% step |
| `Shift + Arrows` | **Fast Nudge** | Move selected element by 5% step |
| `⌘+` / `⌘-` | **Zoom In / Out** | Zoom canvas viewport |
| `⌘0` / `Shift+1` | **Reset Zoom** | Fit slide perfectly to available canvas screen |
| `Shift+2` | **Zoom to Selection** | Frame viewport around active selection |
| `⌘1` | **Zoom 100%** | View canvas at 1:1 pixel scale |
| `⌘C` / `⌘V` | **Copy / Paste** | Copy and paste elements |
| `⌘Alt+C` / `⌘Alt+V` | **Copy / Paste Style** | Transfer typography and styling properties |
| `⌘G` / `⌘Shift+G` | **Group / Ungroup** | Group or ungroup canvas elements |
| `⌘Shift+L` | **Lock / Unlock** | Lock element position and properties |
| `⌘Shift+H` | **Hide / Show** | Toggle element visibility |
| `⌘]` / `⌘[` | **Layer Z-Index** | Bring to front / send to back |
| `Shift+H` / `Shift+V` | **Flip** | Flip selection horizontally / vertically |
| `Shift+R` | **Toggle Rulers** | Show or hide precision pixel rulers |
| `Alt / ⌥ (hold)` | **Measure Distances** | Display live distance guides to adjacent objects |
| `⌘/` or `⌘K` | **Quick Actions** | Open canvas quick command menu |

### 📖 Scripture Mode

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `⌘Shift+C` (Mac) / `Ctrl+Shift+C` (Win) | **Copy Verse** | Copy active verse text with citation and translation to clipboard |

---

## 📥 Download Mirato (v2.3.0)

Pre-built binaries for all major desktop platforms are available in the [v2.3.0 Release](https://github.com/borissmiyan/mirato/releases/tag/v2.3.0):

| Platform | Architecture | Package | Description |
| :--- | :--- | :--- | :--- |
| **macOS** | **Apple Silicon (M1 / M2 / M3 / M4)** | `.dmg` (207 MB) | [Download for Mac (Apple Silicon)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-macOS12+-arm64.dmg) |
| **macOS** | **Intel (x86_64)** | `.dmg` (213 MB) | [Download for Mac (Intel)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-macOS12+-x64.dmg) |
| **Windows** | **64-bit (x64)** | `.exe` (175 MB) | [Download for Windows 10/11](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-Setup-2.3.0.exe) |
| **Linux** | **64-bit (x86_64)** | `.AppImage` (211 MB) | [Download AppImage (x86_64)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-x86_64.AppImage) |
| **Linux** | **ARM64 (aarch64)** | `.AppImage` (212 MB) | [Download AppImage (arm64)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-arm64.AppImage) |

---

## 🍎 macOS First-Launch Guide (`xattr` Command)

Because Mirato is an open-source project distributed without an Apple Developer paid subscription ($99/year), macOS **Gatekeeper** may display a dialog on first launch:

> *"Mirato is damaged and can't be opened. You should move it to the Trash."*

### Unlock in 10 seconds:
1. Drag **Mirato.app** from the mounted DMG into your **`/Applications`** folder.
2. Open the standard macOS **Terminal** (`Cmd + Space` → type *Terminal*).
3. Copy and run the following command:

```bash
xattr -cr /Applications/Mirato.app
```

*(If prompted for administrator privileges: `sudo xattr -rd com.apple.quarantine /Applications/Mirato.app`)*

4. Open Mirato again. It will launch instantly without any further warnings!

> [!NOTE]
> A companion text file containing this exact command is also included directly inside the mounted DMG image (`Команда_для_Терминала.txt`).

---

## 🛠️ Technology Stack

- **Desktop Framework:** [Electron](https://www.electronjs.org/) with dual-process controller/projector isolation.
- **Frontend UI:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS v4](https://tailwindcss.com/).
- **State Management:** [Jotai](https://jotai.org/) (atomic UI state) + [Zustand](https://zustand-demo.pmnd.rs/) (presentation slices).
- **Offline Storage:** [Dexie.js](https://dexie.org/) (IndexedDB) with schema migration.
- **Relay & Prompter:** Embedded HTTP & WebSocket server for sub-millisecond mobile and AirDeck syncing.
- **Media Pipeline:** Embedded [FFmpeg WebAssembly](https://ffmpegwasm.netlify.app/) for background video thumbnailing and caching.

---

## 👨‍💻 Building from Source

```bash
# 1. Clone the repository
git clone https://github.com/borissmiyan/mirato.git
cd mirato

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

# 4. Run automated checks & hermetic test suite (588 tests)
npm run check:design
npm run check:hygiene
npm run check:esm
npx vitest run

# 5. Build production packages
npm run build:mac-modern   # macOS Apple Silicon + Intel DMG
npm run build:win          # Windows Setup Installer
npm run build:linux        # Linux AppImage
```

---

## 📄 Licensing & Dual-License Model

Mirato is distributed under a **Dual-Licensing model**:
- **Churches & Community:** 100% free and open-source under the **GNU General Public License v3.0 (GPL-3.0)**. Copyleft ensures no commercial entity can steal or close this codebase.
- **Commercial Dual-Licensing:** If you wish to extract, embed, or reuse components of Mirato (such as the Presentation Canvas Engine) into proprietary commercial software without GPL copyleft obligations, commercial licenses are available directly from the copyright holder: **Boris Smiyan** ([borissmiyan@gmail.com](mailto:borissmiyan@gmail.com)).

---

## 🤝 Community & Support

- 💬 **Discord Community:** [discord.gg/mirato](https://discord.gg/mirato)
- 🐛 **Issue Tracker:** [GitHub Issues](https://github.com/borissmiyan/mirato/issues)
- 💡 **Discussions & Feedback:** [GitHub Discussions](https://github.com/borissmiyan/mirato/discussions)

---

<p align="center">
  Crafted with care and prayer for churches around the globe. 🤍<br>
  <strong>Mirato © 2026 Boris Smiyan. Licensed under GNU GPL v3 / Dual-License.</strong>
</p>
