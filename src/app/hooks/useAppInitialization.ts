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

                // Phase 5: Hymn Library Sync
                // Initialize built-in default theme (idempotent)
                await hymnThemeService.initializeDefaultTheme();
                // Sync hymnal manifests + covers from filesystem (no-op if no library dir set)
                const { orphanScopeIds } = await hymnLibraryService.syncFileSystemHymnals();
                
                if (orphanScopeIds.length > 0) {
                    toast.warning(i18n.t('hymns.sync.orphan_scopes_warning', {
                        count: orphanScopeIds.length,
                    }), {
                        duration: 8000,
                        description: i18n.t('hymns.sync.orphan_scopes_description'),
                        action: {
                            label: i18n.t('hymns.sync.view_orphans_btn'),
                            onClick: () => useModalStore.getState().openModal(ModalType.ORPHAN_AUDIO_SCOPES),
                        }
                    });
                }

                // Phase 6: Maintenance (Log Rotation - 30 days & Auto Disaster Recovery Backup)
                ErrorLoggingService.clearOldLogs(30).catch(e => console.warn('[ErrorLogs] Rotation failed:', e));
                import('@/core/services/autoBackupService').then(({ AutoBackupService }) => {
                    AutoBackupService.runScheduledBackup().catch(e => console.warn('[AutoBackup] Check failed:', e));
                });

                // Final Step: Complete
                setPhase('ready');
                setProgress(100);
                
                // Allow the "Ready" state to be seen slightly
                setTimeout(() => setLoaded(true), 600);
                
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
