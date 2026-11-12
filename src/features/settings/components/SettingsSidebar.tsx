import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Database, Monitor, Info, Layers, Command, Smartphone } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface SettingsSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, setActiveTab }) => {
    const { t } = useTranslation();
    const tabs = [
        { id: 'general', label: t('general'), icon: Globe, description: t('appearance') },
        { id: 'displays', label: t('displays'), icon: Monitor, description: t('displays_description') },
        { id: 'data', label: t('data'), icon: Database, description: t('bible_translations') },
        { id: 'overrides', label: t('overrides', 'Overrides'), icon: Layers, description: t('overrides_description', 'Black, white & logo screens') },
        { id: 'shortcuts', label: t('shortcuts', 'Shortcuts'), icon: Command, description: t('hotkeys_overview', 'App keyboard shortcuts') },
        { id: 'remote', label: t('remote_control_title', 'Remote Control'), icon: Smartphone, description: t('remote_control_desc', 'Connect your mobile device to control presentation') },
        { id: 'stage', label: t('stage_screen_title', 'Stage Screen'), icon: Monitor, description: t('stage_screen_desc', 'Layout for the stage monitor') },
        { id: 'about', label: t('about_app'), icon: Info, description: t('about_description') },
    ];

    return (
        <div className="w-72 bg-stone-950/40 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 gap-6 relative overflow-hidden select-none">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />

            <div className="space-y-2 relative z-10">
                <div className="px-4 mb-6">
                    <h1 className="text-xl font-bold bg-linear-to-r from-white to-stone-500 bg-clip-text text-transparent">
                        {t('settings')}
                    </h1>
                    <p className="text-[10px] text-stone-500 uppercase tracking-[0.2em] mt-1 font-semibold">
                        {t('settings_system_config')}
                    </p>
                </div>

                <div className="space-y-1.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "w-full group relative flex flex-col items-start gap-1 px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer text-left apple-press will-change-transform",
                                    isActive
                                        ? "bg-white/10 text-white ring-1 ring-white/15 shadow-lg font-bold"
                                        : "text-stone-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                                        isActive ? "bg-accent shadow-[0_0_15px_var(--accent-glow)]" : "bg-stone-900 group-hover:bg-stone-800"
                                    )}>
                                        <Icon className={cn("w-4 h-4", isActive ? "text-accent-foreground" : "text-stone-400")} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold tracking-tight">{tab.label}</span>
                                        <span className="text-[10px] opacity-60 font-medium">{tab.description}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SettingsSidebar;
