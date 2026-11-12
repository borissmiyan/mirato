import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import { EktpService } from '../services/ektpService';
import { usePresentationStore } from '../store/presentationStore';

export const usePresentationManagement = (activeServiceId: string | null) => {
    const { t } = useTranslation();
    const {
        createPresentation,
        renamePresentation,
        setActiveService,
        setActivePresentation
    } = usePresentationStore(
        useShallow(s => ({
            createPresentation: s.createPresentation,
            renamePresentation: s.renamePresentation,
            setActiveService: s.setActiveService,
            setActivePresentation: s.setActivePresentation,
        }))
    );

    const handleCreatePresentation = async (name: string) => {
        if (!activeServiceId || !name.trim()) return;
        await createPresentation(name.trim(), { serviceId: activeServiceId, isMaster: false });
    };

    const handleRenamePresentation = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        await renamePresentation(id, newName.trim());
    };

    const handleAddTag = async (presentationId: string, newTag: string) => {
        const trimmed = newTag.trim();
        if (!trimmed) return;
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            const currentTags = pres.tags || [];
            if (currentTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
                toast.error(t('tag_exists', 'Tag already exists'));
                return;
            }
            const updated = [...currentTags, trimmed];
            await db.presentationFiles.update(presentationId, { tags: updated });
        }
    };

    const handleRemoveTag = async (presentationId: string, tagToRemove: string) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            const updated = (pres.tags || []).filter(t => t !== tagToRemove);
            await db.presentationFiles.update(presentationId, { tags: updated });
        }
    };

    const handleToggleStar = async (presentationId: string) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            await db.presentationFiles.update(presentationId, { isStarred: !pres.isStarred });
        }
    };

    const handleExportPresentation = async (id: string) => {
        try {
            const pres = await db.presentationFiles.get(id);
            if (!pres) return;

            const { blob } = await EktpService.pack(pres.id);

            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker?.({
                        suggestedName: `${pres.name}.ektp`,
                        types: [{ description: 'Presentation Package', accept: { 'application/zip': ['.ektp'] } }]
                    });
                    if (handle) {
                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        await db.presentationFiles.update(id, { fileHandle: handle });
                        toast.success(t('export_success', 'Presentation exported'), t('file_saved_to_disk', 'File saved to disk'));
                        return;
                    }
                } catch (err: unknown) {
                    if ((err as { name?: string })?.name === 'AbortError') return;
                }
            }
            EktpService.download(blob, pres.name);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(t('export_error', 'Export failed'));
        }
    };

    const handleImportPresentation = async () => {
        try {
            const handles = await window.showOpenFilePicker?.({
                types: [{
                    description: 'Presentation or PowerPoint',
                    accept: { 'application/zip': ['.ektp', '.pptx'] }
                }],
                multiple: false
            });
            const handle = handles?.[0];
            if (!handle) return;

            const file = await handle.getFile();

            if (file.name.endsWith('.ektp')) {
                const presentationId = await EktpService.unpack(file);
                const presentation = await db.presentationFiles.get(presentationId);

                if (presentation) {
                    const newId = `imported-${crypto.randomUUID()}`;
                    await db.presentationFiles.add({
                        ...presentation,
                        id: newId,
                        serviceId: activeServiceId || undefined,
                        updatedAt: new Date(),
                        fileHandle: handle
                    });

                    if (activeServiceId) {
                        const service = await db.serviceFiles.get(activeServiceId);
                        if (service) {
                            await db.serviceFiles.update(activeServiceId, {
                                presentationIds: [...service.presentationIds, newId]
                            });
                            await setActiveService(activeServiceId);
                            await setActivePresentation(newId);
                        }
                    }
                }
                toast.success(t('import_success_ektp', 'Presentation imported'), t('ready_to_present', 'Ready to use in your workflow'));
            } else if (file.name.endsWith('.pptx')) {
                const { PptxImportService } = await import('@/features/presenter/services/PptxImportService.ts');
                const presentation = await PptxImportService.convert(file);
                const newId = `imported-pptx-${crypto.randomUUID()}`;

                await db.presentationFiles.add({
                    ...presentation,
                    id: newId,
                    serviceId: activeServiceId || undefined,
                    updatedAt: new Date(),
                    fileHandle: handle
                });

                if (activeServiceId) {
                    const service = await db.serviceFiles.get(activeServiceId);
                    if (service) {
                        await db.serviceFiles.update(activeServiceId, {
                            presentationIds: [...service.presentationIds, newId]
                        });
                        await setActiveService(activeServiceId);
                        await setActivePresentation(newId);
                    }
                }
                toast.success(t('import_success_pptx', 'PowerPoint presentation imported'));
            }
        } catch (error) {
            console.error('Import failed:', error);
            toast.error(t('import_error', 'Import failed'));
        }
    };

    return {
        handleCreatePresentation,
        handleRenamePresentation,
        handleAddTag,
        handleRemoveTag,
        handleToggleStar,
        handleExportPresentation,
        handleImportPresentation,
    };
};
