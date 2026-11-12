# Project Context & Architecture Index

> **Project Name:** Deck.CE (ekklesienter)  
> **Last Updated:** 2026-10-30  
> **Status:** Active Development / Production-Grade Desktop App

---

## 📌 Project Overview & Purpose

Deck.CE — профессиональная платформа для церквей и конференций, предназначенная для вывода текстов Священного Писания, богослужебных гимнов, медиа-слайдов и беспроводной трансляции на проекторы и сценические мониторы.

Приложение спроектировано как полностью автономное (offline-first) настольное решение с поддержкой мультиязычности, мультиоконности (Контроллер, Проектор, Сценический монитор) и беспроводного управления по локальной сети через мобильный пульт и спикерский ноутбук.

---

## 🏛 Architecture & Tech Stack

- **Runtime / Desktop:** Electron (Multi-window architecture: Controller, Projector, Stage)
- **Frontend / Client:** React 19 / Vite / TypeScript / Tailwind CSS
- **State Management:** Zustand (Presentation, Hymns, Overrides, Relay) / Jotai
- **Persistence & Offline:** Dexie.js (IndexedDB) / SQLite (MyBible .sqlite3) / Local Filesystem
- **Networking & Relay:** Express (HTTP media proxy) / WebSocket Server (Remote & Relay control) / WebRTC (Deck Cast & Screen Sharing)
- **Testing & Verification:** Vitest / ai-yak-harness
- **Design System:** Lucide React icons, Apple HIG tokens in `DESIGN-AI.md`

---

## 🗄 Core Data Entities & Relations

```text
ServiceFile (id, name, date, masterPresentationId, items)
   └── PresentationFile (id, name, slides, audioScopes, updatedAt)
          ├── Slide (id, type: text | bible | hymn | media | video | timer, content, background, layers)
          └── AudioScope (id, presentationId, startSlideId, endSlideId, audioPath, loop)

BibleTranslation (id, name, language, books)
   └── Verse (id, translationId, bookId, chapter, verseNumber, text, words[])

Hymnal (id, title, language, hymns[])
   └── HymnTheme (id, background, typography, transitions)
```

---

## 📑 Architecture Decisions (ADR Index)

| ID | Title | Status | Date | Key Invariant / Outcome |
| :--- | :--- | :--- | :--- | :--- |
| [D-01](./decisions/D-01-initial-architecture.md) | Initial Architecture & Core Invariants | Accepted | 2026-10-09 | Strict typing, offline resilience, and zero unmocked network tests |
| [D-02](./decisions/D-02-security-antipatterns-gate.md) | Security Anti-Patterns Gate | Accepted | 2026-10-15 | Automated static analysis gate |
| [D-04](./decisions/D-04-component-size-and-decomposition-doctrine.md) | Component Size & Decomposition Doctrine | Accepted | 2026-10-15 | 150-250 lines golden standard, 500 line hard limit |
| [D-05](./decisions/D-05-wireless-transmitter-receiver.md) | Wireless Transmitter & Receiver Architecture | Accepted | 2026-10-24 | WebRTC + WebSocket LAN control |
| [D-06](./decisions/D-06-native-deck-cast-and-airrelay-redesign.md) | Native Deck Cast & AirRelay Redesign | Accepted | 2026-10-27 | 4K vector native slide casting |
| [D-07](./decisions/D-07-security-and-async-remediation.md) | Security & Async Remediation | Accepted | 2026-10-30 | PIN leak removal, WebSocket brute force guard, pending Promise fix, Dexie O(N) indexing |
| [D-08](./decisions/D-08-video-proxy-and-heavyweight-performance-pipeline.md) | Video Proxy Architecture & Heavyweight Media Performance | Accepted | 2026-11-04 | 540p proxy pipeline, canvas resolution selector, pre-baked .ektp thumbnails, GPU hardware video decode |
| [D-09](./decisions/D-09-cold-start-zero-black-screen-optimization.md) | Cold Start Zero Black Screen Optimization | Accepted | 2026-11-05 | React.lazy for App, 0ms inline splash preloader in index.html, Rollup manualChunks, non-blocking DevTools |
| [D-10](./decisions/D-10-advanced-vector-shapes-and-presets.md) | Advanced Vector Shapes Engine & Presets System | Accepted | 2026-11-05 | Figma-grade Star, Polygon (Triangle), Segmented Donut, unit space [0, 1] clipping, Shift+Click Presets, Selective Baking |
| [D-11](./decisions/D-11-cra-inspired-marketing-website.md) | Cra-Inspired Marketing & Presentation Portal | Accepted | 2026-11-11 | Minimalist Apple craftsmanship, standalone landing.html entry, 60+ feature wall, release timeline, and privacy manifesto |

---

## 🛑 Non-Goals & Boundaries

- Требование постоянного подключения к облаку (приложение обязано на 100% работать автономно без интернета).
- Облачная авторизация или регистрация пользователей.
- Замена нативного проекционного движка браузерными онлайн-сервисами.
