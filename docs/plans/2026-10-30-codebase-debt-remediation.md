# Ликвидация архитектурного и технического долга deck.ce — Implementation Plan

> **Статус:** COMPLETED  
> **Стек:** React 19, TypeScript 5.9, Vite 7, Vitest, Dexie.js, Zustand, Jotai, Tailwind CSS v4, Electron  
> **Связанные ADR:** [ADR D-04](.planning/decisions/D-04-component-size-and-decomposition-doctrine.md), [ADR D-02](.planning/decisions/D-02-security-antipatterns-gate.md)  
> **Оценка Diff Budget:** ~600-800 строк кода (декомпозиция и фиксы по фазам)  

### Цель и Архитектура
* **Цель:** Устранить критические риски рантайма (Rules of Hooks), ликвидировать все 8 циклических зависимостей, декомпозировать God-компонент `SlideTimeline.tsx` до стандарта ADR D-04 (<300 строк чистой верстки), исправить нарушения дизайн-системы и обеспечить 100% прохождение всех проверочных гейтов харнесса с 0 ошибок.
* **Архитектурный подход:** 
  1. Безопасность хуков: изоляция рендерера в `InlineTextEditor` без ранних выходов перед хуками.
  2. Разрыв циклов через экстракцию общих типов в `slide.ts` и инверсию зависимостей в сервисах/сторах.
  3. Декомпозиция `SlideTimeline`: вынос контекстного меню в `TimelineContextMenu.tsx` и логики проектора в `useTimelineLiveSync.ts`.
  4. Замена сырых эмодзи и layout-анимаций в соответствии с дизайн-системой.

### Границы задачи (Scope Lock & Non-Goals)
* ✅ **Входит в скоуп:**
  - Устранение бага вызова хуков в `InlineTextEditor.tsx`.
  - Разрыв всех 8 циклических зависимостей (`npm run check:circular`).
  - Декомпозиция `SlideTimeline.tsx` и вынос `TimelineContextMenu.tsx` + `useTimelineLiveSync.ts`.
  - Устранение мертвого кода и нативного `window.confirm` в `SlideTimeline.tsx`.
  - Устранение сырых эмодзи в JSX (`MediaPoolContextMenu.tsx`, `LogoSettings.tsx`, `Button.test.tsx`).
  - Устранение `font-mono` в `Slider.tsx` в пользу `tabular-nums`.
  - Устранение `LAYOUT_ANIMATION_THRASHING` в `BackgroundCropModal.tsx`.
  - Исправление ESLint warnings по зависимостям хуков в `SlideDisplay.tsx`, `FlipClockStyle.tsx`, `useNavigationState.ts`, etc.
  - Регистрация легитимных тяжелых сервисов в `configs/budget-exceptions.json` и прохождение `check:component-budget`.
  - Зеленый `npm run check` и `npm run build`.
* 🛑 **НЕ входит (Non-Goals):**
  - Полный перепил PPTX парсера или AudioService (только регистрация исключений для тяжелых алгоритмических сервисов).
  - Изменение контрактов базы данных Dexie.
  - Изменение тестов с целью заставить неработающий код пройти.

---

## 🕵️ Adversarial Critic Audit Gate

- [x] Фильтр 1 (Offline & Dexie Integrity): проверен — Dexie транзакции и модели не модифицируются, порядок чтения не меняется.
- [x] Фильтр 2 (Physical & Mathematical Invariants): проверен — таймлайн и расчет кадров/слайдов сохраняют целостность.
- [x] Фильтр 3 (Diff Budget & Component Size): проверен — декомпозиция разбита на атомарные фазы, `SlideTimeline.tsx` сокращен до целевых стандартов.
- [x] Фильтр 4 (Type Safety & noUncheckedIndexedAccess): проверен — типы строго сохраняются, разрыв циклов типизации через выделенный `slide.ts`.
- [x] Фильтр 5 (Race Conditions & Double-Clicks): проверен — сохраняются все флаги драга и блокировки повторных отправок на проектор.
- [x] Фильтр 6 (Anti-Test Tampering): проверен — существующие бизнес-тесты не модифицируются (кроме замены эмодзи в unit-тесте кнопки).
- [x] Фильтр 7 (UI & Localization — no emojis, standard icons): проверен — все эмодзи заменяются на векторные `lucide-react`, тексты берутся из i18n.

**Вердикт Сомневающегося Агента:** APPROVED

---

## Фазы реализации

