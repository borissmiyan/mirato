import { atom, PrimitiveAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { AppMode, ILogo, IHymnal, ICanvasStyleSnapshot, ICustomGuide } from '../types';

export const fontPreviewFamilyAtom = atom(null as string | null) as PrimitiveAtom<string | null>;
export const fontPreviewWeightAtom = atom(null as string | null) as PrimitiveAtom<string | null>;

// App state
export const appModeAtom = atom<AppMode>('scripture');
export const hymnModalReturnStateAtom = atom<{
    isOpen: boolean;
    activeHymnalId: string | null;
    view: 'info' | 'thematic';
} | null>(null) as PrimitiveAtom<{
    isOpen: boolean;
    activeHymnalId: string | null;
    view: 'info' | 'thematic';
} | null>;

export const activeHymnalIdAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

export const removeHymnalModalAtom = atom<{
    isOpen: boolean;
    hymnal: IHymnal | null;
}>({ isOpen: false, hymnal: null });

export const importCollisionModalAtom = atom<{
    isOpen: boolean;
    existingId: string | null;
    newDirName: string | null;
}>({ isOpen: false, existingId: null, newDirName: null });

export const hymnalInstructionModalAtom = atom<boolean>(false);

export const devModeAtom = atomWithStorage('dev-mode', false);
export const isDevAuthenticatedAtom = atomWithStorage('dev-authenticated', false);

// Text settings
export const fontSizeAtom = atom(3.5); // rem
export const previewFontSizeAtom = atom(3.5);
export const showReferenceAtom = atom(true);
export const themeAccentAtom = atom('amber'); // amber, rose, blue, stone

// Layout
export const sidebarOpenAtom = atom(true);
export const historyOpenAtom = atom(false) as PrimitiveAtom<boolean>;
export const searchOpenAtom = atom(false) as PrimitiveAtom<boolean>;
export const canvasZoomAtom = atom(1.0) as PrimitiveAtom<number>;
export const canvasEffectiveScaleAtom = atom(1.0) as PrimitiveAtom<number>;
export const canvasOffsetAtom = atom<{ x: number, y: number }>({ x: 0, y: 0 });
export const canvasSafeZonesAtom = atomWithStorage('canvas-safe-zones', false);
export const canvasGridAtom = atomWithStorage('canvas-grid', false);
export type CanvasResolution = 'full' | 'half' | 'quarter';
export const canvasResolutionAtom = atomWithStorage<CanvasResolution>('canvas-resolution', 'half');
export const slideDesignPanelOpenAtom = atom(false) as PrimitiveAtom<boolean>;
export const latestInteractionAreaAtom = atom<'canvas' | 'timeline' | 'audio'>('timeline');
export const selectedCanvasItemIdsAtom = atom([] as string[]) as PrimitiveAtom<string[]>;
export const timelineHeightAtom = atom(236); // Strictly limited to 236px
export const isTimelineHoveredAtom = atom(false);
export const editingCanvasItemIdAtom = atom(null as string | null) as PrimitiveAtom<string | null>;
export const vectorEditingItemIdAtom = atom(null as string | null) as PrimitiveAtom<string | null>;
export const selectedTransitionSlideIdAtom = atom(null as string | null) as PrimitiveAtom<string | null>;

export type SlideDesignTab = 'properties' | 'background' | 'layers' | 'audio' | 'timer' | 'transition' | 'video' | 'style' | 'elements';
export const slideDesignTabAtom = atom<SlideDesignTab>('properties');

export type CanvasTool = 'select' | 'text' | 'pan' | 'image' | 'video' | 'shape' | 'stroke' | 'effect' | 'pen' | string;
export const canvasToolAtom = atom('select' as CanvasTool) as PrimitiveAtom<CanvasTool>;

export interface TextCommand {
  command: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'foreColor' | 'fontName' | 'fontSize' | 'undo' | 'redo' | 'scriptStyle' | 'textCase' | 'listType' | 'underlineStyle' | 'lineHeight' | 'letterSpacing' | 'paragraphSpacing' | 'fontWeight';
  value?: string;
  timestamp: number;
}
export const textCommandAtom = atom<TextCommand | null>(null as TextCommand | null);

// Live Overrides
export type OverrideType = 'blackout' | 'whiteout' | 'logo';
export const activeOverrideAtom = atom(null as OverrideType | null) as PrimitiveAtom<OverrideType | null>;
export const liveLogoAtom = atom(null as ILogo | null) as PrimitiveAtom<ILogo | null>;
// Left Panel State
export const selectedLeftBlockIdAtom = atom<string>('worship');

// Computed style for the slide text
export const slideStyleAtom = atom((get) => ({
  fontSize: `${get(fontSizeAtom)}rem`,
  lineHeight: 1.4,
}));

// Drag/Update state for Slide Editor (used to pause sync)
export const slideEditorDragActiveAtom = atom(false);
export const slideEditorPendingUpdateAtom = atom(false);

// Hover states for Enter key contextual actions
export const slidePreviewHoveredAtom = atom(false);
export const slideDesignHoveredAtom = atom(false);
export const presenterPanelHoveredAtom = atom(false);

// Editor Toolbar visibility (hide/show the floating tools bar)
export const editorToolbarVisibleAtom = atomWithStorage('editor-toolbar-visible', true);
export const clipSlideContentAtom = atomWithStorage<boolean>('clipSlideContent', false);

// Quick Look State
export const isQuickLookOpenAtom = atom(false) as PrimitiveAtom<boolean>;

// Timeline display modes: 'hidden' (0px) | 'compact' (slides row only ~144px) | 'expanded' (full ~300px)
export type TimelineMode = 'hidden' | 'compact' | 'expanded';
export const timelineModeAtom = atomWithStorage<TimelineMode>('timeline-mode', 'expanded');

// Figma-grade Superpowers Atoms
export const copiedCanvasStyleAtom = atom(null as ICanvasStyleSnapshot | null) as PrimitiveAtom<ICanvasStyleSnapshot | null>;
export const showCanvasRulersAtom = atomWithStorage<boolean>('canvas-rulers-visible', false);
export const canvasCustomGuidesAtom = atom([] as ICustomGuide[]) as PrimitiveAtom<ICustomGuide[]>;
export const lastDuplicateOffsetAtom = atom<{ dx: number; dy: number } | null>(null) as PrimitiveAtom<{ dx: number; dy: number } | null>;
export const showCanvasQuickActionsAtom = atom(false) as PrimitiveAtom<boolean>;


