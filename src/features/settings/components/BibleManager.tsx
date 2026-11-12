import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { BibleService } from '@/core/services/bibleService';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useShallow } from 'zustand/react/shallow';
import { Trash2, CheckCircle, AlertCircle, Loader2, BookOpen, Plus, Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Translation } from '@/core/types';
import ParserWorker from '@/core/workers/parser.worker?worker';
import { zefaniaParser } from '@/core/parsers/zefaniaParser';
import { cn } from '@/core/utils/cn';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';

/**
 * Helper to highlight search matches
 */
const SearchHighlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  let content = <>{text}</>;
  if (query) {
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    content = (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="bg-accent/30 text-accent px-0.5 rounded-sm ring-1 ring-accent/20">{part}</mark>
            : part
        )}
      </>
    );
  }
  return content;
};

interface BibleRowProps {
  translation: Translation;
  isSelected: boolean;
  isSecondary: boolean;
  searchQuery: string;
  onSelect: () => void;
  onSelectSecondary: () => void;
  onDelete: (tId: string) => Promise<void>;
  onContextMenu: (e: React.MouseEvent, translation: Translation) => void;
}

const BibleRow: React.FC<BibleRowProps> = ({
  translation,
  isSelected,
  isSecondary,
  searchQuery,
  onSelect,
  onDelete,
  onContextMenu
}) => {
  const { t } = useTranslation();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <div
      onClick={() => !isConfirmingDelete && onSelect()}
      onContextMenu={(e) => onContextMenu(e, translation)}
      className={cn(
        "group/row relative w-full h-16 rounded-2xl px-4 flex items-center justify-between transition-all duration-200 cursor-pointer border apple-press",
        isSelected
          ? "bg-accent/10 border-accent/40 shadow-[0_0_20px_var(--accent-glow)] ring-1 ring-accent/20"
          : isSecondary
            ? "bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20"
            : "bg-stone-900/40 border-white/5 hover:border-white/10 hover:bg-stone-800/60"
      )}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className={cn(
          "p-2.5 rounded-xl shrink-0 transition-colors",
          isSelected ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "bg-stone-950 text-stone-500 group-hover/row:text-stone-300"
        )}>
          <BookOpen className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0">
          <h5 className={cn(
            "text-sm font-bold tracking-tight truncate transition-colors",
            isSelected ? "text-accent" : "text-stone-200"
          )}>
            <SearchHighlight text={translation.name} query={searchQuery} />
          </h5>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-500 truncate uppercase tracking-widest">
              <SearchHighlight text={translation.version || t('unknown_version')} query={searchQuery} />
            </span>
            {isSelected && (
              <span className="text-[10px] font-bold text-accent/80 uppercase tracking-widest flex items-center gap-1">
                <Plus className="w-2.5 h-2.5 rotate-45" /> {t('active')}
              </span>
            )}
            {isSecondary && (
              <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest flex items-center gap-1">
                <Plus className="w-2.5 h-2.5 rotate-45" /> {t('secondary', 'Secondary')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {isConfirmingDelete ? (
          <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              size="xs"
              onClick={(e) => { e.stopPropagation(); onDelete(translation.id); }}
            >
              {t('confirm_delete')}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            square
            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
            className="opacity-0 group-hover/row:opacity-100 text-stone-500 hover:text-red-400 hover:bg-red-500/10"
            title={t('delete')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const BibleManager: React.FC = () => {
  const { t } = useTranslation();
  const { currentTranslationId, secondTranslationId, setTranslation, setSecondTranslation } = useBibleStore(useShallow(state => ({
    currentTranslationId: state.currentTranslationId,
    secondTranslationId: state.secondTranslationId,
    setTranslation: state.setTranslation,
    setSecondTranslation: state.setSecondTranslation
  })));
  const liveTranslations = useLiveQuery(() => BibleService.getAllTranslations());
  const translations = useMemo(() => liveTranslations || [], [liveTranslations]);

  const [searchQuery, setSearchQuery] = useState('');
  const [openLangs, setOpenLangs] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; translation: Translation } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grouping & Filtering Logic
  const groupedData = useMemo(() => {
    const filtered = translations.filter(tr =>
      tr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tr.version && tr.version.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const groups: Record<string, typeof translations> = {};
    filtered.forEach(tr => {
      const lang = tr.language || t('unknown_lang');
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push(tr);
    });

    const sortedLangs = Object.keys(groups).sort();
    return { groups, sortedLangs, totalFound: filtered.length };
  }, [translations, searchQuery, t]);

  const toggleLang = (lang: string) => {
    setOpenLangs(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    setError(null);
    let importedCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length, filename: file.name });
        let importedTranslationId: string | null = null;

        if (file.name.toLowerCase().endsWith('.xml')) {
          try {
            const text = await file.text();
            const data = await zefaniaParser.parse(text, file.name);
            await BibleService.saveBibleData(data);
            importedTranslationId = data.translation?.id ?? null;
          } catch (e: unknown) {
            throw new Error(`XML Import Error: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (file.name.toLowerCase().match(/\.sqlite3?$/)) {
          const worker = new ParserWorker();
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const safeResolve = () => { if (!settled) { settled = true; resolve(); } };
            const safeReject = (err: unknown) => { if (!settled) { settled = true; reject(err); } };

            worker.onmessage = async (msg) => {
              const { type, data, error: workerErr } = msg.data;
              try {
                if (type === 'metadata') {
                  await BibleService.saveTranslationAndBooks(data.translation, data.books);
                  importedTranslationId = data.translation.id;
                } else if (type === 'chunk') {
                  await BibleService.saveVerseChunk(data);
                } else if (type === 'success') {
                  worker.terminate();
                  safeResolve();
                } else if (type === 'error') {
                  throw new Error(workerErr);
                }
              } catch (err) {
                worker.terminate();
                safeReject(err);
              }
            };
            worker.onerror = (err) => { worker.terminate(); safeReject(err); };

            file.arrayBuffer().then(buffer => worker.postMessage({ fileType: 'sqlite', content: buffer, fileName: file.name }));
          });
        } else {
          throw new Error(t('unsupported_format', 'Unsupported format'));
        }

        if (importedTranslationId) {
          db.reindexTranslationVerses(importedTranslationId);
        }

        importedCount++;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import_failed', 'Import failed'));
    } finally {
      setImporting(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (tId: string) => {
    await BibleService.deleteTranslation(tId);
    if (currentTranslationId === tId) {
      const others = await BibleService.getAllTranslations();
      if (others.length > 0) setTranslation(others[0].id);
    }
    if (secondTranslationId === tId) {
      setSecondTranslation(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, translation: Translation) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      translation
    });
  };

  return (
    <div className="space-y-6">
      {/* Header / Search / Import Row */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            size="md"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder={t('search_bibles_placeholder')}
            className="flex-1"
          />

          <Button
            variant="primary"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="shrink-0 shadow-lg shadow-accent/20"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {importing ? t('importing') : t('import_bibles')}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleImport} multiple accept=".xml,.sqlite,.sqlite3" />
          </Button>
        </div>

        {importing && progress && (
          <div className="bg-accent/10 border border-accent/20 rounded-2xl p-3.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-accent animate-pulse">
            <span>{t('importing_filename', { filename: progress.filename })}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bible List Accordions */}
      <div className="space-y-4">
        {groupedData.sortedLangs.map(lang => (
          <div key={lang} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleLang(lang)}
              className="w-full flex items-center justify-between px-2 py-1.5 group/header cursor-pointer apple-press"
            >
              <div className="flex items-center gap-2">
                {openLangs.includes(lang) ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronRight className="w-4 h-4 text-stone-400" />}
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] group-hover/header:text-stone-200 transition-colors">
                  {lang}
                  <span className="ml-2 opacity-50 font-mono">({groupedData.groups[lang].length})</span>
                </span>
              </div>
              <div className="h-px flex-1 bg-white/5 ml-4" />
            </button>

            {(openLangs.includes(lang) || searchQuery) && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                {groupedData.groups[lang].map(tr => (
                  <BibleRow
                    key={tr.id}
                    translation={tr}
                    isSelected={currentTranslationId === tr.id}
                    isSecondary={secondTranslationId === tr.id}
                    searchQuery={searchQuery}
                    onSelect={() => setTranslation(tr.id)}
                    onSelectSecondary={() => setSecondTranslation(tr.id)}
                    onDelete={handleDelete}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {translations.length > 0 && groupedData.totalFound === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-600 italic">
            <Search className="w-8 h-8 opacity-20" />
            <p className="text-sm font-medium">{t('no_versions_found', { query: searchQuery })}</p>
          </div>
        )}

        {translations.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={t('no_bibles')}
            size="md"
          />
        )}
      </div>

      {searchQuery && groupedData.totalFound > 0 && (
        <div className="text-[10px] font-bold text-accent/50 uppercase tracking-widest text-center">
          {t('search_results_found', { count: groupedData.totalFound })}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <ContextMenuItem
            icon={<CheckCircle className="w-3.5 h-3.5" />}
            label={t('set_as_primary', 'Set as Primary')}
            disabled={currentTranslationId === contextMenu.translation.id}
            onClick={() => {
              setTranslation(contextMenu.translation.id);
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            icon={<Plus className="w-3.5 h-3.5" />}
            label={t('set_as_secondary', 'Set as Secondary')}
            disabled={secondTranslationId === contextMenu.translation.id}
            onClick={() => {
              setSecondTranslation(contextMenu.translation.id);
              setContextMenu(null);
            }}
          />
          {secondTranslationId === contextMenu.translation.id && (
            <ContextMenuItem
              icon={<X className="w-3.5 h-3.5 text-red-400" />}
              label={t('remove_secondary', 'Remove Secondary')}
              onClick={() => {
                setSecondTranslation(null);
                setContextMenu(null);
              }}
            />
          )}
          <div className="h-px bg-white/5 my-1 mx-2" />
          <ContextMenuItem
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label={t('delete')}
            danger
            onClick={() => {
              handleDelete(contextMenu.translation.id);
              setContextMenu(null);
            }}
          />
        </ContextMenu>
      )}
    </div>
  );
};

export default BibleManager;
