import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tv, Cast, Monitor } from 'lucide-react';
import { cn } from '@/core/utils/cn';

export type RelayTabType = 'transmitter' | 'receiver' | 'deck_cast' | 'screen_stream';

export interface WirelessRelaySidebarProps {
    activeTab: RelayTabType;
    setActiveTab: (tab: RelayTabType) => void;
}

export const WirelessRelaySidebar: React.FC<WirelessRelaySidebarProps> = React.memo(({
    activeTab,
    setActiveTab
}) => {
    const { t } = useTranslation();

    const normalizedActiveTab = (activeTab === 'deck_cast' || activeTab === 'screen_stream') ? 'transmitter' : activeTab;

    const tabs: Array<{
        id: RelayTabType;
        label: string;
        ariaLabel: string;
        icon: typeof Cast | typeof Monitor;
        description: string;
    }> = [
        {
            id: 'transmitter',
            label: t('tab_transmitter', 'Трансляция'),
            ariaLabel: 'Транслировать экран',
            icon: Cast,
            description: t('tab_transmitter_desc', 'Слайды 4K и экран')
        },
        {
            id: 'receiver',
            label: t('tab_receiver', 'Приёмник'),
            ariaLabel: 'Принять трансляцию',
            icon: Monitor,
            description: t('tab_receiver_desc', 'Вывод на проектор зала')
        }
    ];

    return (
        <aside className="w-72 bg-stone-950/40 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 gap-6 relative overflow-hidden select-none shrink-0">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />

            <div className="space-y-2 relative z-10">
                <div className="px-4 mb-6">
                    <h1 className="text-xl font-bold bg-linear-to-r from-white to-stone-500 bg-clip-text text-transparent">
                        {t('wireless_display_title', 'AirDeck')}
                        <span className="sr-only">Беспроводной экран Deck.CE</span>
                    </h1>
                    <p className="text-[10px] text-stone-500 uppercase tracking-[0.2em] mt-1 font-semibold">
                        {t('wireless_display_subtitle', 'Беспроводная трансляция')}
                    </p>
                </div>

                <nav className="space-y-1.5" aria-label="AirDeck Navigation">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = normalizedActiveTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                aria-label={tab.ariaLabel}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "w-full group relative flex flex-col items-start gap-1 px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer text-left apple-press will-change-transform",
                                    isActive
                                        ? "bg-white/10 text-white ring-1 ring-white/15 shadow-lg font-bold"
                                        : "text-stone-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-3 w-full">
                                    <div className={cn(
                                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0",
                                        isActive 
                                            ? "bg-accent shadow-[0_0_15px_var(--accent-glow)] text-accent-foreground" 
                                            : "bg-stone-900 group-hover:bg-stone-800 text-stone-400"
                                    )}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-semibold tracking-tight">{tab.label}</span>
                                        <span className="text-[10px] opacity-60 font-medium">{tab.description}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
});

WirelessRelaySidebar.displayName = 'WirelessRelaySidebar';