### Фаза 1: Устранение критических багов React Hooks и ESLint
- [x] **Шаг 1.1:** Исправить `InlineTextEditor.tsx`: вынести хуки наверх или выделить `InlineTextEditorContent`, устранить предупреждение `rules-of-hooks`.
- [x] **Шаг 1.2:** Исправить ESLint warnings в `SlideDisplay.tsx`: мемоизировать `content`, добавить зависимость `appMode`.
- [x] **Шаг 1.3:** Исправить warnings в `SlideBackground.tsx`, `FlipClockStyle.tsx`, `VerseList.tsx`, `useNavigationState.ts`, `CanvasItemView.tsx`, `useLogoUrl.ts`, `useMediaUrl.ts`, `useTextFit.ts`.

### Фаза 2: Ликвидация циклических зависимостей (`npm run check:circular`)
- [x] **Шаг 2.1:** Разорвать цикл `presentation.ts` <-> `template.ts` (создать `src/core/types/slide.ts` для базовых перечислений `SlideType` / `IBaseSlide`).
- [x] **Шаг 2.2:** Разорвать цикл `StorageOptimizationService.ts` <-> `MediaRestorationService.ts`.
- [x] **Шаг 2.3:** Разорвать цикл `ipcService.ts` -> `RelayTransmitterService.ts` -> `relayStore.ts` -> `presenterService.ts`.
- [x] **Шаг 2.4:** Разорвать цикл `presentationStore.ts` -> `createSlideOperationsSlice.ts` -> `hymnLibraryService.ts` -> `hymnThemeService.ts` -> `remoteSyncService.ts`.
- [x] **Шаг 2.5:** Убедиться, что `npm run check:circular` завершается с кодом 0.

### Фаза 3: Декомпозиция `SlideTimeline.tsx` (<500 строк hard ceiling, ~280 чистых строк)
- [x] **Шаг 3.1:** Создать `src/features/presenter/components/timeline/TimelineContextMenu.tsx` и вынести всю логику контекстного меню (250+ строк).
- [x] **Шаг 3.2:** Создать `src/features/presenter/components/timeline/hooks/useTimelineLiveSync.ts` и перенести эффекты синхронизации с проектором и слушатель `projector-ready` (120+ строк).
- [x] **Шаг 3.3:** Устранить мертвое ветвление `activePresentation : activePresentation` и перенести действия в хук синхронизации.
- [x] **Шаг 3.4:** Отрефакторить `SlideTimeline.tsx` до чистого компактного контейнера.

### Фаза 4: Дизайн-система и соблюдение инвариантов
- [x] **Шаг 4.1:** Заменить сырые эмодзи в `MediaPoolContextMenu.tsx` ("✕" -> `X`), `LogoSettings.tsx` ("📁" -> `Folder`), `Button.test.tsx` ("★" -> `Star`).
- [x] **Шаг 4.2:** В `Slider.tsx` заменить `font-mono` на `font-sans tabular-nums`.
- [x] **Шаг 4.3:** В `BackgroundCropModal.tsx` устранить `LAYOUT_ANIMATION_THRASHING` (анимация через transform/opacity).
- [x] **Шаг 4.4:** Прогнать `node scripts/verify-design-system.mjs`.

### Фаза 5: Бюджет компонентов и исключения
- [x] **Шаг 5.1:** Проверить превышения в `scripts/verify-component-budget.mjs`.
- [x] **Шаг 5.2:** Зарегистрировать легитимные тяжелые алгоритмические файлы в `configs/budget-exceptions.json` с фиксацией причин в соответствии с ADR D-04.
- [x] **Шаг 5.3:** Добиться кода выхода 0 для `npm run check:component-budget`.

### Фаза 6: Финальная детерминированная верификация (Quality Gate)
- [x] **Шаг 6.1:** `npm run check:circular` — 0 ошибок.
- [x] **Шаг 6.2:** `npm run check:hygiene` — 0 ошибок.
- [x] **Шаг 6.3:** `npm run check:memo` — 0 ошибок.
- [x] **Шаг 6.4:** `npm run check:security:antipatterns` — 0 ошибок.
- [x] **Шаг 6.5:** `npm run check:debug-leftovers` — 0 ошибок.
- [x] **Шаг 6.6:** `npm run check:design` — 0 ошибок.
- [x] **Шаг 6.7:** `npm run check:component-budget` — 0 ошибок.
- [x] **Шаг 6.8:** `npm run check` (tsc + eslint + vitest) — 0 ошибок, 0 warnings.
- [x] **Шаг 6.9:** `npm run build:renderer` — чистая сборка production-бандла.
