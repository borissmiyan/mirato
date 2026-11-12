import React from 'react';
import { 
    SidebarClose, SidebarOpen, Clock, Undo2, Redo2, 
    MonitorPlay, Palette, Square, Image as ImageIcon,
    Radio
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useTranslation } from 'react-i18next';
import { ModalType } from '@/core/store/modalStore';
import { OverrideType } from '@/core/store/uiAtoms';
import { AppMode } from '@/core/types';
import { Button } from '@/shared/ui/Button';

interface AppToolbarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    historyOpen: boolean;
    setHistoryOpen: (open: boolean) => void;
    designPanelOpen: boolean;
    setDesignPanelOpen: (open: boolean) => void;
    appMode: AppMode;
    activeOverride: OverrideType | null;
    toggleOverride: (type: OverrideType) => void;
    activeLogoUrl: string | null;
    activeLogoName?: string;
    undo: () => void;
    redo: () => void;
    openProjector?: () => void;
    toggleProjector?: () => void;
    isProjectorLive?: boolean;
    openGlobalModal: (type: ModalType) => void;
    isBibleSlide?: boolean;
    onOpenRelay?: () => void;
    isRelayActive?: boolean;
}

export const AppToolbar: React.FC<AppToolbarProps> = ({
    sidebarOpen,
    setSidebarOpen,
    historyOpen,
    setHistoryOpen,
    designPanelOpen,
    setDesignPanelOpen,
    appMode,
    activeOverride,
    toggleOverride,
    activeLogoUrl,
    activeLogoName,
    undo,
    redo,
    openProjector,
    toggleProjector,
    isProjectorLive = false,
    openGlobalModal,
    isBibleSlide,
    onOpenRelay,
    isRelayActive = false
}) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isCyrillic = ['ru', 'uk', 'bg', 'be'].includes(lang);

    const handleToggleSidebar = React.useCallback(() => setSidebarOpen(!sidebarOpen), [sidebarOpen, setSidebarOpen]);
    const handleToggleHistory = React.useCallback(() => setHistoryOpen(!historyOpen), [historyOpen, setHistoryOpen]);
    const handleToggleDesignPanel = React.useCallback(() => {
        if (isBibleSlide || appMode !== 'presentation') {
            setDesignPanelOpen(false);
            openGlobalModal(ModalType.CUSTOMIZATION);
        } else {
            setDesignPanelOpen(!designPanelOpen);
        }
    }, [appMode, designPanelOpen, setDesignPanelOpen, openGlobalModal, isBibleSlide]);
    const handleToggleBlackout = React.useCallback(() => toggleOverride('blackout'), [toggleOverride]);
    const handleToggleWhiteout = React.useCallback(() => toggleOverride('whiteout'), [toggleOverride]);
    const handleToggleLogo = React.useCallback(() => toggleOverride('logo'), [toggleOverride]);

    return (
        <div className={cn(
            "absolute top-4 left-4 z-50 flex items-center gap-2",
            designPanelOpen && "max-w-[calc(100%-344px)] overflow-x-auto no-scrollbar"
        )}>
            <Button
                size="sm"
                square
                variant="secondary"
                onClick={handleToggleSidebar}
                title={sidebarOpen ? t('hide_controls') : t('show_controls')}
            >
                {sidebarOpen ? <SidebarClose className="w-5 h-5" /> : <SidebarOpen className="w-5 h-5" />}
            </Button>

            {appMode === 'scripture' && (
                <Button
                    size="sm"
                    square
                    variant={historyOpen ? "primary" : "secondary"}
                    onClick={handleToggleHistory}
                    title={t('history')}
                >
                    <Clock className="w-5 h-5" />
                </Button>
            )}

            <div className="h-8 w-px bg-white/10 mx-1" />

            <Button
                size="sm"
                square
                variant="secondary"
                onClick={undo}
                title={`${t('undo', 'Undo')} (Cmd+Z)`}
            >
                <Undo2 className="w-5 h-5" />
            </Button>

            <Button
                size="sm"
                square
                variant="secondary"
                onClick={redo}
                title={`${t('redo', 'Redo')} (Cmd+Shift+Z)`}
            >
                <Redo2 className="w-5 h-5" />
            </Button>

            <div className="h-8 w-px bg-white/10 mx-1" />

            <Button
                size="sm"
                square
                variant={isProjectorLive ? "primary" : "secondary"}
                onClick={toggleProjector || openProjector}
                title={isProjectorLive
                    ? `${t('close_projector', 'Close Projector')} (Esc)`
                    : `${t('go_live', 'Go Live / Project')} (Enter)`
                }
            >
                <MonitorPlay className="w-5 h-5" />
            </Button>

            <Button
                size="sm"
                square
                variant={designPanelOpen && appMode === 'presentation' ? "primary" : "secondary"}
                onClick={handleToggleDesignPanel}
                title={t('customization')}
            >
                <Palette className="w-5 h-5" />
            </Button>

            {onOpenRelay && (
                <Button
                    size="sm"
                    square
                    variant={isRelayActive ? "primary" : "secondary"}
                    onClick={onOpenRelay}
                    title={t('wireless_display', 'AirDeck')}
                >
                    <Radio className="w-5 h-5" />
                </Button>
            )}

            {/* Emergency Modes Controls */}
            <div className="h-8 w-px bg-white/10 mx-1" />

            <Button
                size="sm"
                square
                variant={activeOverride === 'blackout' ? "danger" : "secondary"}
                onClick={handleToggleBlackout}
                className="relative group overflow-hidden"
                title={`${t('blackout', 'Black Out')} (B)`}
            >
                <Square className={cn(
                    "w-5 h-5 fill-current transition-transform", 
                    activeOverride === 'blackout' ? "scale-110 opacity-100 text-black" : "scale-90 opacity-10"
                )} />
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center text-xs font-black uppercase tracking-tighter",
                    activeOverride === 'blackout' ? "text-white" : "text-stone-400 group-hover:text-white"
                )}>
                    {isCyrillic ? 'Ч' : 'B'}
                </div>
            </Button>

            <Button
                size="sm"
                square
                variant={activeOverride === 'whiteout' ? "danger" : "secondary"}
                onClick={handleToggleWhiteout}
                className="relative group overflow-hidden"
                title={`${t('whiteout', 'White Out')} (W)`}
            >
                <Square className={cn(
                    "w-5 h-5 fill-current transition-transform", 
                    activeOverride === 'whiteout' ? "scale-110 opacity-100 text-white" : "scale-90 opacity-10"
                )} />
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center text-xs font-black uppercase tracking-tighter",
                    activeOverride === 'whiteout' ? "text-black font-black" : "text-stone-400 group-hover:text-white"
                )}>
                    {isCyrillic ? 'Б' : 'W'}
                </div>
            </Button>

            <Button
                size="sm"
                square
                variant={activeOverride === 'logo' ? "danger" : "secondary"}
                onClick={handleToggleLogo}
                className="relative group overflow-hidden"
                title={`${t('logo_mode', 'Show Logo')} (L)`}
            >
                {activeLogoUrl && activeLogoUrl !== '' ? (
                    <div className="w-5 h-5 rounded-sm overflow-hidden flex items-center justify-center">
                        <img src={activeLogoUrl} alt={activeLogoName || 'Logo'} className="w-full h-full object-contain" />
                    </div>
                ) : (
                    <>
                        <ImageIcon className={cn("w-5 h-5 transition-transform", activeOverride === 'logo' ? "scale-110 text-white" : "scale-90")} />
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center text-xs font-bold transition-opacity",
                            activeOverride === 'logo' ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-100 bg-black/40"
                        )}>
                            L
                        </div>
                    </>
                )}
            </Button>
        </div>
    );
};
