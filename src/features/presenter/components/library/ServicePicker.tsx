import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { db } from '@/core/db';
import { X, Plus, Check, Edit3, Trash2, Upload, Download, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { cn } from '@/core/utils/cn';
import { IServiceFile, IPresentationFile } from '@/core/types';
import { EktService } from '../../services/ektService';
import { toast } from '@/core/utils/toast';
import { getUniqueServiceName } from '@/core/utils/nameUtils';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SearchInput } from '@/shared/ui/SearchInput';
import { ServiceContextMenu } from './ServiceContextMenu';

interface ServicePickerProps {
    currentServiceId: string | null;
    onSelect: (serviceId: string) => void;
    onClose: () => void;
    triggerRect?: DOMRect | null;
    onServiceCreated?: (serviceId: string) => void;
}

const ServicePicker: React.FC<ServicePickerProps> = ({
    currentServiceId,
    onSelect,
    onClose,
    triggerRect,
    onServiceCreated
}) => {
    const { t, i18n } = useTranslation();
    const openModal = useModalStore(s => s.openModal);
    const [search, setSearch] = useState('');
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        service: IServiceFile;
    } | null>(null);
    const isRu = i18n.language?.substring(0, 2) === 'ru';

    const liveServices = useLiveQuery(() => db.serviceFiles.orderBy('updatedAt').reverse().toArray());
    const services = useMemo(() => liveServices || [], [liveServices]);
    const listRef = useRef<HTMLDivElement>(null);

    const filteredServices = useMemo(() => {
        if (!search) return services;
        const q = search.toLowerCase();
        return services.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.nameRu && s.nameRu.toLowerCase().includes(q))
        );
    }, [services, search]);

    // Position above trigger button (like TranslationPicker)
    const position = useMemo(() => {
        if (!triggerRect) return { bottom: '16px', left: '16px', width: '340px' };
        const spacing = 8;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const menuHeight = 520;
        const bottom = windowHeight - triggerRect.top + spacing;

        // Dynamic width based on service titles
        const maxNameLen = filteredServices.reduce((max, s) => {
            const title = isRu ? (s.nameRu || s.name) : s.name;
            return Math.max(max, title?.length || 0);
        }, 0);
        const contentWidth = Math.round(150 + maxNameLen * 8.5);
        const minWidth = Math.max(triggerRect.width, 320);
        const maxWidth = Math.min(Math.max(triggerRect.width * 2, 540), windowWidth - 32);
        const width = Math.min(Math.max(contentWidth, minWidth), maxWidth);

        let left = Math.max(16, triggerRect.left);
        if (left + width > windowWidth - 16) {
            left = Math.max(16, windowWidth - width - 16);
        }

        if (triggerRect.top < menuHeight + spacing) {
            return { top: triggerRect.bottom + spacing, left, width };
        }
        return { bottom, left, width };
    }, [triggerRect, filteredServices, isRu]);

    const handleCreateService = async () => {
        if (!newName.trim()) {
            setAddingNew(false);
            return;
        }

        const serviceId = crypto.randomUUID();
        const masterId = crypto.randomUUID();
        const now = new Date();

        const masterPres: IPresentationFile = {
            id: masterId,
            name: `${newName} (Master)`,
            serviceId,
            isMaster: true,
            createdAt: now,
            updatedAt: now,
            lastOpened: now,
            slides: []
        };
        await db.presentationFiles.add(masterPres);

        await db.serviceFiles.add({
            id: serviceId,
            name: newName,
            nameRu: newName,
            description: '',
            presentationIds: [masterId],
            masterPresentationId: masterId,
            createdAt: now,
            updatedAt: now,
            lastOpened: now
        });

        setNewName('');
        setAddingNew(false);

        if (onServiceCreated) {
            onServiceCreated(serviceId);
        }
    };

    const handleCancelAddNew = () => {
        setAddingNew(false);
        setNewName('');
    };

    const handleRenameService = async (id: string) => {
        if (!renameValue.trim()) {
            setRenamingId(null);
            return;
        }
        await db.serviceFiles.update(id, { name: renameValue, nameRu: renameValue });
        setRenamingId(null);
        setRenameValue('');
    };

    const handleSaveCurrentRename = () => {
        if (renamingId) handleRenameService(renamingId);
    };

    const handleDeleteService = async (id: string) => {
        openModal(ModalType.CONFIRM, {
            title: t('confirm_delete', 'Confirm Delete'),
            message: t('confirm_delete_service', 'Delete this service and all its presentations?'),
            variant: 'danger',
            onSelection: async (confirmed: boolean) => {
                if (confirmed) {
                    const service = await db.serviceFiles.get(id);
                    if (service) {
                        for (const presId of service.presentationIds) {
                            await db.presentationFiles.delete(presId);
                        }
                        await db.serviceFiles.delete(id);
                    }
                    toast.success(t('service_deleted', 'Service deleted'));
                }
            }
        });
    };

    const handleExportService = async (id: string) => {
        try {
            const service = await db.serviceFiles.get(id);
            if (!service) return;

            const blob = await EktService.pack(id);

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${service.name}.ekt`,
                        types: [{ description: 'Service File', accept: { 'application/zip': ['.ekt'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    await db.serviceFiles.update(id, { fileHandle: handle });
                    toast.success(t('export_success', 'Service exported'));
                    return;
                } catch (err: unknown) {
                    if (err instanceof Error && err.name === 'AbortError') return;
                }
            }
            EktService.download(blob, service.name);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(t('export_error', 'Export failed'));
        }
    };

    const handleImportService = async () => {
        try {
            if (!window.showOpenFilePicker) throw new Error('File System Access API not supported');
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Service File', accept: { 'application/zip': ['.ekt'] } }],
                multiple: false
            });
            const file = await handle.getFile();
            const pending = await EktService.prepareImport(file);

            if (pending.conflict) {
                openModal(ModalType.CONFIRM, {
                    title: t('import_conflict', 'Service already exists'),
                    message: t('import_conflict_message', 'A service with this ID already exists. Do you want to replace it or create a copy?'),
                    confirmLabel: t('replace', 'Replace'),
                    cancelLabel: t('create_copy', 'Create Copy'),
                    variant: 'warning',
                    onSelection: async (confirmed: boolean) => {
                        const resolution = confirmed ? 'replace' : 'create_new';
                        const newServiceId = await EktService.commitImport(pending, resolution);
                        if (onServiceCreated) onServiceCreated(newServiceId);
                        toast.success(t('import_success_ekt', 'Service imported'));
                        onClose();
                    }
                });
            } else {
                const newServiceId = await EktService.commitImport(pending, 'create_new');
                if (onServiceCreated) onServiceCreated(newServiceId);
                toast.success(t('import_success_ekt', 'Service imported'));
                onClose();
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error('Import failed:', error);
            toast.error(t('import_error', 'Import failed'));
        }
    };

    const rowVirtualizer = useVirtualizer({
        count: filteredServices.length,
        getScrollElement: () => listRef.current,
        estimateSize: () => 48,
        overscan: 5,
    });

    return createPortal(
        <div className="fixed inset-0 z-9999 pointer-events-none">
            <button
                type="button"
                aria-label={t('close_menu', 'Close menu')}
                className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-default pointer-events-auto"
                onClick={onClose}
            />

            <div
                className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[520px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                style={position}
            >
                {/* Header */}
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-stone-950/40">
                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        {t('services', 'Services')}
                    </h3>
                    <div className="flex items-center gap-1">
                        {!addingNew && (
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={() => setAddingNew(true)}
                                title={t('new_service', 'New Service')}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        <Button
                            size="xs"
                            square
                            variant="ghost"
                            onClick={onClose}
                            title={t('close_menu', 'Close menu')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-2 border-b border-white/5 bg-stone-950/20">
                    <SearchInput
                        size="xs"
                        autoFocus
                        placeholder={t('search_services', 'Search services...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClear={() => setSearch('')}
                    />
                </div>

                {/* New Service Inline Input */}
                {addingNew && (
                    <div className="p-2 border-b border-white/5 bg-stone-950/10">
                        <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                            <Input
                                size="xs"
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateService();
                                    if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                                }}
                                placeholder={t('service_name', 'Service Name...')}
                                className="flex-1"
                            />
                            <Button size="xs" square variant="primary" onClick={handleCreateService} title={t('create', 'Create')}>
                                <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="xs" square variant="ghost" onClick={handleCancelAddNew} title={t('cancel', 'Cancel')}>
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Services List */}
                <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 no-scrollbar min-h-0">
                    {filteredServices.length > 0 ? (
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const service = filteredServices[virtualRow.index];
                                if (!service) return null;
                                const isCurrent = currentServiceId === service.id;
                                const serviceTitle = isRu ? (service.nameRu || service.name) : service.name;

                                return (
                                    <div
                                        key={service.id}
                                        data-index={virtualRow.index}
                                        ref={rowVirtualizer.measureElement}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                            paddingBottom: '2px',
                                        }}
                                    >
                                        <div
                                            className={cn(
                                                "group w-full flex items-center justify-between p-2 rounded-xl transition-all text-left border cursor-pointer apple-press",
                                                isCurrent ? "bg-accent/10 border-accent/20" : "hover:bg-white/5 border-transparent hover:border-white/5"
                                            )}
                                            onClick={() => { if (renamingId !== service.id) { onSelect(service.id); onClose(); } }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setContextMenu({ x: e.clientX, y: e.clientY, service });
                                            }}
                                        >
                                            {renamingId === service.id ? (
                                                <div className="flex-1 flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                                                    <Input
                                                        size="xs"
                                                        autoFocus
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRenameService(service.id);
                                                            if (e.key === 'Escape') setRenamingId(null);
                                                        }}
                                                        className="flex-1"
                                                    />
                                                    <Button size="xs" square variant="ghost" onClick={handleSaveCurrentRename} title={t('save', 'Save')}>
                                                        <Check className="w-3.5 h-3.5 text-accent" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1 flex items-center gap-3 min-w-0">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                            isCurrent ? "bg-accent/20 text-accent" : "bg-stone-800/50 text-stone-600 group-hover:text-stone-400"
                                                        )}>
                                                            <Layers className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span
                                                                title={serviceTitle}
                                                                className={cn("text-xs font-bold truncate", isCurrent ? "text-accent" : "text-stone-300")}
                                                            >
                                                                {serviceTitle}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest leading-none mt-1">
                                                                {t('presentations_count', { count: service.presentationIds.length, defaultValue: '{{count}} presentations' })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <Button size="xs" square variant="ghost" onClick={(e) => { e.stopPropagation(); handleExportService(service.id); }} title={t('export_service', 'Export (.ekt)')}>
                                                            <Upload className="w-3.5 h-3.5 text-stone-400 hover:text-accent" />
                                                        </Button>
                                                        <Button size="xs" square variant="ghost" onClick={(e) => { e.stopPropagation(); setRenamingId(service.id); setRenameValue(service.name); }} title={t('rename', 'Rename')}>
                                                            <Edit3 className="w-3.5 h-3.5 text-stone-400" />
                                                        </Button>
                                                        <Button size="xs" square variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteService(service.id); }} title={t('delete', 'Delete')}>
                                                            <Trash2 className="w-3.5 h-3.5 text-stone-400 hover:text-red-400" />
                                                        </Button>
                                                    </div>

                                                    {isCurrent && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)] ml-2 shrink-0" />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                            <Layers className="w-8 h-8 text-stone-500" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">
                                {search ? t('no_results', 'No results') : t('no_services', 'No services yet')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer: Import */}
                <div className="p-2 border-t border-white/5 bg-stone-950/40 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-xs font-bold uppercase tracking-wider"
                        leftIcon={<Download className="w-4 h-4" />}
                        onClick={handleImportService}
                    >
                        {t('import_service', 'Import Service (.ekt)')}
                    </Button>
                </div>

                {contextMenu && (
                    <ServiceContextMenu
                        contextMenu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        setRenamingId={setRenamingId}
                        setRenameValue={setRenameValue}
                        handleExportService={handleExportService}
                        handleDeleteService={handleDeleteService}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

export default ServicePicker;
