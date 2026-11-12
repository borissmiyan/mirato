<p align="center">
  <img src="public/favicon.png" width="108" height="108" alt="Mirato Logo" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />
</p>

<h1 align="center">Mirato</h1>

<p align="center">
  <strong>Next-generation presentation studio, scripture projection, and wireless stage prompter for churches and live events.</strong><br>
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
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square" alt="License" /></a>
  <a href="https://discord.gg/mirato"><img src="https://img.shields.io/badge/Discord-Community-5865F2.svg?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
</p>

---

## 🌟 About Mirato

**Mirato** was crafted with a singular mission: to provide churches, worship teams, and live events with a rock-solid, lightning-fast, and beautiful presentation tool that eliminates technical disruptions during services.

It combines the capabilities of expensive proprietary broadcast software (such as ProPresenter) with the intuitive simplicity of modern design tools and complete independence from cloud services during live production.

> [!TIP]
> **Mirato is 100% offline-first.** Bible translations, hymnals, media backgrounds, and presentations are stored locally on your machine via IndexedDB and local files. The software operates with absolute stability even if the internet connection goes completely down in the sanctuary.

---

## ⚡ Key Capabilities

### 📖 Instant Scripture Search (Sub-5ms)
- **Fuzzy Reference Parser:** Type `Jn 3 16`, `Rom 8:28`, or `Ps 23` — the verse is instantly parsed and previewed.
- **Parallel Translations:** Display two translations side-by-side (e.g., KJV + ESV or Synodal + NIV) with synchronized verse numbers.
- **Dynamic Auto-Fit:** Scripture passages automatically calculate typography size, line-height, and margins to ensure no word ever overflows off-screen.

### 📱 Mobile Web Remote Controller
- **Zero App Installation:** Anyone with permission can scan a QR code on any iPhone, Android phone, or tablet over local Wi-Fi.
- **Live Slide & Bible Control:** Operators, pastors, or speakers can flip slides, view live previews, or browse and display Bible verses directly from their mobile screen.
- **Emergency Overlays:** Trigger Blackout (`F1`) or Clear Text (`F2`) with a single tap from anywhere in the hall.
- **PIN-Protected Security:** Customizable PIN authentication prevents unauthorized access to the projection stream.

### 🎵 Church Hymnals & Songbooks
- **Built-in Hymnal Database:** Comprehensive collections with fast lookup by song number, title, or lyric text.
- **Structured Stanzas:** Automatic separation into verses, choruses, and bridges with one-click slide creation.
- **Worship Themes:** Pre-designed visual templates tailored specifically for worship song display.

### 📐 Figma-Grade Vector Canvas
- **Precision Vector Engine:** Freely position text blocks, shapes, strokes, images, and video backgrounds.
- **Smart Magnetic Guides:** Automatic alignment snapping to slide centers and neighboring objects.
- **Live Aspect Ratio Portal:** Switch canvas ratios (16:9, 16:10, 4:3, 9:16) via an overlay portal rendered above all panels.

### 🖥️ Dual-Window Architecture & Presenter Workflow
- **Independent Projector Process:** Secondary screen output runs in a dedicated window, leaving the operator with 100% cursor freedom without losing window focus.
- **Live Editing on the Fly:** Modify slide content, fix typos, or add new slides during a live service without interrupting the projector display.

### 🚨 Operator Panic Keys
- No frantic mouse searching during unplanned pauses or stage interruptions:
  - `F1` — **Blackout** (smooth blackout transition).
  - `F2` — **Clear Text** (hides text layers while keeping background video/image playing).
  - `Esc` — Reset overlays / restore normal presentation.

---

## 📊 Comparison: Mirato vs PowerPoint vs ProPresenter

