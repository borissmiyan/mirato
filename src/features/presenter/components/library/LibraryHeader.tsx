import React from 'react';
import { TFunction } from 'i18next';
import { ChevronRight, Download, LayoutTemplate, Presentation, Music, Layers, type LucideIcon } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IPresentationBin } from '@/core/types';
import { ITemplateNav } from './LibraryTemplatesSection';
import { Button, Tooltip } from '@/shared/ui';

interface LibraryHeaderProps {
    graceLibSection: string | null;
    templateNavPath: ITemplateNav[];
    presentationBinNavPath: string[];
    presentationBins: IPresentationBin[];
    isRu: boolean;
    t: TFunction;
    setTemplateNavPath: (path: ITemplateNav[]) => void;
    setPresentationBinNavPath: (path: string[]) => void;
    handleImportClick: () => void;
}

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
    graceLibSection,
    templateNavPath,
    presentationBinNavPath,
    presentationBins,
    isRu,
    t,
    setTemplateNavPath,
    setPresentationBinNavPath,
    handleImportClick
}) => {
    return (
        <div className="p-4 border-b border-white/5 flex items-center gap-2 shrink-0 h-[60px] overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
                {graceLibSection === 'templates' && templateNavPath.map((nav, index) => (
                    <React.Fragment key={`${nav.id}-${index}`}>
                        {index > 0 && <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />}
                        <button
                            type="button"
                            onClick={() => setTemplateNavPath(templateNavPath.slice(0, index + 1))}
                            className={cn(
                                "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5",
                                index === templateNavPath.length - 1
                                    ? "text-stone-300 pointer-events-none"
                                    : "text-stone-600 hover:text-accent cursor-pointer active:scale-[0.97]"
                            )}
                        >
                            {index === 0 && <LayoutTemplate className="w-3.5 h-3.5" />}
                            {isRu ? nav.nameRu || nav.name : nav.name}
                        </button>
                    </React.Fragment>
                ))}

                {graceLibSection === 'presentations' && (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <button
                            type="button"
                            onClick={() => setPresentationBinNavPath([])}
                            className={cn(
                                "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5",
                                presentationBinNavPath.length === 0 ? "text-stone-300" : "text-stone-600 hover:text-accent cursor-pointer active:scale-[0.97]"
                            )}
                        >
                            <Presentation className="w-3.5 h-3.5" />
                            {t('grace_presentations', 'Grace Presentations')}
                        </button>
                        {presentationBinNavPath.map((binId, index) => {
                            const bin = presentationBins.find(b => b.id === binId);
                            if (!bin) return null;
                            return (
                                <React.Fragment key={binId}>
                                    <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />
                                    <button
                                        type="button"
                                        onClick={() => setPresentationBinNavPath(presentationBinNavPath.slice(0, index + 1))}
                                        className={cn(
                                            "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all",
                                            index === presentationBinNavPath.length - 1
                                                ? "text-stone-300 pointer-events-none"
                                                : "text-stone-600 hover:text-accent cursor-pointer active:scale-[0.97]"
                                        )}
                                    >
                                        {bin.name}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {graceLibSection === 'media' && (
                    <h3 className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-2">
                        <Music className="w-3.5 h-3.5" />
                        {t('grace_media', 'Grace Media')}
                    </h3>
                )}

                {!graceLibSection && (
                    <h3 className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        {t('grace_lib', 'GraceLib')}
                    </h3>
                )}
            </div>

            <Tooltip content={t('import_files_desc', 'Import presentations, templates, or media')} position="bottom" className="ml-auto shrink-0">
                <Button
                    size="xs"
                    variant="accent"
                    onClick={handleImportClick}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    className="shadow-lg shadow-accent/20"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest hidden @[200px]:block">{t('import', 'Import')}</span>
                </Button>
            </Tooltip>
        </div>
    );
};
