import { useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { IpcService } from '@/core/services/ipcService';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { useLoadingStore } from '@/core/store/loadingStore';
import { db } from '@/core/db';
import { hymnLibraryService } from '@/features/hymns/services/hymnLibraryService';
import { hymnThemeService } from '@/features/hymns/services/hymnThemeService';
import { toast } from 'sonner';
import i18n from '@/core/i18n';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { ErrorLoggingService } from '@/core/services/errorLoggingService';

/**
 * Hook to handle application-level initialization logic.
 * Seeds templates, initializes store state from persisted IDs, and syncs theme.
 * Reports progress to the global LoadingScreen.
 */
export function useAppInitialization(themeAccent: string) {
    const setPhase = useLoadingStore(s => s.setPhase);
    const setProgress = useLoadingStore(s => s.setProgress);
    const setLoaded = useLoadingStore(s => s.setLoaded);

    useEffect(() => {
        const performInit = async () => {
            try {
                // Phase 1: Database Initialization
                setPhase('database');
                setProgress(10);
                await db.waitForFullReady();
                setProgress(30);

                // Phase 2: Template Seeding
                setPhase('templates');
                if (IpcService.isElectron()) {
                    await IpcService.templates.seedBundled();
                }
                setProgress(50);
                await EktmpService.syncFileSystemTemplates();
                setProgress(70);

                // Phase 3: Font Warming
                setPhase('fonts');
                // Ensure browser has registered the font faces
                await document.fonts.ready;
                setProgress(85);
                
                // Extra tick for smooth UI transition
                await new Promise(r => setTimeout(r, 300));

                // Phase 4: Store State Restoration
                const { 
                    activeServiceId, 
                    activePresentationId, 
                    selectedPresentationId, 
                    setActiveService, 
                    setActivePresentation, 
                    activeService, 
                    activePresentation, 
                    selectedPresentation 
                } = usePresentationStore.getState();

                if (activeServiceId && !activeService) {
                    await setActiveService(activeServiceId);
                }
                setProgress(90);

                if (activePresentationId && !activePresentation) {
                    await setActivePresentation(activePresentationId);
                }
                setProgress(95);

                if (selectedPresentationId && !selectedPresentation && selectedPresentationId !== activePresentationId) {
                    const { setPreviewSlide } = usePresentationStore.getState();
                    const previewSlideId = usePresentationStore.getState().previewSlideId;
                    setPreviewSlide(previewSlideId, selectedPresentationId);
                }

                // Phase 5: Hymn Theme Init (fast) — full hymnal filesystem sync runs in background
                // so importing 5,000+ bundled hymns never blocks the splash screen.
                await hymnThemeService.initializeDefaultTheme();

                // Dev-only: auto-import full 385-hymn .mrt service on Electron localhost
                if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
                    const fullServiceName = 'Гимны Надежды (1–385)';
                    const pilotServiceName = 'Гимны Надежды (пилот 67–74)';
                    const seedVersion = 'full-385-v2';
                    const installedVersion = localStorage.getItem('dev-full-hymns-ver');
                    const existingFull = await db.serviceFiles
                        .filter(s => s.name === fullServiceName)
                        .first();

                    if (!existingFull || installedVersion !== seedVersion) {
                        try {
                            const oldPilot = await db.serviceFiles
                                .filter(s => s.name === pilotServiceName)
                                .first();
                            if (oldPilot) {
                                await db.audioScopes.where('presentationId').anyOf(oldPilot.presentationIds).delete();
                                await db.presentationFiles.where('id').anyOf(oldPilot.presentationIds).delete();
                                await db.serviceFiles.delete(oldPilot.id);
                            }
                            if (existingFull) {
                                await db.audioScopes.where('presentationId').anyOf(existingFull.presentationIds).delete();
                                await db.presentationFiles.where('id').anyOf(existingFull.presentationIds).delete();
                                await db.serviceFiles.delete(existingFull.id);
                            }

                            const res = await fetch(`/__dev-hymns-full.mrt?v=${seedVersion}`);
                            if (res.ok) {
                                const blob = await res.blob();
                                const { EktService } = await import('@/features/presenter/services/ektService');
                                const pending = await EktService.prepareImport(blob, (info) => {
                                    if (info.total > 0) {
                                        const frac = info.current / info.total;
                                        const pct = info.phase === 'media'
                                            ? Math.round(70 + frac * 15)
                                            : Math.round(85 + frac * 12);
                                        setProgress(Math.min(98, pct));
                                    }
                                });
                                const importedId = await EktService.commitImport(
                                    pending,
                                    pending.conflict ? 'replace' : 'create_new'
                                );
                                localStorage.setItem('dev-full-hymns-ver', seedVersion);
                                await usePresentationStore.getState().setActiveService(importedId);
                            }
                        } catch (seedErr) {
                            console.warn('[DevFullHymns] Failed to auto-import 1-385 .mrt service:', seedErr);
                        }
                    }
                }

                // Phase 6: Maintenance (Log Rotation - 30 days & Auto Disaster Recovery Backup)
                ErrorLoggingService.clearOldLogs(30).catch(e => console.warn('[ErrorLogs] Rotation failed:', e));
                import('@/core/services/autoBackupService').then(({ AutoBackupService }) => {
                    AutoBackupService.runScheduledBackup().catch(e => console.warn('[AutoBackup] Check failed:', e));
                });

                // Final Step: Complete — enter app immediately, sync hymnals reactively in background
                setPhase('ready');
                setProgress(100);
                setTimeout(() => setLoaded(true), 300);

                // Background Hymn Library Sync (non-blocking; Dexie useLiveQuery updates UI as hymnals load)
                hymnLibraryService.syncFileSystemHymnals()
                    .then(({ orphanScopeIds }) => {
                        // Pre-warm lightweight in-memory hymn index (~2-3 MB) so opening HymnPickerModal is instant
                        import('@/features/hymns/services/hymnIndexCache')
                            .then(({ ensureHymnIndexLoaded }) => ensureHymnIndexLoaded())
                            .catch(() => {});
                        if (orphanScopeIds.length > 0) {
                            toast.warning(i18n.t('hymns.sync.orphan_scopes_warning', {
                                count: orphanScopeIds.length,
                            }), {
                                duration: 8000,
                                description: i18n.t('hymns.sync.orphan_scopes_description'),
                                action: {
                                    label: i18n.t('hymns.sync.view_orphans_btn'),
                                    onClick: () => useModalStore.getState().openModal(ModalType.ORPHAN_AUDIO_SCOPES),
                                },
                            });
                        }
                    })
                    .catch(e => console.warn('[HymnSync] Background hymnal sync failed:', e));
                
            } catch (err) {
                console.error('Application initialization failed:', err);
                // Even on error, we must eventually hide the screen or show a crash screen.
                // For now, we allow it to complete so the user isn't stuck.
                setLoaded(true);
            }
        };

        performInit();
    }, [setPhase, setProgress, setLoaded]);

    // Sync theme accent to the document (immediate)
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeAccent);
    }, [themeAccent]);
}
