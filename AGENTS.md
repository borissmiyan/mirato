# ⚡ AI Engineering Harness Rules (Universal Standard)

> **Golden Reference:** [Father Work Database](file:///Users/borissmiyan/Work/AppDev/Father%20Work%20Database) (`borissmiyan/ai-yak-harness`).  
> **Philosophy:** *«Промпт — рекомендация, Харнесс — детерминированный Hard Gate»*.

---

## 🛑 HARD CONSTRAINTS FOR AI AGENTS (Targeted & Deterministic)

1. **MANDATORY VERIFICATION DISCIPLINE:**
   Перед тем как заявить о выполнении задачи или предоставить финальный ответ пользователю, агент ОБЯЗАН выполнить и подтвердить с 0 ошибок:
   - `npm run check` (Строгая проверка типов `tsc`, правил линтера `eslint` и 100% прохождение всех тестов `vitest`).
   - `npm run build` (Чистая компиляция production-бандла).
   - **REMOTE CI GATE:** После `git push` агент обязан запустить `npm run verify:remote` (или пушить через `npm run push:verify`) и подтвердить код выхода 0 (`success`) удаленного CI Quality Gate. Завершать задачу без успешного удаленного CI запрещено.

2. **ANTI-TEST TAMPERING & DEPENDENCY FREEZE GATE:**
   - **СТРОГО ЗАПРЕЩЕНО** изменять существующие тесты (`*.test.*`, `*.spec.*`), чтобы заставить сломанный код пройти проверки. Тесты — неизменяемая истина.
   - **DEPENDENCY FREEZE:** Агентам запрещено самовольно добавлять или менять зависимости в `"dependencies"` во избежание галлюцинаций пакетов (Package Hallucination) и Supply Chain атак.
   - Любая модификация тестов без флага `ALLOW_TEST_MUTATION=true` или зависимостей без `ALLOW_DEP_MUTATION=true` блокируется pre-commit хуком и CI.

3. **SCOPE LOCK & DIFF BUDGET:**
   - Изменяйте **только** файлы, прямо требуемые задачей. Никакого непрошенного рефакторинга соседнего кода.
   - Ограничение на один коммит: не более **450 строк кода** и не более **10 файлов** (контролируется `scripts/verify-diff-budget.mjs`). Обход только по явному флагу человека `ALLOW_LARGE_DIFF=true`.

4. **ARCHITECTURAL DECISIONS (ADRs) & PROJECT CONTEXT:**
   - Перед проектированием и архитектурным выбором агент ОБЯЗАН свериться с `.planning/CONTEXT.md` и существующими ADR в `.planning/decisions/`.
   - Любое новое ключевое архитектурное решение фиксируется в `.planning/decisions/D-XX-<slug>.md` по шаблону `TEMPLATE.md`.

5. **FOLDER-SCOPED RULES (LAZY LOADING):**
   - Соблюдайте локальные правила `AGENTS.md` в подпапках проекта (`src/services/AGENTS.md`, `src/shared/ui/AGENTS.md`, `src/features/AGENTS.md`, `src/types/AGENTS.md`, `src/db/AGENTS.md`, `src/utils/AGENTS.md`).
   - Агент обязан считывать их по требованию (on-demand) при переходе к работе над файлами в соответствующей директории.

6. **DESIGN SYSTEM COMPLIANCE & COMPONENT REGISTRY:**
   - Перед созданием любого нового UI-компонента агент ОБЯЗАН проверить `COMPONENTS.md`. Если компонент уже существует — переиспользовать его. Запрещено плодить дубликаты!
   - Строго следовать токенам `DESIGN-AI.md` и никогда не нарушать запреты из `ANTIPATTERNS.md`.
   - **Запрет сырых эмодзи в JSX:** Не использовать символы (⚡, 📝, 🟢, 🛡️, etc.) в UI разметке. Использовать только векторные SVG-иконки из `lucide-react`.

7. **RESOURCE HYGIENE & ZERO LEAKS:**
   - Все `URL.createObjectURL()` обязаны иметь парный `URL.revokeObjectURL()` в cleanup.
   - Все слушатели событий `addEventListener` в `useEffect` обязаны иметь cleanup `removeEventListener` или `AbortController`.
   - Все таймеры `setInterval` обязаны иметь `clearInterval`.
   - Проверяется гейтом `npm run check:hygiene` (`scripts/verify-resource-hygiene.mjs`).

8. **COMPONENT MEMOIZATION & 500-LINE LIMIT:**
   - Все компоненты списков и карточек (`*Card.tsx`, `*Row.tsx`, `*Item.tsx`) обязаны быть обернуты в `React.memo` для предотвращения каскадных ре-рендеров.
   - Максимум **500 строк** на файл. При превышении — декомпозировать на хуки, утилиты и подкомпоненты.

9. **HERMETIC & DETERMINISTIC TESTING:**
   - Все тесты обязаны быть офлайн-герметичными (`process.env.TZ = 'UTC'`).
   - Любой незамоканный сетевой вызов (`fetch`) блокируется с исключением `[Hermetic Test Violation]`.
   - Для генерации моковых данных используйте детерминированные фабрики с фиксированным сидом (`createPrng` / Mulberry32).

10. **ОБЯЗАТЕЛЬНЫЙ 5-ЭТАПНЫЙ ЦИКЛ РАЗРАБОТКИ (ВСЕГДА И ДЛЯ ВСЕХ ЗАДАЧ):**
   1. **Этап 1: Research (Исследователь):** Анализ AST-графа, типов, моделей БД и инвариантов перед написанием плана.
   2. **Этап 2: Plan & Spec (Проектировщик):** Формирование плана с TDD-микрошагами (2–5 мин), границами скоупа (Non-Goals) и оценкой Diff Budget (< 450 строк).
   3. **Этап 3: Adversarial Critic Gate (Сомневающийся Агент):** Допрос плана адвокатом дьявола по 7 фильтрам (`skills/adversarial-critic/SKILL.md`). **Код СТРОГО ЗАБЛОКИРОВАН до вердикта `APPROVED`**.
   4. **Этап 4: TDD Execution (Разработчик):** Реализация циклами Red-Green-Refactor под контролем pre-commit хуков и лимита диффа.
   5. **Этап 5: Deterministic Verification (Приемка):** Обязательное подтверждение `npm run check` и `npm run build` с 0 ошибок, а после `git push` — `npm run verify:remote` (код выхода 0).

11. **STRYKER MUTATION & SNYK SECURITY ON-DEMAND POLICY:**
   - **СТРОГИЙ ЗАПРЕТ АВТОЗАПУСКА:** Инструменты мутационного тестирования Stryker CLI (`npm run test:mutate`) и сканер безопасности Snyk (`npm run check:security:snyk`) СТРОГО ЗАПРЕЩЕНО запускать автоматически в pre-commit, `npm run check`, `npm run build` или при общих фразах («давай», «делай», «погнали»).
   - **ПРАВИЛО НАПОМИНАНИЯ (ON-DEMAND REMINDER):** Агент обязан лишь ненавязчиво напоминать разработчику (Борису), что при необходимости глубокой проверки он может запустить Stryker CLI или Snyk.
   - **ЯВНАЯ КОМАНДА ДЛЯ ЗАПУСКА:** Агент запускает `npm run test:mutate` ТОЛЬКО по прямой явной команде: «запусти Stryker CLI» (или «запусти мутационные тесты»). Агент запускает `npm run check:security:snyk` ТОЛЬКО по прямой явной команде: «запусти Snyk» (или «запусти проверку Snyk»).

12. **ESM RUNTIME HYGIENE & ARTIFACT PRE-FLIGHT VERIFICATION:**
   - **ESM Naked Globals:** В проектах с `"type": "module"` строго запрещено прямое обращение к CJS-глобалам `__dirname` и `__filename`. Они обязаны вычисляться через `fileURLToPath(import.meta.url)` или `import.meta.dirname` (контролируется `npm run check:esm` / `scripts/verify-esm-and-path-hygiene.mjs`).
   - **Path Geometry & Bundle Depth:** Запрещены слепые относительные переходы `path.join(__dirname, '../../...')` в серверных/Electron-модулях без валидации `fs.existsSync` или использования `app.getAppPath()`, так как глубина директории после бандлинга (`dist/`, `dist-electron/`) смещается относительно исходников.
   - **Network Endpoint Fallback Hygiene:** Запрещено хардкодить `http://localhost:<port>` в UI-компонентах без строгой изоляции окружения (`isRemote`) во избежание `ERR_CONNECTION_REFUSED`.
   - **Artifact Pre-Flight & Smoke Gate:** В десктопных приложениях сборка обязана верифицироваться гейтом `npm run check:smoke` (`scripts/verify-electron-smoke.mjs`), подтверждающим синтаксическую валидность `preload.cjs`, главного процесса и целостность встроенных ассетов.
