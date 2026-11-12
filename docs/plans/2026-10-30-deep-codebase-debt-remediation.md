# План полной ликвидации технического долга и архитектурной декомпозиции (v2)

> **Статус:** COMPLETED  
> **Стек:** React 19, TypeScript 5.9, Vite 7, Electron, Dexie.js, Zustand, Jotai, Tailwind CSS v4, Vitest  
> **Связанные ADR:** [ADR D-04](.planning/decisions/D-04-component-size-and-decomposition-doctrine.md), [ADR D-02](.planning/decisions/D-02-security-antipatterns-gate.md), [ADR D-06](.planning/decisions/D-06-native-deck-cast-and-airrelay-redesign.md)  
> **Режим:** `/goal` (не завершать до полного устранения всех проблем и 100% прохождения гейтов)  

---

### Цель и Архитектура
Ликвидировать оставшиеся 5 ключевых пластов технического долга:
1. **Холостые ре-рендеры:** перевод всех неизбирательных подписок `usePresentationStore()` на атомарные селекторы и `useShallow`.
2. **Безопасность и гигиена ввода:** санитайзинг в `RemoteSlides.tsx` через `sanitizeHtml`, очистка неструктурированных `console.log`.
3. **i18n и локализация:** устранение хардкода в `RemoveHymnalModal.tsx`, добавление недостающих ключей в `locales/`.
4. **Декомпозиция желтой зоны:** разукрупнение тяжелых компонентов (`SlideDesignPanel.tsx`, `PresentationSelector.tsx`, `VerseList.tsx`) по правилам ADR D-04.
5. **Декомпозиция 2000-строчного монолита `electron/main.ts`:** модульное разделение на `electron/windows/` и `electron/ipc/` (`hymns`, `bibles`, `capturer`, `fonts`) с сохранением всех IPC контрактов.

---

### 🕵️ Adversarial Critic Audit Gate

- [x] **Фильтр 1 (Offline & Dexie Integrity):** Все транзакции Dexie и IPC-каналы сохраняют обратную совместимость и герметичность.
- [x] **Фильтр 2 (Physical & Mathematical Invariants):** Обработка координат экранов, мульти-мониторной геометрии проектора и сценического экрана переносится без изменения числовой логики.
- [x] **Фильтр 3 (Diff Budget & Component Size):** Декомпозиция разбита на атомарные шаги с контролем лимитов строк.
- [x] **Фильтр 4 (Type Safety & noUncheckedIndexedAccess):** Строгая типизация всех IPC аргументов и возвращаемых значений.
- [x] **Фильтр 5 (Race Conditions & Double-Clicks):** Сохранение существующих промисов блокировки и мьютексов.
- [x] **Фильтр 6 (Anti-Test Tampering):** Тесты не модифицируются в угоду сломанному коду; только проверка прохождения.
- [x] **Фильтр 7 (UI & Localization):** Все захардкоженные строки выносятся в i18n, отсутствие сырых эмодзи.

**Вердикт Сомневающегося Агента:** APPROVED

---

## Чек-лист реализации

### Фаза 1: Устранение холостых ре-рендеров (Zustand Selectors)
- [x] **Шаг 1.1:** `src/features/presenter/components/slide-editor/SlideEditorToolbar.tsx`: заменить общий `usePresentationStore()` на атомарные селекторы / `useShallow`.
- [x] **Шаг 1.2:** `src/features/presenter/components/slide-editor/VariableEditor.tsx`: оптимизировать селекторы.
- [x] **Шаг 1.3:** `src/features/presenter/components/slide-editor/SlideCanvas.tsx`: перевести на селектор `s => s.removeCanvasItem`.
- [x] **Шаг 1.4:** `src/features/presenter/components/library/PresentationSelector.tsx`: оптимизировать селекторы стора.
- [x] **Шаг 1.5:** `src/features/presenter/components/modals/TemplatePickerModal.tsx`: оптимизировать селекторы.
- [x] **Шаг 1.6:** `src/features/presenter/components/slide-editor/LogicalCanvas.tsx`: оптимизировать вызов `useDisplayStore`.
- [x] **Шаг 1.7:** Проверить `npm run check:memo` и запустить юнит-тесты.

