import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Image as ImageIcon, Lock, Plus, FolderOpen, ChevronDown, ChevronRight, AlertCircle, Library } from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { cn } from '@/core/utils/cn';
import { BackgroundPicker } from '@/features/presenter/components/slide-properties/BackgroundPicker';
import { SlideBackground } from '@/features/presenter/components/display/SlideBackground';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { useLogoSettings } from './logo/useLogoSettings';
import { LogoGrid } from './logo/LogoGrid';
import { CreateGroupDialog } from './logo/CreateGroupDialog';
import { LogoCard } from './logo/LogoCard';
import { IpcService } from '@/core/services/ipcService';
import { SegmentedControl, IconButton, Card, EmptyState } from '@/shared/ui';
import type { ILogo, ILogoGroup } from '@/core/types/media';
import type { PresenterSettings } from '@/core/types/settings';

type OverrideTab = 'blackout' | 'whiteout' | 'logo';

interface OverrideTabDefinition {
    id: OverrideTab;
    label: string;
    desc: string;
    locked?: boolean;
    icon: React.ComponentType<{ className?: string }> | React.ElementType;
}

const OverrideTabButton: React.FC<{
    tab: OverrideTabDefinition;
    isSelected: boolean;
    onSelect: (id: OverrideTab) => void;
    settings: PresenterSettings;
    logoUrl: string | null;
}> = React.memo(({ tab, isSelected, onSelect, settings, logoUrl }) => {
    const Icon = tab.icon;
    const handleClick = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);
    return (
        <button
            type="button"
            onClick={handleClick}
            className={cn(
                "flex-1 group relative flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden select-none active:scale-[0.98] will-change-transform",
                isSelected
                    ? "bg-accent/10 border-accent/30 shadow-lg ring-1 ring-accent/20"
                    : "bg-stone-900/40 border-white/5 hover:border-white/10 hover:bg-stone-900/60"
            )}
        >
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/5 shadow-inner">
                <SlideBackground background={settings.overrides[tab.id].background} />
                {tab.id === 'logo' && (
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                        ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                                <span className="text-[10px] font-black text-white/30">E</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                    <Icon className={cn(
                        "w-4 h-4 transition-colors",
                        isSelected ? "text-accent" : "text-stone-500"
                    )} />
                    <span className={cn(
                        "text-xs font-bold uppercase tracking-widest transition-colors",
                        isSelected ? "text-white" : "text-stone-400"
                    )}>
                        {tab.label}
                    </span>
                    {tab.locked && <Lock className="w-3 h-3 text-stone-600" />}
                </div>
                <p className="text-[10px] text-stone-600 font-medium mt-1">{tab.desc}</p>
            </div>

            {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />
            )}
        </button>
    );
});
OverrideTabButton.displayName = 'OverrideTabButton';

const OverrideGroupItem: React.FC<{
    group: ILogoGroup;
    isCollapsed: boolean;
    onToggle: (id: string) => void;
    activeLogoId: string | null;
    customGroups: ILogoGroup[];
    onSelect: (id: string) => void;
    onRemoveLogo: (groupId: string, logoId: string) => void;
    onMove: (logoId: string, targetGroupId: string | null) => void;
}> = React.memo(({ group, isCollapsed, onToggle, activeLogoId, customGroups, onSelect, onRemoveLogo, onMove }) => {
    const handleToggle = useCallback(() => onToggle(group.id), [onToggle, group.id]);
    const handleRemove = useCallback((logoId: string) => onRemoveLogo(group.id, logoId), [onRemoveLogo, group.id]);
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleToggle}
                    className="p-1 hover:bg-white/5 rounded cursor-pointer transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-3 h-3 text-stone-500" /> : <ChevronDown className="w-3 h-3 text-stone-500" />}
                </button>
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{group.name}</h4>
                <span className="text-[10px] text-stone-600 font-mono">({group.logos.length})</span>
            </div>
            {!isCollapsed && (
                <LogoGrid
                    logos={group.logos}
                    activeLogoId={activeLogoId}
                    onSelect={onSelect}
                    onRemove={handleRemove}
                    allGroups={customGroups}
                    onMove={onMove}
                />
            )}
        </div>
    );
});
OverrideGroupItem.displayName = 'OverrideGroupItem';

