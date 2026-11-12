# План оптимизации бандла, производительности таймлайна и декомпозиции сервисов

> **Статус:** COMPLETED  
> **Стек:** React 19, TypeScript 5.9, Vite 7, Electron, Dexie.js, Zustand, Jotai, Tailwind CSS v4, Vitest  
> **Связанные ADR:** [ADR D-04](.planning/decisions/D-04-component-size-and-decomposition-doctrine.md), [ADR D-02](.planning/decisions/D-02-security-antipatterns-gate.md)  
> **Режим:** `/goal` (все задачи завершены, 100% hard gates подтверждены)  

---

### Цель и Задачи
1. **Ликвидировать циклический чанк и оптимизировать бандл:** устранить `Circular chunk: vendor-db -> vendor-react -> vendor-db` в `vite.config.ts`, выделить отдельный `vendor-icons` и уменьшить монолитный чанк `vendor-react` (4.2 МБ).
2. **Ликвидировать холостые ре-рендеры в таймлайне:** перевести слайдовые плашки (`SlideTile.tsx`, `NestedPresentationTile.tsx`), библиотеку (`PresentationLibrary.tsx`, `PresentationContextMenu.tsx`) и оставшиеся модалки (`BackgroundCropModal`, `ConfirmModal`, `PromptModal`, `OrphanAudioScopesModal`) на атомарные селекторы Zustand / `useShallow`.
3. **Обеспечить XSS-санитизацию в результатах поиска:** экранировать `res.highlightedText` через `sanitizeHtml` в `QuickSearchModal.tsx` и `SearchOverlay.tsx`.
4. **Декомпозировать 700-строчный `AudioService.ts`:** вынести вспомогательные подмодули в `src/features/presenter/services/audio/` (`AudioScopeResolver.ts`, `AudioPlaybackController.ts`, `AudioFadeUtils.ts`, `types.ts`), доведя размер до < 500 строк на файл.
5. **Итоговая верификация Hard Gates:** 100% прохождение всех гейтов линтера, типов, гигиены, мемоизации, дизайна и сборки.

---

### 🕵️ Adversarial Critic Audit Gate

- [x] **Фильтр 1 (Offline & Dexie Integrity):** Сплит чанков не нарушает загрузку Dexie в офлайн-режиме, транзакции остаются герметичными.
- [x] **Фильтр 2 (Physical & Mathematical Invariants):** Математика Web Audio API в `AudioService` (fading curves, gain nodes, buffer sample rate) переносится без изменения числовых алгоритмов.
- [x] **Фильтр 3 (Diff Budget & Component Size):** Декомпозиция разбита на управляемые шаги, каждый файл < 500 строк.
- [x] **Фильтр 4 (Type Safety & noUncheckedIndexedAccess):** Строгая типизация параметров аудио-буферов и результатов селекторов.
- [x] **Фильтр 5 (Race Conditions & Double-Clicks):** Сохранение существующих промисов блокировки и мьютексов в сторах.
- [x] **Фильтр 6 (Anti-Test Tampering):** Тесты не модифицируются; подтверждено успешное прохождение всех 124 тест-файлов (368 тестов).
- [x] **Фильтр 7 (UI & Localization):** Отсутствие сырых эмодзи в разметке, соблюдение токенов дизайн-системы.

**Вердикт Сомневающегося Агента:** APPROVED

---

## Чек-лист реализации

### Фаза 1: Оптимизация чанков и ликвидация циклов (`vite.config.ts`)
- [x] **Шаг 1.1:** Обновить `manualChunks` в `vite.config.ts`:
  - `lucide-react` вынести в `'vendor-icons'` ДО общего матчинга React.
  - `dexie`, `dexie-react-hooks`, `sql.js`, `jszip` вынести в `'vendor-db'` ДО общего матчинга React.
  - `@dnd-kit` вынести в `'vendor-dnd'`.
  - `i18next` вынести в `'vendor-i18n'`.
  - Оставшиеся React/Zustand/Jotai — в `'vendor-react'`.