### Фаза 2: Безопасность и гигиена ввода
- [x] **Шаг 2.1:** `src/remote/components/RemoteSlides.tsx`: обернуть вывод `slideState.slidePreviewText` в `sanitizeHtml` для предотвращения XSS через WebSocket.
- [x] **Шаг 2.2:** Очистить или структурировать нерелевантные `console.log` в продакшен-коде.
- [x] **Шаг 2.3:** Запустить `npm run check:security:antipatterns` и `npm run check:debug-leftovers`.

### Фаза 3: Локализация и устранение жестко зашитых строк (i18n)
- [x] **Шаг 3.1:** `RemoveHymnalModal.tsx`: заменить хардкод на `t('hymnals.remove_warning_count', ...)` и добавить ключи во все локали (`ru`, `en`, `de`).
- [x] **Шаг 3.2:** Проверить дефолтные имена в хелперах шаблонов на корректное использование локализации.

### Фаза 4: Декомпозиция компонентов в Желтой зоне (ADR D-04)
- [x] **Шаг 4.1:** Декомпозировать `SlideDesignPanel.tsx` (442 строки): вынести логику вкладок или шапку панели в подкомпонент.
- [x] **Шаг 4.2:** Декомпозировать `PresentationSelector.tsx` (416 строк): вынести карточку списка или панель действий.
- [x] **Шаг 4.3:** Декомпозировать `VerseList.tsx` (400 строк): вынести контекстное меню/тулбар селекции.
- [x] **Шаг 4.4:** Проверить `npm run check:component-budget`.

### Фаза 5: Архитектурная декомпозиция `electron/main.ts` (2,000 строк)
- [x] **Шаг 5.1:** Создать `electron/windows/windowManager.ts`: перенести создание и управление `mainWindow`, `projectorWindow`, `stageWindow` и мульти-мониторную логику.
- [x] **Шаг 5.2:** Создать `electron/ipc/hymnHandlers.ts`: перенести IPC для сборников гимнов и синхронизации с диском.
- [x] **Шаг 5.3:** Создать `electron/ipc/fileSystemHandlers.ts`: перенести IPC для диалогов файлов, папок и экспорта.
- [x] **Шаг 5.4:** Создать `electron/ipc/screenCaptureHandlers.ts`: перенести захват экранов и WebRTC signaling.
- [x] **Шаг 5.5:** Создать `electron/ipc/fontHandlers.ts`: перенести перечисление и установку системных шрифтов.
- [x] **Шаг 5.6:** Сократить `electron/main.ts` до компактного координатора приложения (<400 строк).
- [x] **Шаг 5.7:** Проверить компиляцию Electron (`npm run build:renderer` и `tsc`).

### Фаза 6: Итоговая верификация качества (Hard Gates)
- [x] **Шаг 6.1:** `npm run check:circular` (0 циклов).
- [x] **Шаг 6.2:** `npm run check:hygiene` (0 утечек).
- [x] **Шаг 6.3:** `npm run check:memo` (100% memo).
- [x] **Шаг 6.4:** `npm run check:security:antipatterns` (0 уязвимостей).
- [x] **Шаг 6.5:** `npm run check:debug-leftovers` (0 отладки).
- [x] **Шаг 6.6:** `npm run check:design` (0 нарушений).
- [x] **Шаг 6.7:** `npm run check:component-budget` (0 ошибок бюджета).
- [x] **Шаг 6.8:** `npm run check` (tsc + eslint + vitest) — 100% успех.
- [x] **Шаг 6.9:** `npm run build:renderer` — чистый production-билд.

