import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';
import { EktpService } from '../ektpService';
import { PptxExportService } from './pptxExportService';
import { PdfExportService } from './pdfExportService';
import { OdpExportService } from './odpExportService';
import { sanitizeFilename, saveExportedFile } from './presentationExportUtils';

export type PresentationExportFormat = 'mrtp' | 'pptx' | 'pdf' | 'odp';

const FORMAT_META: Record<PresentationExportFormat, { ext: string; label: string; mime: string }> = {
    mrtp: {
        ext: 'mrtp',
        label: 'Mirato Presentation (.mrtp)',
        mime: 'application/zip',
    },
    pptx: {
        ext: 'pptx',
        label: 'PowerPoint Presentation (.pptx)',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    },
    pdf: {
        ext: 'pdf',
        label: 'PDF Document (.pdf)',
        mime: 'application/pdf',
    },
    odp: {
        ext: 'odp',
        label: 'OpenDocument Presentation (.odp)',
        mime: 'application/vnd.oasis.opendocument.presentation',
    },
};

/**
 * Exports a presentation in the requested format (.mrtp, .pptx, .pdf, or .odp)
 * and opens the native Save dialog (or browser download fallback).
 */
export async function exportPresentationAs(
    presentationId: string | null | undefined,
    format: PresentationExportFormat
): Promise<boolean> {
    if (!presentationId) {
        toast.error(i18n.t('no_active_presentation', 'Выберите презентацию для экспорта'));
        return false;
    }

    const meta = FORMAT_META[format];
    try {
        if (format === 'mrtp') {
            const pres = await db.presentationFiles.get(presentationId);
            if (!pres) return false;
            const { blob } = await EktpService.pack(pres.id);
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const saved = await saveExportedFile(
                bytes,
                `${sanitizeFilename(pres.name)}.mrtp`,
                meta.label,
                meta.ext,
                meta.mime
            );
            if (saved) {
                toast.success(i18n.t('export_success', 'Презентация экспортирована'), `${pres.name}.mrtp`);
            }
            return saved;
        }

        const result = format === 'pptx'
            ? await PptxExportService.exportBytes(presentationId)
            : format === 'pdf'
                ? await PdfExportService.exportBytes(presentationId)
                : await OdpExportService.exportBytes(presentationId);

        const filename = `${sanitizeFilename(result.name)}.${meta.ext}`;
        const saved = await saveExportedFile(result.data, filename, meta.label, meta.ext, meta.mime);
        if (saved) {
            toast.success(i18n.t('export_success', 'Презентация экспортирована'), filename);
        }
        return saved;
    } catch (error) {
        console.error(`[exportPresentationAs:${format}] Export failed:`, error);
        toast.error(i18n.t('export_error', 'Ошибка экспорта'));
        return false;
    }
}