- [x] **Шаг 1.2:** Запустить `npm run build:renderer` и подтвердить:
  - Код выхода 0.
  - Предупреждение `Circular chunk` полностью исчезло.
  - Чанк `vendor-icons` успешно сгенерирован (76.88 kB).

### Фаза 2: Оптимизация селекторов в таймлайне и библиотеке
- [x] **Шаг 2.1:** `src/features/presenter/components/timeline/SlideTile.tsx`: перевести `syncNestedPresentation`, `setCachedNestedPresentation`, `nestedPresentationsCache` на атомарные селекторы.
- [x] **Шаг 2.2:** `src/features/presenter/components/timeline/NestedPresentationTile.tsx`: оптимизировать подписку на стор через `useShallow`.
- [x] **Шаг 2.3:** `src/features/presenter/components/library/PresentationLibrary.tsx`: перевести вызовы `usePresentationStore()` на `useShallow` и `useModalStore(s => s.openModal)`.
- [x] **Шаг 2.4:** `src/features/presenter/components/library/PresentationContextMenu.tsx`: применить атомарные селекторы и `useShallow`.
- [x] **Шаг 2.5:** `BackgroundCropModal.tsx`, `ConfirmModal.tsx`, `PromptModal.tsx`, `OrphanAudioScopesModal.tsx`: оптимизировать селекторы модального стора.
- [x] **Шаг 2.6:** Проверить `npm run check:memo` и `npx tsc --noEmit`.

### Фаза 3: Санитизация вывода поиска (XSS Guard)
- [x] **Шаг 3.1:** `src/features/search/components/QuickSearchModal.tsx`: обернуть `res.highlightedText` в `sanitizeHtml(...)`.
- [x] **Шаг 3.2:** `src/features/bible-browser/components/navigation/SearchOverlay.tsx`: обернуть `res.highlightedText` в `sanitizeHtml(...)`.
- [x] **Шаг 3.3:** Поддержать тег `<mark>` и безопасные классы стилизации в `sanitizeHtml.ts`.
- [x] **Шаг 3.4:** Запустить `npm run check:security:antipatterns`.

### Фаза 4: Декомпозиция `AudioService.ts` (693 строки -> 428 строк)
- [x] **Шаг 4.1:** Выделить `src/features/presenter/services/audio/types.ts` (типы активных треков и контекста).
- [x] **Шаг 4.2:** Выделить `src/features/presenter/services/audio/AudioFadeUtils.ts` (плавное затухание/нарастание и очистка аудио-элементов).
- [x] **Шаг 4.3:** Выделить `src/features/presenter/services/audio/AudioScopeResolver.ts` (поиск и сопоставление аудио-скоупов с презентациями, гимнами и таймерами).
- [x] **Шаг 4.4:** Выделить `src/features/presenter/services/audio/AudioPlaybackController.ts` (управление паузой, перемоткой, громкостью и вычисление прогресса трека).
- [x] **Шаг 4.5:** Рефакторить `AudioService.ts` на использование выделенных модулей с сохранением 100% публичного API (файл сокращен до 428 строк).
- [x] **Шаг 4.6:** Написать герметичные unit-тесты `AudioScopeResolver.test.ts` и `AudioPlaybackController.test.ts`.

### Фаза 5: Финальная детерминированная верификация (All Hard Gates)
- [x] **Шаг 5.1:** `npm run check:circular` — 0 циклов.
- [x] **Шаг 5.2:** `npm run check:hygiene` — 0 утечек.
- [x] **Шаг 5.3:** `npm run check:memo` — 100% memo.
- [x] **Шаг 5.4:** `npm run check:security:antipatterns` — 0 уязвимостей.
- [x] **Шаг 5.5:** `npm run check:debug-leftovers` — 0 отладочных артефактов.
- [x] **Шаг 5.6:** `npm run check:design` — 0 нарушений дизайн-системы.
- [x] **Шаг 5.7:** `npm run check:component-budget` — 462 компонента проверены, 0 ошибок.
- [x] **Шаг 5.8:** `npm run check` (tsc + eslint + vitest) — 124 тест-файла / 368 тестов, 0 ошибок.
- [x] **Шаг 5.9:** `npm run build:renderer` — чистый production-билд.
