import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { fontInstallerService } from '@/core/services/fontInstallerService';
import { resolveFontFamily } from '@/core/utils/fontResolver';
import { ICanvasSlide, INestedSlide, ICanvasItem } from '@/core/types';

/**
 * Ensures that fonts used in the current presentation (and others) are "active" in the browser.
 * This prevents layout shifts and incorrect useTextFit measurements that happen
 * when a font is used for the first time and the browser hasn't "warmed it up".
 */
export const FontPrewarmer: React.FC = () => {
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const activePresentation = usePresentationStore(s => s.activePresentation);

    // Fetch only the active presentation and any expanded children to get fonts
    const presentations = useLiveQuery(async () => {
        if (!activePresentationId) return [];
        
        // Use the store presentation if it's already matches the active ID (optimization)
        const rootPres = (activePresentation?.id === activePresentationId) 
            ? activePresentation 
            : await db.presentationFiles.get(activePresentationId);
            
        if (!rootPres) return [];

        const expandedIds = rootPres.slides
            .filter(s => s.isExpanded)
            .map(s => {
                const ns = s as { presentationId?: string; masterPresentationId?: string };
                return ns.presentationId || ns.masterPresentationId;
            })
            .filter(Boolean) as string[];

        if (expandedIds.length === 0) return [rootPres];

        const children = await db.presentationFiles.where('id').anyOf(expandedIds).toArray();
        return [rootPres, ...children];
    }, [activePresentationId, activePresentation?.slides]);

    const uniqueFonts = useMemo(() => {
        const fonts = new Set<string>();
        // Add default app fonts
        fonts.add('Inter');

        if (presentations && presentations.length > 0) {
            presentations.forEach(pres => {
                pres.slides.forEach(slide => {
                    if (slide.type === 'normal') {
                        (slide as ICanvasSlide).content.canvasItems?.forEach((item: ICanvasItem) => {
                            if (item.text?.fontFamily) {
                                fonts.add(item.text.fontFamily);
                            }
                        });
                    }
                });
            });
        }

        return Array.from(fonts);
    }, [presentations]);

    // Ensure all presentation fonts are registered in document.fonts and loaded
    React.useEffect(() => {
        if (presentations && presentations.length > 0) {
            presentations.forEach(pres => {
                fontInstallerService.ensurePresentationFonts(pres).catch(err => {
                    console.warn('[FontPrewarmer] Error ensuring fonts:', err);
                });
            });
        }
    }, [presentations]);

    if (uniqueFonts.length === 0) return null;

    return (
        <div
            aria-hidden="true"
            className="fixed opacity-0 pointer-events-none -z-50"
            style={{
                visibility: 'hidden',
                whiteSpace: 'nowrap',
                height: 0,
                width: 0,
                overflow: 'hidden'
            }}
        >
            {uniqueFonts.map(font => {
                const stack = resolveFontFamily(font).cssFontStack;
                return (
                    <span key={font} style={{ fontFamily: stack }}>
                        Font Prewarm {font}
                    </span>
                );
            })}
        </div>
    );
};