| Feature | 👑 Mirato 2.3 | 📄 MS PowerPoint | 🎥 ProPresenter |
| :--- | :---: | :---: | :---: |
| **Dual-Screen & Cursor Freedom** | Independent window, operator has full mouse freedom | Captures mouse focus; clicking outside drops slideshow | Complex multi-panel UI, heavy GPU overhead |
| **Live Editing During Service** | Instant real-time updates without leaving presentation | Impossible without stopping the slideshow | Supported, but requires opening a heavy modal editor |
| **Instant Scripture Search** | Sub-5ms (`Jn 3:16`), parallel translations, auto-fit | None (manual copy-paste from browser) | Available, but modern translations require paid modules |
| **Mobile Web Remote** | Built-in via local Wi-Fi & QR code (no app needed, with Bible search) | Basic hardware clicker or PowerPoint mobile app (Office 365 required) | Requires separate ProRemote app with manual port configuration |
| **Stage Prompter (AirDeck)** | Built-in wireless prompter for singers & speakers | None | Requires separate paid iOS app |
| **Church Hymnals & Songbooks** | Built-in hymnal library with search by song number | None (each song requires manual slides) | Basic text import / CCLI SongSelect subscription |
| **Panic Keys (F1 / F2)** | Dedicated blackout & clear text hotkeys | Key `B` only (black screen) | Configurable |
| **License & Pricing** | **100% Free & Open Source (MIT)** | Microsoft 365 Subscription | From \$399 + annual upgrade maintenance |

---

## 📥 Download Mirato (v2.3.0)

Pre-built binaries for all major desktop platforms are available in the [v2.3.0 Release](https://github.com/borissmiyan/mirato/releases/tag/v2.3.0):

| Platform | Architecture | Package | Description |
| :--- | :--- | :--- | :--- |
| **macOS** | **Apple Silicon (M1 / M2 / M3 / M4)** | `.dmg` (207 MB) | [Download](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-macOS12+-arm64.dmg) — For modern Apple Silicon Macs |
| **macOS** | **Intel (x86_64)** | `.dmg` (213 MB) | [Download](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-macOS12+-x64.dmg) — For Intel-based Macs (macOS 12 Monterey+) |
| **Windows** | **64-bit (x64)** | `.exe` (175 MB) | [Download](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-Setup-2.3.0.exe) — Installer for Windows 10 & 11 |
| **Linux** | **64-bit (x86_64)** | `.AppImage` (211 MB) | [Download](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-x86_64.AppImage) — Portable AppImage for Ubuntu, Fedora, Debian |
| **Linux** | **ARM64 (aarch64)** | `.AppImage` (212 MB) | [Download](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-arm64.AppImage) — For ARM-based Linux systems |

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

## ⌨️ Operator Shortcuts (Cheatsheet)

| Shortcut | Action |
| :--- | :--- |
| `Space` / `→` / `↓` | Next slide / Play-Pause media |
| `←` / `↑` | Previous slide |
| `F1` | **Blackout** — smooth blackout overlay |
| `F2` | **Clear Text** — hide text layers, keep background playing |
| `Esc` | Clear overlay / reset selection |
| `⌘K` (Mac) / `Ctrl+K` (Win) | Quick Action Palette |
| `⌘D` (Mac) / `Ctrl+D` (Win) | Duplicate slide or canvas element |
| `⌘+` / `⌘-` / `⌘0` | Canvas zoom in / out / reset to 100% |
| `V` | Selection tool |
| `H` | Hand tool (Canvas pan) |
| `P` | Vector Pen tool |
| `T` / `R` / `O` / `L` | Create Text / Rectangle / Circle / Line on canvas |
| `I` | Color EyeDropper |

---

## 🛠️ Technology Stack

Mirato is engineered with modern web and desktop technologies:

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

## 🤝 Community & Support

- 💬 **Discord Community:** [discord.gg/mirato](https://discord.gg/mirato)
- 🐛 **Issue Tracker:** [GitHub Issues](https://github.com/borissmiyan/mirato/issues)
- 💡 **Discussions & Feedback:** [GitHub Discussions](https://github.com/borissmiyan/mirato/discussions)

---

<p align="center">
  Crafted with care and prayer for churches around the globe. 🤍<br>
  <strong>Mirato © 2026. Released under the MIT License.</strong>
</p>
