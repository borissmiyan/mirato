import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useHymnThemeEditorStore } from '../store/useHymnThemeEditorStore';
import { HymnTypographyPicker } from './HymnTypographyPicker';
import { BackgroundPicker } from '@/features/presenter/components/slide-properties/BackgroundPicker';
import { Save, RotateCcw, AlertTriangle, Copy, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/shared/ui/Button';

export const HymnDesignSettings: React.FC = () => {
    const { t } = useTranslation();
    const {
        draftTheme,
        loadedThemeId,
        isDirty,
        contextSlideId,
        saveTheme,
        confirmAndSaveTheme,
        resetTheme,
        updateBackground,
        loadTheme,
        forceCustomizeThisSlideOnly
    } = useHymnThemeEditorStore(
        useShallow(s => ({
            draftTheme: s.draftTheme,
            loadedThemeId: s.loadedThemeId,
            isDirty: s.isDirty,
            contextSlideId: s.contextSlideId,
            saveTheme: s.saveTheme,
            confirmAndSaveTheme: s.confirmAndSaveTheme,
            resetTheme: s.resetTheme,
            updateBackground: s.updateBackground,
            loadTheme: s.loadTheme,
            forceCustomizeThisSlideOnly: s.forceCustomizeThisSlideOnly,
        }))
    );

    // audit-ignore: local modal state isolated to this component
    const [showForkModal, setShowForkModal] = useState(false);
    const [usageWarning, setUsageWarning] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });
    const [isSaving, setIsSaving] = useState(false);

    if (!draftTheme) return null;

    const handleSaveClick = async () => {
        if (!isDirty) return;

        // Check if we auto-forked (id changed)
        if (loadedThemeId && draftTheme.id !== loadedThemeId) {
            setShowForkModal(true);
        } else {
            await performSave(false);
        }
    };

    const performSave = async (updateReferences: boolean) => {
        setIsSaving(true);
        try {
            const res = await saveTheme({ updateAllReferences: updateReferences });
            if (res.requiresUsageConfirmation && res.usageCount) {
                setUsageWarning({ show: true, count: res.usageCount });
            } else {
                setShowForkModal(false);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmUsageSave = async () => {
        setIsSaving(true);
        try {
            await confirmAndSaveTheme();
            setUsageWarning({ show: false, count: 0 });
            setShowForkModal(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCustomizeThisSlideOnlyClick = () => {
        forceCustomizeThisSlideOnly();
        setUsageWarning({ show: false, count: 0 });
    };

    const handleDiscard = () => {
        if (loadedThemeId) {
            loadTheme(loadedThemeId, { presentationId: useHymnThemeEditorStore.getState().contextPresentationId || undefined, slideId: contextSlideId || undefined });
        }
    };

    return (
        <div className="flex flex-col h-full bg-stone-950 text-white border-l border-white/10">
            {/* Header */}
            <div className="flex flex-col border-b border-white/10 shrink-0 bg-stone-900/50 p-4 gap-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{t('hymn_design.title', 'Hymn Theme Editor')}</h2>
                        <p className="text-sm text-stone-400">
                            {draftTheme.name} {draftTheme.isBuiltIn && <span className="text-amber-500 font-medium">(Built-in)</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDirty && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDiscard}
                                leftIcon={<RotateCcw className="w-4 h-4" />}
                            >
                                {t('common.discard', 'Discard')}
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={!isDirty || isSaving}
                            onClick={handleSaveClick}
                            leftIcon={<Save className="w-4 h-4" />}
                        >
                            {t('common.save', 'Save')}
                        </Button>
                    </div>
                </div>

                {/* Explicit Dual Actions: Edit Hymnal Theme vs Customize This Hymn Only */}
                {contextSlideId && (
                    <div className="flex items-center gap-2 pt-1">
                        <Button
                            variant="secondary"
                            size="xs"
                            onClick={handleCustomizeThisSlideOnlyClick}
                            leftIcon={<Copy className="w-3.5 h-3.5 text-amber-400" />}
                            className="flex-1"
                        >
                            {t('hymn_design.customize_this_only', 'Customize This Hymn Only')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Background Section */}
                <section>
                    <h3 className="text-sm font-semibold text-stone-300 uppercase tracking-widest mb-4">
                        {t('hymn_design.background', 'Background')}
                    </h3>
                    <div className="p-1 bg-stone-900 rounded-xl border border-white/5">
                        <BackgroundPicker
                            background={draftTheme.background}
                            onChange={(background) => updateBackground(background)}
                        />
                    </div>
                </section>

                {/* Typography Section */}
                <section>
                    <h3 className="text-sm font-semibold text-stone-300 uppercase tracking-widest mb-4">
                        {t('hymn_design.typography', 'Typography')}
                    </h3>
                    <div className="p-4 bg-stone-900 rounded-xl border border-white/5">
                        <HymnTypographyPicker />
                    </div>
                </section>
            </div>

            {/* Built-In Fork Modal */}
            {showForkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-stone-900 text-white border border-stone-800 rounded-2xl shadow-2xl w-full max-w-[425px] p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h2 className="text-lg font-semibold">{t('hymn_design.fork_modal.title', 'Theme Copied')}</h2>
                        </div>
                        <div className="text-sm text-stone-400 space-y-2 mb-6">
                            <p>{t('hymn_design.fork_modal.desc1', 'Because this is a built-in theme, your changes have been saved as a new custom copy.')}</p>
                            <p>{t('hymn_design.fork_modal.desc2', 'Would you like to apply this new theme to all existing hymns currently using the built-in theme?')}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => performSave(false)}
                                disabled={isSaving}
                            >
                                {t('hymn_design.fork_modal.save_only', 'No, just save new theme')}
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={() => performSave(true)}
                                disabled={isSaving}
                            >
                                {t('hymn_design.fork_modal.update_all', 'Yes, update existing hymns')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Multi-Location Shared Theme Usage Warning Modal */}
            {usageWarning.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-stone-900 text-white border border-stone-800 rounded-2xl shadow-2xl w-full max-w-[440px] p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Layers className="w-5 h-5 text-amber-500" />
                            <h2 className="text-lg font-semibold">{t('hymn_design.usage_modal.title', 'Update Shared Theme')}</h2>
                        </div>
                        <div className="text-sm text-stone-400 space-y-2 mb-6">
                            <p>
                                {t('hymn_design.usage_modal.desc', 'This theme is currently used across {{count}} locations (slides and hymnals). Updating it will alter the visual design for all of them.', { count: usageWarning.count })}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={handleCustomizeThisSlideOnlyClick}
                                disabled={isSaving}
                                className="border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            >
                                {t('hymn_design.usage_modal.fork_only', 'Fork for This Hymn Only')}
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={handleConfirmUsageSave}
                                disabled={isSaving}
                            >
                                {t('hymn_design.usage_modal.update_all', 'Update All {{count}} Locations', { count: usageWarning.count })}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HymnDesignSettings;