const OverridePreloadedLogoItem: React.FC<{
    logo: ILogo;
    isActive: boolean;
    onSelect: (id: string) => void;
    customGroups: ILogoGroup[];
    onMove: (logoId: string, targetGroupId: string | null) => void;
}> = React.memo(({ logo, isActive, onSelect, customGroups, onMove }) => {
    const handleSelect = useCallback(() => onSelect(logo.id), [onSelect, logo.id]);
    return (
        <LogoCard
            logo={logo}
            isActive={isActive}
            onSelect={handleSelect}
            allGroups={customGroups}
            onMove={onMove}
        />
    );
});
OverridePreloadedLogoItem.displayName = 'OverridePreloadedLogoItem';

const OverrideSettings: React.FC = () => {
    const { t } = useTranslation();
    const updateOverrideBackground = usePresenterStore(state => state.updateOverrideBackground);
    const [activeTab, setActiveTab] = useState<OverrideTab>('logo');
    const [logoSubTab, setLogoSubTab] = useState<'library' | 'background'>('library');

    const {
        settings,
        activeLogoId,
        customGroups,
        showCreateGroup,
        collapsedGroups,
        setShowCreateGroup,
        handleSelectFile,
        handleImportFolder,
        handleCreateGroup,
        toggleCollapse,
        handleRemoveFromGroup,
        removeCustomLogo,
        setActiveLogo,
        moveLogoToGroup,
    } = useLogoSettings();

    const handleCloseCreateGroup = useCallback(() => setShowCreateGroup(false), [setShowCreateGroup]);
    const handleSelectFileDirect = useCallback(() => handleSelectFile(), [handleSelectFile]);
    const handleImportFolderDirect = useCallback(() => handleImportFolder(), [handleImportFolder]);

    // Find active logo object
    const activeLogo = React.useMemo(() => {
        let resultLogo = null;
        if (activeLogoId) {
            // 1. Search preloaded
            for (const group of PRELOADED_LOGOS) {
                const found = group.logos.find(l => l.id === activeLogoId);
                if (found) { resultLogo = found; break; }
            }

            if (!resultLogo) {
                // 2. Search custom
                resultLogo = settings.logo.customLogos.find(l => l.id === activeLogoId) || null;
            }

            if (!resultLogo) {
                // 3. Search groups
                for (const group of settings.logo.customGroups || []) {
                    const found = group.logos.find(l => l.id === activeLogoId);
                    if (found) { resultLogo = found; break; }
                }
            }
        }
        return resultLogo;
    }, [activeLogoId, settings.logo]);

    const logoUrl = useLogoUrl(activeLogo);

    const tabs: { id: OverrideTab; icon: React.ElementType; label: string; desc: string; locked: boolean }[] = [
        { id: 'blackout', icon: Moon, label: t('blackout', 'Blackout'), desc: t('blackout_bg_desc', 'Always solid black'), locked: true },
        { id: 'whiteout', icon: Sun, label: t('whiteout', 'Whiteout'), desc: t('whiteout_bg_desc', 'Always solid white'), locked: true },
        { id: 'logo', icon: ImageIcon, label: t('logo_mode', 'Logo'), desc: t('logo_bg_desc', 'Customizable background'), locked: false },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Override Tabs */}
            <div className="flex gap-3">
                {tabs.map((tab) => (
                    <OverrideTabButton
                        key={tab.id}
                        tab={tab}
                        isSelected={activeTab === tab.id}
                        onSelect={setActiveTab}
                        settings={settings}
                        logoUrl={logoUrl}
                    />
                ))}
            </div>

            {/* Content area */}
            <Card padding="lg" rounded="xl" className="relative overflow-hidden flex flex-col min-h-[400px]">
                <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none" />

                <div className="relative z-10 flex-1 flex flex-col">
                    {activeTab === 'logo' ? (
                        <div className="flex flex-col h-full gap-6">
                            {/* Logo Sub-Tabs */}
                            <div className="flex items-center justify-between">
                                <SegmentedControl
                                    value={logoSubTab}
                                    onChange={(val) => setLogoSubTab(val as 'library' | 'background')}
                                    options={[
                                        { value: 'library', label: t('logo_library', 'Library'), icon: <Library className="w-3.5 h-3.5" /> },
                                        { value: 'background', label: t('background', 'Background'), icon: <ImageIcon className="w-3.5 h-3.5" /> },
                                    ]}
                                    size="sm"
                                />

                                {logoSubTab === 'library' && (
                                    <div className="flex gap-2">
                                        <IconButton
                                            icon={<Plus className="w-4 h-4" />}
                                            label={t('add_logo', 'Add Logo')}
                                            variant="surface"
                                            size="xs"
                                            onClick={handleSelectFileDirect}
                                        />
                                        <IconButton
                                            icon={<FolderOpen className="w-4 h-4" />}
                                            label={t('import_folder', 'Import Folder')}
                                            variant="surface"
                                            size="xs"
                                            onClick={handleImportFolderDirect}
                                        />
                                    </div>
                                )}
                            </div>

                            {logoSubTab === 'background' ? (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                            <ImageIcon className="w-4 h-4 text-accent" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white tracking-tight">
                                                {t('logo_mode', 'Logo')} {t('background', 'Background')}
                                            </h3>
                                            <p className="text-[10px] text-stone-600 font-medium">
                                                {t('override_bg_customize', 'Customize what appears on the projector')}
                                            </p>
                                        </div>
                                    </div>
                                    <BackgroundPicker
                                        background={settings.overrides.logo.background}
                                        onChange={(bg) => updateOverrideBackground('logo', bg)}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 overflow-y-auto max-h-[450px] pr-2 scrollbar-thin scrollbar-thumb-stone-800">
                                    {!IpcService.isElectron() && (
                                        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px]">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{t('electron_required_warning', 'System features require Desktop application.')}</span>
                                        </div>
                                    )}

                                    {showCreateGroup && (
                                        <CreateGroupDialog onSubmit={handleCreateGroup} onCancel={handleCloseCreateGroup} />
                                    )}

                                    {/* Library Content */}
                                    <div className="space-y-6">
                                        {(settings.logo.customLogos.length > 0 || customGroups.length > 0) ? (
                                            <>
                                                {settings.logo.customLogos.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{t('your_logos', 'Your Logos')}</h4>
                                                        <LogoGrid
                                                            logos={settings.logo.customLogos}
                                                            activeLogoId={activeLogoId}
                                                            onSelect={setActiveLogo}
                                                            onRemove={removeCustomLogo}
                                                            allGroups={customGroups}
                                                            onMove={moveLogoToGroup}
                                                        />
                                                    </div>
                                                )}

                                                {customGroups.map(group => (
                                                    <OverrideGroupItem
                                                        key={group.id}
                                                        group={group}
                                                        isCollapsed={collapsedGroups.has(group.id)}
                                                        onToggle={toggleCollapse}
                                                        activeLogoId={activeLogoId}
                                                        customGroups={customGroups}
                                                        onSelect={setActiveLogo}
                                                        onRemoveLogo={handleRemoveFromGroup}
                                                        onMove={moveLogoToGroup}
                                                    />
                                                ))}
                                            </>
                                        ) : (
                                            <EmptyState
                                                icon={ImageIcon}
                                                title={t('no_logos_added', 'No custom logos added yet')}
                                                size="sm"
                                            />
                                        )}

                                        {/* Preloaded Section */}
                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                            <h4 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('built_in_collections', 'Built-in Collections')}</h4>
                                            {PRELOADED_LOGOS.map((group) => (
                                                <div key={group.id} className="space-y-2">
                                                    <p className="text-[10px] font-bold text-stone-500">{group.name}</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {group.logos.map((logo) => (
                                                            <OverridePreloadedLogoItem
                                                                key={logo.id}
                                                                logo={logo}
                                                                isActive={activeLogoId === logo.id}
                                                                onSelect={setActiveLogo}
                                                                customGroups={customGroups}
                                                                onMove={moveLogoToGroup}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 h-full">
                            <div className={cn(
                                "w-20 h-20 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-transform",
                                activeTab === 'blackout'
                                    ? "bg-black border-stone-800"
                                    : "bg-white border-stone-200"
                            )}>
                                <Lock className={cn(
                                    "w-6 h-6",
                                    activeTab === 'blackout' ? "text-stone-700" : "text-stone-400"
                                )} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-stone-400">
                                    {activeTab === 'blackout' ? t('blackout_fixed', 'Fixed Black') : t('whiteout_fixed', 'Fixed White')}
                                </p>
                                <p className="text-[10px] text-stone-600 mt-1">
                                    {t('override_not_customizable', 'This override has a fixed color and cannot be customized')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default OverrideSettings;
