# Фаза 1: Векторные Фигуры, Линия и 4 Угла — Implementation Plan

> **Статус:** UNDER_AUDIT  
> **Стек:** React 18, TypeScript 5.9, Vite 7, Vitest, Dexie.js, Supabase, Tailwind CSS v4  
> **Спецификация:** [docs/plans/2026-11-05-figma-vector-canvas-design.md](file:///Users/borissmiyan/Work/AppDev/ekklesienter/docs/plans/2026-11-05-figma-vector-canvas-design.md)  
> **Оценка Diff Budget:** ~350 строк кода, 9 файлов (Лимит: 450 строк / 10 файлов)  

---

### Цель и Архитектура
* **Цель:** Устранить баг отображения фигур (круг, треугольник, звезда, ромб отображались прямоугольниками из-за фонового div), превратить инструмент «Линия» в полноценный векторный примитив с 2 контрольными точками и наконечниками (стрелки), и реализовать интерактивные манипуляторы независимого скругления 4 углов через клавишу `Alt` (Option).
* **Архитектурный подход:**
  1. Выделение нативного SVG Shape Geometry Engine: генерация путей `<path d="...">` / `<polygon>` / `<circle>` в нормализованном пространстве `0 0 100 100`.
  2. Применение SVG clip-path к контейнеру фоновых заливок (`SlideBackground`) и синхронизация масок обводок в `StrokeRenderer` со всеми типами фигур.
  3. В `CanvasCornerRadiusHandles`: поддержка индивидуального перемещения каждого из 4 углов (`borderRadiusTL`, `TR`, `BL`, `BR`) с зажатой клавишей `Alt` (Option) и позиционирование каждого маркера по его индивидуальному радиусу.
  4. Создание легковесного компонента `CanvasLineHandles` для элементов типа `stroke`: 2 круглых маркера на концах (Start & End), вращение и масштабирование, привязка угла к 45° при зажатом `Shift`, и рендеринг маркеров наконечников (стрелка, треугольник, круг).

---

### Границы задачи (Scope Lock & Non-Goals)
* ✅ **Входит в скоуп (Фаза 1):**
  * Корректный рендеринг всех фигур: `rect`, `circle`, `triangle`, `star`, `diamond` со всеми заливками (Color, Gradient, Image) и обводками (Inside, Center, Outside).
  * 4 маркера углов в `CanvasCornerRadiusHandles`: общий драг всех углов + `Alt` для отдельного угла (`TL`, `TR`, `BL`, `BR`).
  * `CanvasLineHandles`: 2 контрольные точки линии, drag под любым углом, `Shift` (шаг 45°), наконечники стрелок (None, Arrow, Triangle, Circle).
  * Unit-тесты на геометрию фигур и расчеты углов линии.
* 🛑 **НЕ входит (Non-Goals для Фазы 1 — перенесено в Фазы 2 и 3):**
  * Инструмент Перо (`P`) и редактирование произвольных Безье-кривых (Фаза 2).
  * Контейнерные группы `Cmd+G` и режим масок `isMask: true` (Фаза 3).
  * Рефакторинг соседних вкладок инспектора или других типов элементов (`text`, `video`).

---

## 🕵️ Adversarial Critic Audit Gate (7 Фильтров)

- [x] **Фильтр 1 (Offline & Dexie Integrity):** Все изменения затрагивают только рендеринг и стандартный контракт `updateCanvasItem(slideId, itemId, patch)` в Zustand-сторе, который уже сохраняется локально в Dexie/JSON backup.
- [x] **Фильтр 2 (Physical & Mathematical Invariants):** Радиус скругления строго ограничен `0 <= radius <= min(width, height) / 2`. Углы линии и дельты координат вычисляются с защитой от деления на 0 при нулевой длине линии (`Math.hypot(dx, dy) || 1`).
- [x] **Фильтр 3 (Diff Budget < 450 строк / 10 файлов):** Оценка диффа: ~350 строк в 9 файлах. Все файлы строго до 320 строк (потолок 500 строк не нарушается).
- [x] **Фильтр 4 (Type Safety & noUncheckedIndexedAccess):** Строгая типизация `LineCapType`, безопасный доступ к опциональным полям `item.stroke`, `item.shape`, fallback-значения по умолчанию.
- [x] **Фильтр 5 (Race Conditions & Double-Clicks):** Перетаскивание манипуляторов использует `PointerCapture` и RAF-троттлинг (120 FPS). Модификация стейта фиксируется только на `pointerup` с вызовом `takeSnapshot`.
- [x] **Фильтр 6 (Anti-Test Tampering):** Существующие тесты не модифицируются. Добавляются новые изолированные тесты для геометрии фигур и расчетов манипуляторов линии.
- [x] **Фильтр 7 (UI & Localization):** Используются исключительно векторные иконки `lucide-react`. Все новые подсказки тултипов и селекторы наконечников локализованы во всех трёх словарях (`ru`, `en`, `de`).

**Вердикт Сомневающегося Агента:** `APPROVED` (Все 7 фильтров пройдены)

---

## 📋 Пошаговый TDD-план реализации (Bite-Sized Steps)

### Шаг 1: Расширение типов и математическая утилита геометрии (TDD Red -> Green)
1. В `src/core/types/canvas.ts` добавить типы:
   * `export type LineCapType = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond';`
   * Расширить `ICanvasItemStroke` полями `startCap?: LineCapType; endCap?: LineCapType;`.
2. Создать чистую утилиту `src/features/presenter/components/slide-editor/renderers/shapeGeometry.ts`:
   * Функции генерации SVG path/points для: `circle`, `triangle`, `star`, `diamond`, `rect` (с поддержкой 4 независимых радиусов).
   * Вычисление Bounding Box и угла наклона линии.
3. Написать модульный тест `src/features/presenter/components/slide-editor/renderers/__tests__/shapeGeometry.test.ts` (покрытие 100% фигур и граничных случаев радиусов).

### Шаг 2: Починка рендеринга фигур и заливок в `ShapeRenderer` и `CanvasItemView`
1. В `ShapeRenderer.tsx`:
   * Использовать `shapeGeometry.ts` для генерации путей.
   * Экспортировать `getShapeClipPathDef(item, idPrefix)` для использования в заливках.
2. В `CanvasItemView.tsx`:
   * Для `item.type === 'shape'` привязать CSS `clipPath: url(#${clipId})` к контейнеру заливок `<SlideBackground>`.
   * Теперь любая заливка (цвет, градиент, текстура) идеально обрезается по форме круга, треугольника, звезды или ромба!
3. В `StrokeRenderer.tsx`:
   * Привязать маску обводки к геометрии текущей фигуры вместо жестко зашитого прямоугольника `RoundedRect`.

### Шаг 3: Независимые манипуляторы 4 углов в `CanvasCornerRadiusHandles`
1. В `CanvasCornerRadiusHandles.tsx`:
   * Добавить расчет индивидуального `insetPx` для каждого угла (`tl`, `tr`, `br`, `bl`) на основе его радиуса.
   * При перетаскивании маркера проверять `e.altKey`:
     * Если `altKey === true`: менять `lockBorderRadius: false` и обновлять только `borderRadius${corner.toUpperCase()}`.
     * Если без `altKey`: синхронно обновлять все 4 угла.
   * В HUD выводить имя угла при зажатом Alt (например, `TL: 24px` вместо `24px`).

### Шаг 4: 2-точечные манипуляторы Линии (`CanvasLineHandles`) и наконечники
1. Создать компонент `src/features/presenter/components/slide-editor/CanvasLineHandles.tsx`:
   * 2 круглых маркера на концах линии (Start Handle и End Handle).
   * Перетаскивание с пересчетом координат и углов.
   * При зажатом `Shift` — привязка угла к шагу 45°.
2. В `CanvasItemControls.tsx`:
   * Если `item.type === 'stroke'`, монтировать `CanvasLineHandles` вместо прямоугольной 8-точечной рамки изменения размера.
3. В `StrokeRenderer.tsx` / `CanvasItemView.tsx`:
   * Рендерить SVG `<marker>` для стрелок и наконечников (`arrow`, `circle`, `triangle`).

### Шаг 5: Селектор наконечников стрелок в `ItemProperties.tsx` и локализация
1. В `ItemProperties.tsx`:
   * Для элементов типа `stroke` добавить селекторы начального и конечного наконечника (`startCap`, `endCap`).
2. Добавить ключи локализации в `src/core/locales/{ru,en,de}/presentation.ts`:
   * `line_cap_none`, `line_cap_arrow`, `line_cap_triangle`, `line_cap_circle`.

### Шаг 6: Финальная сквозная детерминированная верификация (Gate)
1. `npm run check:types` (0 ошибок TypeScript).
2. `vitest run` (100% тестов успешно, 0 регрессий).
3. `npm run check:hygiene && npm run check:esm && npm run check:design` (0 предупреждений).
4. `npm run build:renderer && npm run check:smoke` (0 ошибок компиляции и сборки).

