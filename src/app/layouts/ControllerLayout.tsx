import React, { useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { timelineModeAtom } from '@/core/store/uiAtoms';
import { useTranslation } from 'react-i18next';
import { Trash2, CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import {
  AppSidebar,
  AppToolbar,
  StatusOverlay,
  VersePreviews,
  AppModals
} from '../components/';
import SlideDisplay from '@/features/presenter/components/display/SlideDisplay';
import SlideTimeline from '@/features/presenter/components/timeline/SlideTimeline';
import SlideDesignPanel from '@/features/presenter/components/SlideDesignPanel';
import HistoryPanel from '@/features/bible-browser/components/HistoryPanel';
import { ReceiverStatusBadge, TransmitterStatusBadge, WirelessRelayModal } from '@/features/presenter/components/relay';
import { useRelayStore } from '@/core/store/relayStore';
import { PresenterService } from '@/features/presenter/services/presenterService';
import { useControllerLogic } from '../hooks/useControllerLogic';
import { useRemoteCastListener } from '@/features/presenter/hooks/useRemoteCastListener';

/**
 * Presentational layout for the main controller view.
 * Uses useControllerLogic to handle state and orchestrations.
 */
export const ControllerLayout: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useControllerLogic();

  // Listen to remote cast and privacy commands from network speaker laptop
  useRemoteCastListener(actions.openProjector);

  // audit-ignore: local modal state isolated to layout
  const [isRelayModalOpen, setIsRelayModalOpen] = useState(false);
  const isReceiverActive = useRelayStore((s) => s.isReceiverActive);
  const isTransmitterConnected = useRelayStore((s) => s.isTransmitterConnected);
  const timelineMode = useAtomValue(timelineModeAtom);
  const isPrivacyActive = useRelayStore((s) => s.isPrivacyActive);
  const stopReceiver = useRelayStore((s) => s.stopReceiver);

  const handleStopReceiver = useCallback(() => {
    stopReceiver();
    PresenterService.setOverride('logo');
  }, [stopReceiver]);

  const handleOpenSettings = useCallback(() => actions.setSettingsOpen(true), [actions]);
  const handleOpenRelay = useCallback(() => setIsRelayModalOpen(true), []);
  const handleCloseRelay = useCallback(() => setIsRelayModalOpen(false), []);
  const handleExitMultiVerse = useCallback(() => actions.exitMultiVerseMode(), [actions]);
  const handleCommitToProjector = useCallback(() => actions.commitToProjector(), [actions]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-200">
      {/* Sidebar Area */}
      {state.sidebarOpen && (
        <AppSidebar
          appMode={state.appMode}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {/* Main Stage (Slide Display) */}
      <main className="flex-1 h-full relative flex flex-col min-w-0 @container">
        <AppToolbar
          sidebarOpen={state.sidebarOpen}
          setSidebarOpen={actions.setSidebarOpen}
          historyOpen={state.historyOpen}
          setHistoryOpen={actions.setHistoryOpen}
          designPanelOpen={state.designPanelOpen}
          setDesignPanelOpen={actions.setDesignPanelOpen}
          appMode={state.appMode}
          activeOverride={state.activeOverride}
          toggleOverride={actions.toggleOverride}
          activeLogoUrl={state.activeLogoUrl}
          activeLogoName={state.activeLogo?.name}
          undo={actions.undo}
          redo={actions.redo}
          openProjector={actions.toggleProjector}
          toggleProjector={actions.toggleProjector}
          isProjectorLive={state.isProjectorLive}
          openGlobalModal={actions.openGlobalModal}
          isBibleSlide={state.isBibleSlide}
          onOpenRelay={handleOpenRelay}
          isRelayActive={isReceiverActive || isTransmitterConnected}
        />

        <StatusOverlay activeOverride={state.activeOverride} />

        {/* Receiver Status Badge (Top Right) */}
        <ReceiverStatusBadge onStop={handleStopReceiver} className={state.designPanelOpen ? "right-[336px]" : "right-4"} />

        {/* Transmitter Status Badge (Top Right) */}
        <TransmitterStatusBadge onOpenModal={handleOpenRelay} className={state.designPanelOpen ? "right-[336px]" : "right-4"} />

        {/* Multiverse Controls (Top Right) */}
        {(state.isMultiVerseMode || state.selectedVerses.length >= 2) && (
          <div className={cn(
            "absolute top-4 z-50 flex gap-2 animate-in fade-in slide-in-from-right-4 duration-500",
            state.designPanelOpen ? "right-[336px]" : "right-4"
          )}>
            {state.isMultiVerseMode ? (
              <button
                onClick={handleExitMultiVerse}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-2xl transition-all active:scale-95 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 backdrop-blur-xl"
              >
                <Trash2 className="w-4 h-4" />
                <span className="uppercase tracking-widest">{t('exit_mode', 'Exit Mode')}</span>
              </button>
            ) : (
              <button
                onClick={handleCommitToProjector}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-2xl transition-all active:scale-95 bg-accent hover:bg-accent-hover text-accent-foreground border border-accent/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="uppercase tracking-widest">
                  {t('send_to_projector', 'Send to projector')}
                </span>
                <span className="ml-1 opacity-50 font-medium">[Enter]</span>
              </button>
            )}
          </div>
        )}

        {/* Main Display Area */}
        <div className="flex-1 min-h-0 relative z-0">
          <SlideDisplay />
          {isPrivacyActive && (
            <div className="absolute inset-0 z-40 bg-stone-950/85 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wider text-white mb-2">
                {t('privacy_mode_active', 'Конфиденциальный режим активен')}
              </h3>
              <p className="text-sm text-stone-400 max-w-md">
                {t('privacy_mode_operator_hint', 'Экран спикера скрыт от предпросмотра оператора, но трансляция продолжается на церковном проекторе.')}
              </p>
            </div>
          )}
        </div>

        {/* Slide Timeline (Bottom) */}
        {timelineMode !== 'hidden' && (
          <SlideTimeline
            openProjector={actions.openProjector}
            isOpen={(state.appMode === 'presentation' || state.appMode === 'hymns') && !isPrivacyActive}
            timelineMode={timelineMode}
          />
        )}

        {/* Slide Design Panel — self-managed visibility via createPortal */}
        {state.appMode === 'presentation' && <SlideDesignPanel />}

        {/* Verse Previews (Contextual Bottom Left/Right) */}
        <VersePreviews
          appMode={state.appMode}
          lang={state.lang}
          prevVersePreview={state.prevVersePreview}
          nextVersePreview={state.nextVersePreview}
          setActiveVerse={actions.setActiveVerse}
        />
      </main>

      {state.historyOpen && (
        <div style={{ width: 300 }} className="h-full shrink-0 animate-in slide-in-from-right duration-300">
          <HistoryPanel />
        </div>
      )}

      {/* Global Modals & Feature Registry */}
      <AppModals
        settingsOpen={state.settingsOpen}
        setSettingsOpen={actions.setSettingsOpen}
        searchOpen={state.searchOpen}
        setSearchOpen={actions.setSearchOpen}
      />

      {/* Wireless Relay Modal */}
      <WirelessRelayModal
        isOpen={isRelayModalOpen}
        onClose={handleCloseRelay}
      />
    </div>
  );
};
