import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom } from 'jotai';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useMetadata } from './useMetadata';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { appModeAtom, previewFontSizeAtom, showReferenceAtom, activeOverrideAtom } from '@/core/store/uiAtoms';
import { AppMode, Verse, ISlide, ICanvasSlide, INestedSlide, PresenterSettings, SlideDisplayProps, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import { BUILT_IN_HYMN_THEMES } from '@/features/hymns/services/hymnThemeConstants';
import { materializeHymnPresentation, resolveHymnThemeFromList } from '@/features/hymns/services/hymnThemeMaterializer';

export interface UseSlideDisplayDataReturn {
  appMode: AppMode;
  settings: PresenterSettings;
  activeVerse: Verse | null;
  isMultiVerseMode: boolean;
  multiVerses: Verse[];
  parallelVerse: Verse | null;
  presentation: IPresentationFile | null | undefined;
  selectedSlide: ISlide | null | undefined;
  bibleVerses: Verse[] | null;
  bibleSecondVerse: Verse | null;
  blocksMap: Map<string, IBlock>;
  templatesMap: Map<string, ITemplate>;
  previewFontSize: number;
  showRef: boolean;
  activeOverride: string | null;
  presentationStore: {
    activeServiceId: string | null;
    selectedPresentationId: string | null;
    activePresentationId: string | null;
    selectedPresentation: IPresentationFile | null;
    activePresentation: IPresentationFile | null;
    previewSlideId: string | null;
    navigationParentSlideId: string | null;
    lastTransitionTrigger: number;
    navigationDirection: 'forward' | 'backward';
  };
}

/**
 * Hook to orchestrate all data fetching and store state for SlideDisplay
 */
export function useSlideDisplayData(options: SlideDisplayProps): UseSlideDisplayDataReturn {
  const { 
    isProjector,
    activeVerse: propVerse,
    selectedSlide: propSlide,
    parallelVerse: propParallel, 
    multiVerses: propMultiVerses,
    isMultiVerseMode: propIsMultiVerseMode,
    appMode: propAppMode,
    settings: propSettings 
  } = options;

  const bibleStore = useBibleStore(useShallow(s => ({
    activeVerse: s.activeVerse,
    isMultiVerseMode: s.isMultiVerseMode,
    selectedVerses: s.selectedVerses,
    secondTranslationId: s.secondTranslationId
  })));
  const { settings: globalSettings } = usePresenterStore(useShallow(s => ({ settings: s.settings })));
  
  const presentationStore = usePresentationStore(useShallow(s => ({
    activeServiceId: s.activeServiceId,
    selectedPresentationId: s.selectedPresentationId,
    activePresentationId: s.activePresentationId,
    selectedPresentation: s.selectedPresentation,
    activePresentation: s.activePresentation,
    nestedPresentationsCache: s.nestedPresentationsCache,
    previewSlideId: s.previewSlideId,
    navigationParentSlideId: s.navigationParentSlideId,
    lastTransitionTrigger: s.lastTransitionTrigger,
    navigationDirection: s.navigationDirection
  })));
  
  const [storeAppMode] = useAtom(appModeAtom);
  const [previewFontSize] = useAtom(previewFontSizeAtom);
  const [showRef] = useAtom(showReferenceAtom);
  const [activeOverride] = useAtom(activeOverrideAtom);

  const settings = propSettings || globalSettings;
  const appMode = propAppMode !== undefined ? propAppMode : storeAppMode;

  // 1. Bible Data
  const activeVerse = isProjector ? propVerse : bibleStore.activeVerse;
  const isMultiVerseMode = isProjector
    ? !!propIsMultiVerseMode
    : (bibleStore.isMultiVerseMode || bibleStore.selectedVerses.length >= 2);
  const multiVerses = isProjector ? propMultiVerses : bibleStore.selectedVerses;

  const parallelVerseFromStore = useLiveQuery(
    async () => {
      if (!activeVerse || !bibleStore.secondTranslationId || appMode !== 'scripture' || isMultiVerseMode) return null;
      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([bibleStore.secondTranslationId, activeVerse.bookId, activeVerse.chapter])
        .and(v => v.verseNumber === activeVerse.verseNumber)
        .first();
    },
    [activeVerse?.bookId, activeVerse?.chapter, activeVerse?.verseNumber, bibleStore.secondTranslationId, appMode, isMultiVerseMode]
  );
  const parallelVerse = (isProjector && propParallel !== undefined) ? propParallel : parallelVerseFromStore;

  // 2. Presentation Data
  const targetPresentationId = presentationStore.selectedPresentationId || presentationStore.activePresentationId;
  const dbPresentation = useLiveQuery(
    () => targetPresentationId ? db.presentationFiles.get(targetPresentationId) : undefined,
    [targetPresentationId]
  );

  const presentation = useMemo(() => {
    if (presentationStore.selectedPresentation && presentationStore.selectedPresentation.id === presentationStore.selectedPresentationId) return presentationStore.selectedPresentation;
    if (presentationStore.activePresentation && presentationStore.activePresentation.id === presentationStore.activePresentationId) return presentationStore.activePresentation;
    return dbPresentation;
  }, [presentationStore.selectedPresentation, presentationStore.selectedPresentationId, presentationStore.activePresentation, presentationStore.activePresentationId, dbPresentation]);

  const selectedSlideFromStore = useMemo(() =>
    presentation?.slides?.find(s => s.id === presentationStore.previewSlideId),
    [presentation, presentationStore.previewSlideId]
  );

  // If the user clicked a master-presentation / nested container tile on the timeline,
  // resolve its first child slide (materialized with its hymnThemeId if a library hymn)
  // so the editor preview matches the tile thumbnail instead of showing the container's raw title variable.
  const containerMasterPresId = !isProjector && selectedSlideFromStore
    ? (selectedSlideFromStore.type === 'normal' && selectedSlideFromStore.blockId === 'master-presentation'
      ? (selectedSlideFromStore as ICanvasSlide).masterPresentationId
      : (selectedSlideFromStore.type === 'nested' ? (selectedSlideFromStore as INestedSlide).presentationId : undefined))
    : undefined;
  const containerSlideId = containerMasterPresId ? selectedSlideFromStore?.id : undefined;
  const containerHymnThemeId = containerMasterPresId && selectedSlideFromStore?.type === 'normal'
    ? (selectedSlideFromStore as ICanvasSlide).content?.variables?.hymnThemeId
    : undefined;
  const cachedContainerPres = containerSlideId
    ? (presentationStore.nestedPresentationsCache[containerSlideId] || (containerMasterPresId ? presentationStore.nestedPresentationsCache[containerMasterPresId] : undefined))
    : undefined;

  const queriedContainerPres = useLiveQuery(
    async () => {
      if (!containerMasterPresId || cachedContainerPres) return null;
      const rawPres = await db.presentationFiles.get(containerMasterPresId);
      if (!rawPres) return null;
      if (rawPres.hymnalId || rawPres.metadata?.isHymnLibraryItem) {
        const dbThemes = typeof db.hymnThemes?.toArray === 'function' ? await db.hymnThemes.toArray() : [];
        const themes = dbThemes.length > 0 ? dbThemes : BUILT_IN_HYMN_THEMES;
        const themeId = typeof containerHymnThemeId === 'string' ? containerHymnThemeId : (rawPres.metadata?.themeId as string | undefined);
        return materializeHymnPresentation(rawPres, resolveHymnThemeFromList(themeId, themes));
      }
      return rawPres;
    },
    [containerMasterPresId, cachedContainerPres, containerHymnThemeId]
  );

  const resolvedContainerFirstSlide = (cachedContainerPres || queriedContainerPres)?.slides?.[0];
  const selectedSlide = isProjector ? propSlide : (resolvedContainerFirstSlide || selectedSlideFromStore);

  // 3. Bible Block Data (for slides containing Bible content)
  const bibleVerses = useLiveQuery(async () => {
    if (selectedSlide?.blockId !== 'bible' || !(selectedSlide as ICanvasSlide).content?.variables?.verses) return null;
    try {
      const canvasSlide = selectedSlide as ICanvasSlide;
      const verseNumbers = JSON.parse(canvasSlide.content.variables.verses as string) as number[];
      const transId = canvasSlide.content.variables.translationId as string;
      const bId = canvasSlide.content.variables.bookId as string;
      const chap = Number(canvasSlide.content.variables.chapter);

      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([transId || 'KJV', bId || 'GEN', chap || 1])
        .filter(v => verseNumbers.includes(v.verseNumber))
        .toArray();
    } catch (e) { return null; }
  }, [selectedSlide]);

  // Resolve second translation synchronously from slide variables when present to avoid a 1-frame/1s single-verse flash
  const syncBibleSecondVerse = useMemo<Verse | null>(() => {
    if (selectedSlide?.blockId !== 'bible') return null;
    const vars = (selectedSlide as ICanvasSlide).content?.variables;
    const secTransId = vars?.secondTranslationId as string | undefined;
    const secText = vars?.secondVerseText as string | undefined;
    if (!secTransId || !secText) return null;
    return {
      id: 0,
      bookId: (vars.bookId as string) || 'GEN',
      chapter: Number(vars.chapter) || 1,
      verseNumber: Number(vars.verseStart) || 1,
      text: secText,
      translationId: secTransId,
    };
  }, [selectedSlide]);

  const dbBibleSecondVerse = useLiveQuery(async () => {
    if (syncBibleSecondVerse || selectedSlide?.blockId !== 'bible') return null;
    const canvasSlide = selectedSlide as ICanvasSlide;
    const vars = canvasSlide.content.variables;
    const secTransId = vars.secondTranslationId as string | undefined;
    if (!secTransId || !vars.bookId || !vars.chapter || !vars.verseStart) return null;
    
    return await db.verses
      .where('[translationId+bookId+chapter]')
      .equals([secTransId, vars.bookId as string, Number(vars.chapter)])
      .and(v => v.verseNumber === Number(vars.verseStart))
      .first() ?? null;
  }, [selectedSlide, syncBibleSecondVerse]);

  const bibleSecondVerse = syncBibleSecondVerse || dbBibleSecondVerse || null;

  // 4. Global Metadata
  const { blocksMap, templatesMap } = useMetadata();

  return {
    appMode,
    settings,
    activeVerse,
    isMultiVerseMode,
    multiVerses,
    parallelVerse,
    presentation,
    selectedSlide,
    bibleVerses,
    bibleSecondVerse,
    blocksMap,
    templatesMap,
    previewFontSize,
    showRef,
    activeOverride,
    presentationStore
  };
}
