import React from 'react';
import { useTranslation } from 'react-i18next';
import { MousePointerClick } from 'lucide-react';
import {
  CustomServiceIcon,
  CustomSlideIcon,
  CustomSlideStackIcon,
  CustomHymnStackIcon,
  CustomScriptureStackIcon,
} from '@/shared/ui';
import { cn } from '@/core/utils/cn';
import { Verse, ISlide, ICanvasSlide, IVideoSlide, PresenterSettings, IBlock, ITemplate, IStyleLayer, ICanvasItem } from '@/core/types';
import { SlideType } from '@/core/types/presentation';
import { ISlideTransition } from '@/core/types';

// Display components
import { VerseDisplay } from '../bible/VerseDisplay';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import SlideCanvas from '../slide-editor/SlideCanvas';

// Transitions
import { 
  CheckerboardTransition, 
  ComicDotsTransition, 
  normalizeTransitionType, 
  getTransitionVariables 
} from './transitions/SlideTransitions';

const EMPTY_CANVAS_ITEMS: ICanvasItem[] = [];

interface SlideContentOrchestratorProps {
  appMode: 'scripture' | 'presentation' | 'hymns';
  isMultiVerseMode: boolean;
  multiVerses: Verse[] | null;
  activeVerse: Verse | null;
  parallelVerse: Verse | null;
  selectedSlide: ISlide | null;
  hasActiveService?: boolean;
  hasActivePresentation?: boolean;
  hasSlides?: boolean;
  showRef: boolean;
  previewFontSize: number;
  settings: PresenterSettings;
  isProjector: boolean;
  isPreloading?: boolean;
  isPreview?: boolean;
  isMuted?: boolean;
  lang: string;
  
  // Transition related
  isTransitioning: boolean;
  lastTransitionTrigger: number;
  navigationDirection: 'forward' | 'backward';
  
  // Data items for presentation mode
  bibleVerses: Verse[] | null;
  bibleSecondVerse: Verse | null;
  blocksMap: Map<string, any>;
  templatesMap: Map<string, any>;
}

