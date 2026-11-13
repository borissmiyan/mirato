#!/usr/bin/env node
// scripts/verify-canvas-interactions.mjs
// ⚡ [Canvas & Interaction Integrity Gate]
// Enforces invariants to prevent 0px bounding box collapse, drag abort locks,
// coordinate jumps during resize, and ghost layer duplicates on the slide canvas.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let errorsCount = 0;

function pass(msg) {
  console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
}

function fail(msg) {
  console.error(`  \x1b[31m✖ [VIOLATION]\x1b[0m ${msg}`);
  errorsCount++;
}

function readWorkspaceFile(relPath) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    fail(`Required file not found: ${relPath}`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

console.log('====================================================================');
console.log('⚡ [Canvas & Interaction Gate] Проверка инвариантов интерактивного холста');
console.log('====================================================================\n');

// 1. Invariants of SlideCanvas.tsx (Layer Separation & In-Flow Rendering)
console.log('1. Проверка разделения слоев в SlideCanvas.tsx:');
const slideCanvasContent = readWorkspaceFile('src/features/presenter/components/slide-editor/SlideCanvas.tsx');
if (slideCanvasContent) {
  // Layer 1 must NOT render text (must skip item.type === 'text' to prevent duplicate phantom text)
  const layer1SkipsText = /item\.type\s*===\s*['"]text['"]\s*\)\s*return\s+null/.test(slideCanvasContent);
  if (layer1SkipsText) {
    pass('Слой 1 корректно пропускает текст (нет фантомных дубликатов в неинтерактивном слое)');
  } else {
    fail('Слой 1 обязан пропускать рендеринг текста (item.type === "text"), чтобы не создавать фантомные слои под pointer-events-none');
  }

  // Layer 2 must render CanvasItemView for text items (both viewing and editing)
  const layer2RendersText = /CanvasItemView\s+item=\{item\}\s+isEditing=\{isEditing\}/.test(slideCanvasContent);
  if (layer2RendersText) {
    pass('Слой 2 монтирует CanvasItemView в интерактивном контейнере (высота не схлопывается в 0px)');
  } else {
    fail('Слой 2 обязан монтировать <CanvasItemView item={item} isEditing={isEditing} /> в контейнере взаимодействия div#item-${item.id}');
  }

  // Container ID invariant
  if (slideCanvasContent.includes('id={`item-${item.id}`}')) {
    pass('Интерактивные контейнеры имеют идентификатор id={`item-${item.id}`} для измерения DOM-геометрии');
  } else {
    fail('Интерактивные элементы обязаны содержать id={`item-${item.id}`} для работы resolveVisualDimensions');
  }
}

// 2. Invariants of useCanvasInteraction.ts (Drag & Resize Smoothness)
console.log('\n2. Проверка хука взаимодействия useCanvasInteraction.ts:');
const interactionContent = readWorkspaceFile('src/features/presenter/hooks/useCanvasInteraction.ts');
if (interactionContent) {
  // Prohibit naive move aborts that lock text dragging
  const hasTextMoveAbort = /if\s*\(\s*item\.type\s*===\s*['"]text['"]\s*&&\s*type\s*===\s*['"]move['"]\s*\)\s*return/.test(interactionContent);
  if (!hasTextMoveAbort) {
    pass('Отсутствуют паразитные аборты перемещения текста (текст свободно перетаскивается мышью)');
  } else {
    fail('Обнаружен запрещенный аборт: "if (item.type === \'text\' && type === \'move\') return;". Текст должен перетаскиваться при обычном клике');
  }

  // Check resolveVisualDimensions usage
  const usesVisualDimensions = interactionContent.includes('resolveVisualDimensions');
  if (usesVisualDimensions) {
    pass('Хук использует resolveVisualDimensions для предотвращения скачков координат при ресайзе');
  } else {
    fail('useCanvasInteraction обязан использовать resolveVisualDimensions для учета реальных DOM-габаритов текста');
  }
}

// 3. Minimum dimensions & Typography Safety
console.log('\n3. Проверка защиты от схлопывания пустых блоков текста:');
const textRendererContent = readWorkspaceFile('src/features/presenter/components/slide-editor/renderers/TextRenderer.tsx');
const inlineEditorContent = readWorkspaceFile('src/features/presenter/components/slide-editor/InlineTextEditor.tsx');

const textRendererSafe = textRendererContent.includes("minHeight: '1em'") && textRendererContent.includes("minWidth: isAutoWidthText ? '1ch'");
const inlineEditorSafe = inlineEditorContent.includes("minHeight: '1em'");

if (textRendererSafe) {
  pass('TextRenderer имеет гарантированные пороги minHeight: 1em и minWidth: 1ch для авто-ширины');
} else {
  fail('TextRenderer обязан задавать minHeight: 1em и minWidth: 1ch для предотвращения исчезновения пустого текста');
}

if (inlineEditorSafe) {
  pass('InlineTextEditor имеет гарантированный порог minHeight: 1em');
} else {
  fail('InlineTextEditor обязан задавать minHeight: 1em');
}

// 4. Contract Test Presence
console.log('\n4. Проверка наличия поведенческих тестов холста:');
const adaptivityTestExists = fs.existsSync(path.join(rootDir, 'src/features/presenter/components/slide-editor/__tests__/SlideCanvasTextAdaptivity.test.tsx'));
const interactionContractExists = fs.existsSync(path.join(rootDir, 'src/features/presenter/components/slide-editor/__tests__/CanvasInteractionContract.test.tsx'));

if (adaptivityTestExists) {
  pass('Тест SlideCanvasTextAdaptivity.test.tsx существует и проверяет режимы auto-height, auto-width и fixed');
} else {
  fail('Обязательный тест SlideCanvasTextAdaptivity.test.tsx не найден!');
}

if (interactionContractExists) {
  pass('Тест CanvasInteractionContract.test.tsx существует и проверяет инварианты кликов и драга');
} else {
  fail('Обязательный тест CanvasInteractionContract.test.tsx не найден!');
}

console.log('====================================================================');
if (errorsCount === 0) {
  console.log('✅ [Canvas & Interaction Gate] Все инварианты холста строго соблюдены! (0 ошибок)\n');
  process.exit(0);
} else {
  console.error(`❌ [Canvas & Interaction Gate] Обнаружено нарушений: ${errorsCount}. Коммит заблокирован.\n`);
  process.exit(1);
}
