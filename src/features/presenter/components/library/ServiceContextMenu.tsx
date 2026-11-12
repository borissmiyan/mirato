import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Copy,
    Edit3,
    Upload,
    Trash2
} from 'lucide-react';
import { IServiceFile } from '@/core/types';
import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import { getUniqueServiceName, getUniquePresentationName } from '@/core/utils/nameUtils';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';

interface ServiceContextMenuProps {
    contextMenu: {
        x: number;
        y: number;
        service: IServiceFile;
    };
    onClose: () => void;
    setRenamingId: (id: string | null) => void;
    setRenameValue: (val: string) => void;
    handleExportService: (id: string) => void;
    handleDeleteService: (id: string) => void;
}

export const ServiceContextMenu: React.FC<ServiceContextMenuProps> = ({
    contextMenu,
    onClose,
    setRenamingId,
    setRenameValue,
    handleExportService,
    handleDeleteService,
}) => {
    const { t } = useTranslation();

    const handleDuplicate = async () => {
        const serviceId = crypto.randomUUID();
        const now = new Date();
        const newName = await getUniqueServiceName(contextMenu.service.name);

        const duplicatedPresIds: string[] = [];
        let newMasterPresId = '';

        for (const presId of contextMenu.service.presentationIds) {
            const originalPres = await db.presentationFiles.get(presId);
            if (originalPres) {
                const clonePres = structuredClone(originalPres);
                clonePres.id = crypto.randomUUID();
                clonePres.serviceId = serviceId;
                clonePres.createdAt = now;
                clonePres.updatedAt = now;
                clonePres.lastOpened = now;
                
                if (originalPres.id === contextMenu.service.masterPresentationId) {
                    clonePres.name = `${newName} (Master)`;
                    clonePres.isMaster = true;
                    newMasterPresId = clonePres.id;
                } else {
                    clonePres.name = await getUniquePresentationName(originalPres.name);
                }
                await db.presentationFiles.add(clonePres);
                duplicatedPresIds.push(clonePres.id);
            }
        }

        await db.serviceFiles.add({
            id: serviceId,
            name: newName,
            nameRu: newName,
            description: contextMenu.service.description || '',
            presentationIds: duplicatedPresIds,
            masterPresentationId: newMasterPresId,
            createdAt: now,
            updatedAt: now,
            lastOpened: now
        });

        toast.success(t('service_duplicated', 'Service duplicated'));
        onClose();
    };

    return (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={onClose}
        >
            <ContextMenuItem
                icon={<Copy className="w-3 h-3" />}
                label={t('duplicate', 'Duplicate')}
                onClick={handleDuplicate}
            />
            <ContextMenuItem
                icon={<Edit3 className="w-3 h-3" />}
                label={t('rename', 'Rename')}
                onClick={() => {
                    setRenamingId(contextMenu.service.id);
                    setRenameValue(contextMenu.service.name);
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<Upload className="w-3 h-3" />}
                label={t('export', 'Export')}
                onClick={() => {
                    handleExportService(contextMenu.service.id);
                    onClose();
                }}
            />
            <div className="h-px bg-white/5 my-1 mx-2" />
            <ContextMenuItem
                icon={<Trash2 className="w-3 h-3" />}
                label={t('delete', 'Delete')}
                danger
                onClick={() => {
                    handleDeleteService(contextMenu.service.id);
                    onClose();
                }}
            />
        </ContextMenu>
    );
};