export const SlideContentOrchestrator: React.FC<SlideContentOrchestratorProps> = ({
  appMode,
  isMultiVerseMode,
  multiVerses,
  activeVerse,
  parallelVerse,
  selectedSlide,
  hasActiveService = false,
  hasActivePresentation,
  hasSlides = false,
  showRef,
  previewFontSize,
  settings,
  isProjector,
  isPreloading = false,
  isPreview = false,
  isMuted = false,
  lang,
  isTransitioning,
  lastTransitionTrigger,
  navigationDirection,
  bibleVerses,
  bibleSecondVerse,
  blocksMap,
  templatesMap
}) => {
  const { t } = useTranslation();

  const renderPreviewEmptyState = (label: string, icon: React.ReactNode) => (
    <div className="h-full w-full flex flex-col items-center justify-center gap-7 bg-stone-950/85 select-none">
      <div className="w-36 h-36 rounded-[36px] bg-stone-900/70 border border-white/[0.07] flex items-center justify-center shadow-inner">
        <div className="relative flex items-center justify-center">
          {icon}
          <MousePointerClick
            className="absolute -right-4 -bottom-3 w-12 h-12 text-accent drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)] pointer-events-none"
            fill="#141210"
            strokeWidth={1.6}
          />
        </div>
      </div>
      <p className="text-[34px] font-medium text-stone-400 tracking-tight text-center px-16">
        {label}
      </p>
    </div>
  );

  const renderScriptureContent = () => {
    if (isMultiVerseMode && multiVerses && multiVerses.length >= 2) {
      return (
        <MultiVerseDisplay
          verses={multiVerses}
          showReference={showRef}
          autoFit={true}
          className="h-full w-full"
          settings={settings}
        />
      );
    }

    if (!activeVerse) {
      if (!isProjector) {
        return renderPreviewEmptyState(
          t('no_verse_selected', 'Select a verse to present'),
          <CustomScriptureStackIcon className="w-16 h-16 text-stone-400/75" />
        );
      }
      return null;
    }

    return parallelVerse ? (
      <ParallelVerseDisplay
        verse1={activeVerse}
        verse2={parallelVerse}
        fontSize={previewFontSize}
        autoFit={true}
        settings={settings}
      />
    ) : (
      <VerseDisplay
        key={`${activeVerse.bookId}.${activeVerse.chapter}.${activeVerse.verseNumber}`}
        verse={activeVerse}
        showReference={showRef}
        fontSize={previewFontSize}
        autoFit={true}
        className="h-full w-full"
        isProjector={isProjector}
        settings={settings}
      />
    );
  };

  const renderPresentationContent = () => {
    if (!selectedSlide) {
      if (!isProjector) {
        const iconClass = 'w-16 h-16 text-stone-400/75';
        if (appMode === 'hymns') {
          return renderPreviewEmptyState(
            t('select_hymn_to_preview', 'Select a hymn to preview'),
            <CustomHymnStackIcon className={iconClass} />
          );
        }
        if (!hasActiveService) {
          return renderPreviewEmptyState(
            t('select_service_hint', 'Select a service'),
            <CustomServiceIcon className={iconClass} />
          );
        }
        if (!hasActivePresentation) {
          return renderPreviewEmptyState(
            t('select_presentation_hint', 'Select a presentation'),
            <CustomSlideStackIcon className={iconClass} />
          );
        }
        if (!hasSlides) {
          return renderPreviewEmptyState(
            t('create_slide_hint', 'Create a slide'),
            <CustomSlideIcon className={iconClass} />
          );
        }
        return renderPreviewEmptyState(
          t('select_slide_hint', 'Select a slide to preview'),
          <CustomSlideIcon className={iconClass} />
        );
      }
      return null;
    }

    const block = blocksMap.get(selectedSlide.blockId);
    const template = templatesMap.get(selectedSlide.templateId);
    const transition = (selectedSlide as ICanvasSlide).transition || { type: 'none', duration: 0.5 };
    const normalizedType = normalizeTransitionType(transition.type);
    const transitionClass = normalizedType !== 'none' ? `transition-${normalizedType}` : '';

    let content: React.ReactNode;

    if (selectedSlide.blockId === 'bible') {
      const canvasSlide = selectedSlide as ICanvasSlide;
      const isMulti = !!canvasSlide.content.variables.verses && bibleVerses && bibleVerses.length > 1;
      const hasParallel = !isMulti && !!canvasSlide.content.variables.secondTranslationId && !!bibleSecondVerse;

      const primaryVerse: Verse = {
        id: 0,
        bookId: canvasSlide.content.variables.bookId as string || 'GEN',
        chapter: Number(canvasSlide.content.variables.chapter) || 1,
        verseNumber: Number(canvasSlide.content.variables.verseStart) || 1,
        text: canvasSlide.content.variables.content as string || '',
        translationId: canvasSlide.content.variables.translationId as string || 'KJV'
      };

      content = (
        <div className="relative z-10 w-full h-full max-w-full pointer-events-auto overflow-hidden">
          {isMulti ? (
            <MultiVerseDisplay
              verses={bibleVerses!}
              showReference={showRef}
              autoFit={true}
              className="h-full w-full"
              settings={settings}
            />
          ) : hasParallel ? (
            <ParallelVerseDisplay
              verse1={primaryVerse}
              verse2={bibleSecondVerse!}
              autoFit={true}
              settings={settings}
            />
          ) : (
            <VerseDisplay
              verse={primaryVerse}
              showReference={showRef}
              autoFit={true}
              className="h-full w-full"
              isProjector={isProjector}
              settings={settings}
            />
          )}
        </div>
      );
    } else if (selectedSlide.type === 'video') {
      // Video slides: render full-screen video via SlideContentRenderer
      content = (
        <div className="relative z-10 w-full h-full pointer-events-auto">
          <SlideContentRenderer
            slide={selectedSlide}
            slideId={selectedSlide.id}
            settings={settings}
            isPreview={isPreview || !isProjector}
            isProjector={isProjector}
            isPreloading={isPreloading}
            isMuted={isMuted}
            bibleVerses={bibleVerses}
            bibleSecondVerse={bibleSecondVerse}
            isTransitioning={isTransitioning}
            blocksMap={blocksMap}
            templatesMap={templatesMap}
            lang={lang}
            hideCanvasItems={true}
            hideOverlays={true}
            backgroundOverride={(selectedSlide as IVideoSlide).backgroundOverride}
          />
        </div>
      );
    } else {
      content = (
        <div className="relative z-10 w-full h-full pointer-events-auto">
          <SlideContentRenderer
            template={template}
            block={block}
            variables={(selectedSlide as ICanvasSlide).content?.variables}
            lang={lang}
            backgroundOverride={(selectedSlide as ICanvasSlide).backgroundOverride}
            canvasItems={isProjector ? (selectedSlide as ICanvasSlide).content?.canvasItems : undefined}
            slide={selectedSlide}
            slideId={selectedSlide.id}
            isPreview={isPreview || !isProjector}
            isProjector={isProjector}
            isPreloading={isPreloading}
            hideCanvasItems={!isProjector}
          />
          {!isProjector && (
            <SlideCanvas slideId={selectedSlide.id} canvasItems={(selectedSlide as ICanvasSlide).content?.canvasItems || EMPTY_CANVAS_ITEMS} />
          )}
        </div>
      );
    }

    return (
      <div
        key={`${selectedSlide.id}-${lastTransitionTrigger}`}
        className={cn(
          "relative origin-center pointer-events-none h-full w-full",
          transitionClass && "transition-active",
          transitionClass
        )}
        style={{
          ...getTransitionVariables(transition, navigationDirection === 'backward'),
          transform: transitionClass ? `translate(var(--tx-start, 0%), var(--ty-start, 0%)) scale(var(--s-start, 1))` : undefined,
          opacity: transitionClass ? `var(--op-start, 1)` : undefined,
        }}
      >
        {isTransitioning && normalizedType === 'checkerboard' ? (
          <CheckerboardTransition transition={transition}>
            {content}
          </CheckerboardTransition>
        ) : isTransitioning && normalizedType === 'comic-dots' ? (
          <ComicDotsTransition transition={transition}>
            {content}
          </ComicDotsTransition>
        ) : content}
      </div>
    );
  };

  return appMode === 'scripture' ? renderScriptureContent() : renderPresentationContent();
};
