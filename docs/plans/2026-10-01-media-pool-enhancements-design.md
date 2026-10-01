# Дизайн-документ: Модернизация Медиапула и взаимодействие со слайдами

**Дата:** 2026-10-01  
**Статус:** Утверждено  
**Авторы:** Pair Programming (User + Antigravity)

---

## 1. Цели и границы проекта (Scope)

### Цели (Goals):
1. **Quick Look по `Shift + Space`:**
   - Быстрый просмотр медиафайла (фото, видео, аудио) в легковесном оверлее.
   - Срабатывает строго при наведении курсора мыши на зону медиапула (`isHovered`).
   - Навигация стрелками ($\leftarrow$ / $\rightarrow$) между файлами внутри Quick Look.
   - Полная изоляция от глобальных хоткеев: при открытом Quick Look стрелки и пробел не переключают и не затрагивают Live-вещание.
2. **Умный Drag & Drop на холст слайда (`SlideCanvas`):**
   - **Обычный перенос (без Shift):** добавление картинки как отдельного графического слоя (`addMediaLayer`) в координаты сброса курсора.
   - **Перенос с зажатым `Shift`:** замена фонового слоя слайда (`updateSlideBackground`) с визуальной подсветкой контура холста и плашкой *«Установить как фон слайда»*.
3. **Естественный импорт из операционной системы (OS Drag & Drop):**
   - Перетаскивание файлов/папок напрямую из Finder (macOS) или Проводника (Windows) в медиапул или на карточку конкретного бина.
   - Оптимизация на лету: WebP (до 2K) для фото, сохранение на диск для видео/аудио в Electron, дедупликация по SHA-256.
4. **Поиск и сортировка в Медиапуле:**
   - Поле поиска `SearchInput` по имени файла.
   - Сортировка: по дате добавления (новые/старые), по алфавиту (А-Я / Z-A), по типу медиа.
   - Информативный счетчик элементов (файлы, папки).
5. **Здоровье ассетов и релинкинг:**
   - Пункт контекстного меню «Найти файл на диске... (Relink)» для отсутствующих файлов (`isMissing`).
   - Пункт контекстного меню «Показать в Finder / Проводнике».
6. **Очистка структуры:**
   - Удаление мертвого рудимента «Медиа-бины» из `GraceLibPanel`, разделение ответственности.

### Не-цели (Non-goals / Вне скоупа):
- Quickplay в эфир в обход презентации (отклонено пользователем).
- Создание отдельных «фото-слайдов» на таймлайне (фото используется только как фоновый или графический слой).

---

## 2. Архитектура и компоненты

### 2.1. Quick Look Modal (`MediaQuickLookModal.tsx`)
- Расположение: `src/features/presenter/components/media/MediaQuickLookModal.tsx`.
- Свойства:
  - `item: IMediaItem | null` — текущий просматриваемый элемент.
  - `isOpen: boolean` — флаг видимости.
  - `onClose: () => void` — колбэк закрытия.
  - `onNavigate: (direction: 'prev' | 'next') => void` — переход к следующему/предыдущему файлу.
- Поведение клавиатуры:
  - Слушает `Escape`, `Shift + Space` (закрытие).
  - Слушает `ArrowLeft`, `ArrowRight` (листание).
  - Слушает `Space` (Play/Pause только для открытого превью видео/аудио).
  - Вызывает `e.stopPropagation()` и `e.stopImmediatePropagation()`.
- Глобальная защита Live:
  - Экспортирует состояние/атом `isQuickLookOpenAtom` в `uiAtoms.ts`.
  - В `useGlobalShortcuts.ts` добавляется guard: если `isQuickLookOpen` активен, обработка глобальных стрелок и пробела немедленно прерывается (`return`).

### 2.2. Умный Drag & Drop в `SlideCanvas.tsx`
- Обработка `onDragOver`:
  - Отслеживает `e.shiftKey` во время перетаскивания `application/json` с `source: 'media-pool'`.
  - Если `e.shiftKey === true`, активирует состояние `isShiftDropActive`.
- Визуальный фидбек:
  - При `isShiftDropActive` рендерится аккуратный контур холста `ring-2 ring-accent ring-inset` и плашка по центру/снизу: *«Установить как фон слайда»*.
- Обработка `onDrop`:
  - Если `e.shiftKey`:
    ```ts
    const backgroundLayer: IStyleLayer = {
        id: crypto.randomUUID(),
        type: media.type === 'video' ? 'video' : 'image',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        ...(media.type === 'video' ? {
            video: { url: media.path, id: media.id, source: 'local', isMuted: true, isLooping: true, isFromDb: !!media.data }
        } : {
            image: { url: media.path, id: media.id, source: 'local', isFromDb: !!media.data }
        })
    };
    await updateSlideBackground(slideId, [backgroundLayer]);
    ```
  - Если без Shift:
    - Вызов существующего `addMediaLayer(slideId, data.media, { x, y })`.

### 2.3. OS Drag & Drop в `MediaPoolPanel.tsx`
- Зона дропа файлов из Finder/Проводника (`e.dataTransfer.files`).
- Поддержка сброса прямо в карточку бина (`bin.id`) или в текущий открытый бин.
- Оверлей с блюром при внешнем dragover.
- Вызов `MediaPersistenceService.importMediaFromPath` для каждого пути.

### 2.4. Поиск и сортировка в `MediaPoolToolbar.tsx` и `useMediaPoolData.ts`
- В `MediaPoolToolbar` добавляется `SearchInput` и кнопка выбора порядка сортировки.
- В хуке `useMediaPoolData` входные параметры расширяются: `searchQuery`, `sortBy: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'type'`.
- Мемоизированная фильтрация и сортировка `visibleItems`.

### 2.5. Контекстное меню и Relink (`MediaPoolContextMenu.tsx`)
- Добавление опций:
  - `Relink`: выбор нового файла через `IpcService.selectFile`, обновление пути в `db.mediaPool` и снятие флага `isMissing`.
  - `Reveal in Finder`: вызов `IpcService.invoke('shell:show-item-in-folder', item.path)`.

### 2.6. Очистка `GraceLibPanel.tsx`
- Удаление секции `media` из вкладок GraceLib.
- `LibraryMediaSection.tsx` и связанные с ней пустые бины удаляются из GraceLib.

---

## 3. План тестирования и верификации
1. **Unit-тесты:**
   - Тестирование хука `useMediaPoolData` с фильтрами, поиском и сортировками.
   - Тестирование логики выбора фона vs слоя в `SlideCanvas`.
   - Проверка блокировки хоткеев Live при открытом Quick Look.
2. **Типобезопасность:**
   - Проверка `npx tsc --noEmit` без единой ошибки.
3. **Тестовый прогон:**
   - `npx vitest run` — все 103+ сюит тестов должны успешно проходить.
4. **Сборка:**
   - `npm run build:renderer` — успешная сборка приложения.
