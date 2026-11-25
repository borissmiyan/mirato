import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Presentation, FileText, FileSpreadsheet } from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { exportPresentationAs } from '../../services/export/presentationExportService';

interface PresentationExportMenuProps {
    x: number;
    y: number;
    presentationId: string;
    onExportMrtp: (id: string) => void;
    onClose: () => void;
}

/**
 * Context menu displayed on right-clicking the Export button of a presentation,
 * letting the user choose between MRTP, PowerPoint (.pptx), PDF (.pdf), and OpenDocument (.odp).
 */
export const PresentationExportMenu: React.FC<PresentationExportMenuProps> = ({
    x,
    y,
    presentationId,
    onExportMrtp,
    onClose,
}) => {
    const { t } = useTranslation();

    return (
        <ContextMenu x={x} y={y} onClose={onClose}>
            <ContextMenuItem
                icon={<Upload className="w-3 h-3" />}
                label={t('export_mrtp', 'Экспорт в MRTP (.mrtp)')}
                onClick={() => {
                    onExportMrtp(presentationId);
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<Presentation className="w-3 h-3" />}
                label={t('export_pptx', 'Экспорт в PowerPoint (.pptx)')}
                onClick={() => {
                    void exportPresentationAs(presentationId, 'pptx');
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<FileText className="w-3 h-3" />}
                label={t('export_pdf', 'Экспорт в PDF (.pdf)')}
                onClick={() => {
                    void exportPresentationAs(presentationId, 'pdf');
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<FileSpreadsheet className="w-3 h-3" />}
                label={t('export_odp', 'Экспорт в OpenDocument (.odp)')}
                onClick={() => {
                    void exportPresentationAs(presentationId, 'odp');
                    onClose();
                }}
            />
        </ContextMenu>
    );
};
