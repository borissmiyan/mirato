import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType, ModalState } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { X, Music, Plus, Import } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IMediaItem } from '@/core/types';
import { findOverlappingScopes } from '../../utils/timelineUtils';
import { IpcService } from '@/core/services/ipcService';
import { Button, IconButton, SearchInput } from '@/shared/ui';

interface AudioPickerModalContentProps {
    modalData: ModalState;
}

const AudioPickerModalContent: React.FC<AudioPickerModalContentProps> = ({ modalData }) => {
    const { t } = useTranslation();
    const closeModal = useModalStore(s => s.closeModal);
    const targetSlideId = modalData?.props?.targetSlideId as string | undefined;
    const onSelect = modalData?.props?.onSelect as ((ids: string[]) => void) | undefined;
    const multi = modalData?.props?.multi as boolean | undefined;

    const addAudioScope = usePresentationStore(s => s.addAudioScope);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const audioItems = useLiveQuery(
        () => {
            const baseQuery = db.mediaPool.where('type').equals('audio');
            if (!searchQuery.trim()) {
                return baseQuery.reverse().sortBy('createdAt');
            }
            return baseQuery
                .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .reverse()
                .sortBy('createdAt');
        },
        [searchQuery]
    ) || [];

    const handleSelect = async (item: IMediaItem) => {
        const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
        const stableId = await MediaPersistenceService.ensureMediaInDb(item);

        if (onSelect) {
            if (multi) {
                const newSelected = selectedIds.includes(stableId)
                    ? selectedIds.filter(id => id !== stableId)
                    : [...selectedIds, stableId];
                setSelectedIds(newSelected);
            } else {
                onSelect([stableId]);
                closeModal(ModalType.AUDIO_PICKER);
            }
            return;
        }

        if (targetSlideId) {
            const { activePresentation } = usePresentationStore.getState();
            if (activePresentation) {
                const slides = activePresentation.slides;
                const slideToIndexMap = new Map<string, number>();
                slides.forEach((s, idx) => slideToIndexMap.set(s.id, idx));

                const targetIdx = slides.findIndex(s => s.id === targetSlideId);
                const visualTimeline = slides.map(s => ({ slide: s }));
                const overlaps = findOverlappingScopes(targetIdx, targetIdx, visualTimeline, slideToIndexMap);

                if (overlaps.length > 0) {
                    const { openModal } = useModalStore.getState();
                    openModal(ModalType.AUDIO_CONFLICT, {
                        targetSlideId,
                        fileId: stableId,
                        overlappingScopes: overlaps
                    });
                } else {
                    await addAudioScope(targetSlideId, stableId, item.name);
                    closeModal(ModalType.AUDIO_PICKER);
                }
            }
        }
    };

    const handleConfirm = () => {
        if (onSelect && multi) {
            onSelect(selectedIds);
            closeModal(ModalType.AUDIO_PICKER);
        }
    };

    const handleImport = async () => {
        const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');

        if (IpcService.isElectron()) {
            try {
                const filePath = await IpcService.selectFile({
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }
                    ]
                });

                if (!filePath) return;

                const paths = Array.isArray(filePath) ? filePath : [filePath];
                const batchItems = paths.map(path => ({ path, type: 'audio' as const }));
                await MediaPersistenceService.importMediaBatch(batchItems);
                return;
            } catch (error) {
                console.error('Failed to import via Electron:', error);
            }
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*';

        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files) return;

            const batchItems = Array.from(files).map(file => ({
                file,
                path: (file as File & { path?: string }).path || null,
                type: 'audio' as const
            }));

            await MediaPersistenceService.importMediaBatch(batchItems);
        };

        input.click();
    };

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-6">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl apple-modal">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Music className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight uppercase">
                                {t('select_audio', 'Select Audio')}
                            </h2>
                            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                                {t('media_pool.title', 'Media Pool')}
                            </p>
                        </div>
                    </div>
                    <IconButton
                        icon={<X className="w-5 h-5" />}
                        label={t('close', 'Close')}
                        variant="surface"
                        size="xs"
                        onClick={() => closeModal(ModalType.AUDIO_PICKER)}
                    />
                </div>

                {/* Search & Actions */}
                <div className="p-4 border-b border-white/5 bg-stone-950/20 flex gap-2 items-center">
                    <div className="flex-1">
                        <SearchInput
                            placeholder={t('search_audio_placeholder', 'Search audio...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            size="sm"
                        />
                    </div>
                    <Button
                        size="xs"
                        variant="secondary"
                        onClick={handleImport}
                        leftIcon={<Import className="w-3.5 h-3.5" />}
                    >
                        {t('import', 'Import')}
                    </Button>
                </div>

                {/* Audio Grid */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                    {audioItems.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                                <Music className="w-8 h-8 text-stone-700" strokeWidth={1} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-stone-400">
                                    {searchQuery ? t('no_audio_results', 'No matches found') : t('media_pool_audio_empty', 'Media pool is empty')}
                                </p>
                                <p className="text-[10px] text-stone-600 uppercase tracking-widest mt-1">
                                    {searchQuery ? t('try_another_search', 'Try a different keyword') : t('import_audio_hint', 'Import audio files to get started')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {audioItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelect(item)}
                                    className={cn(
                                        "group w-full flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-purple-500/40 active:scale-[0.98] transition-all text-left cursor-pointer will-change-transform select-none",
                                        selectedIds.includes(item.id) ? "border-purple-500/50 bg-purple-500/5" : "hover:bg-purple-500/5"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform",
                                        selectedIds.includes(item.id)
                                            ? "bg-purple-500 text-white border-purple-400"
                                            : "bg-purple-500/20 text-purple-500 border-purple-500/20 group-hover:scale-105"
                                    )}>
                                        <Music className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={cn(
                                            "block text-xs font-bold transition-colors truncate",
                                            selectedIds.includes(item.id) ? "text-purple-400" : "text-stone-200 group-hover:text-purple-400"
                                        )}>
                                            {item.name}
                                        </span>
                                        <span className="block text-[9px] font-bold text-stone-600 uppercase tracking-widest mt-0.5 truncate">
                                            {item.path}
                                        </span>
                                    </div>
                                    {multi ? (
                                        <div className={cn(
                                            "w-5 h-5 rounded-xl border transition-all flex items-center justify-center",
                                            selectedIds.includes(item.id)
                                                ? "bg-purple-500 border-purple-400 shadow-lg shadow-purple-500/20"
                                                : "border-white/10 group-hover:border-purple-500/40"
                                        )}>
                                            {selectedIds.includes(item.id) && <div className="w-2 h-2 bg-white rounded-full shadow-inner" />}
                                        </div>
                                    ) : (
                                        <Plus className="w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex justify-end gap-3 shrink-0">
                    <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => closeModal(ModalType.AUDIO_PICKER)}
                    >
                        {t('cancel', 'Cancel')}
                    </Button>
                    {multi && (
                        <Button
                            size="xs"
                            variant="primary"
                            disabled={selectedIds.length === 0}
                            onClick={handleConfirm}
                        >
                            {t('add_selected', 'Add Selected')} ({selectedIds.length})
                        </Button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const AudioPickerModal: React.FC = () => {
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.AUDIO_PICKER))
    );
    if (!modalData) return null;
    return <AudioPickerModalContent modalData={modalData} />;
};

export default AudioPickerModal;
