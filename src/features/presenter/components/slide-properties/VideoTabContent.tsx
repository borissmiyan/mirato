import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Film, Upload, FolderOpen, Scissors,
  Volume2, VolumeX, Repeat, Maximize2, Minimize2,
  Clock, Play, Trash2
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Slider } from '@/shared/ui/Slider';
import { Button } from '@/shared/ui/Button';
import { Switch } from '@/shared/ui/Switch';
import { ScrubbableInput } from './ScrubbableInput';
import { IVideoSettings } from '@/core/types';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { extractPosterFrame } from '@/core/utils/videoUtils';
import { mediaCache } from '@/core/utils/mediaCache';
import { useVideoTabActions } from './useVideoTabActions';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const STRATEGY_OPTIONS: Array<{ value: IVideoSettings['strategy']; label: string; icon: React.ElementType }> = [
  { value: 'auto', label: 'Auto-play', icon: Play },
  { value: 'delay', label: 'Play after delay', icon: Clock },
  { value: 'manual', label: 'Manual', icon: Film },
];

interface IVideoTabContentProps {
  settings: IVideoSettings;
  onUpdate: (updates: Partial<IVideoSettings>) => void;
}

export const VideoTabContent: React.FC<IVideoTabContentProps> = ({ settings, onUpdate }) => {
  const { t } = useTranslation();
  const { handleImportFile, handleSelectFromPool, handleApplyTrim, isTrimming } = useVideoTabActions(settings, onUpdate);

  // Resolve media name from DB
  const mediaItem = useLiveQuery(
    async () => settings.mediaId ? await db.mediaPool.get(settings.mediaId) : undefined,
    [settings.mediaId]
  );

  // Auto-extract poster frame if missing
  useEffect(() => {
    if (!settings.mediaId || settings.posterFrame) return;

    let cancelled = false;
    (async () => {
      try {
        const url = await mediaCache.getBackgroundUrl(settings.mediaId);
        if (cancelled || !url) return;
        const frame = await extractPosterFrame(url);
        if (!cancelled && frame) {
          onUpdate({ posterFrame: frame });
        }
      } catch (err) {
        console.warn('[VideoTabContent] Failed to auto-extract poster frame:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [settings.mediaId, settings.posterFrame, onUpdate]);

  // ─── No video source yet ────────────────────────────────────────────
  if (!settings.mediaId) {
    return (
      <div className="pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col items-center justify-center text-center gap-5 py-10">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Film className="w-8 h-8 text-stone-600" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] text-stone-400 font-black uppercase tracking-[0.2em]">
              {t('no_video_selected', 'No Video Selected')}
            </p>
            <p className="text-[10px] text-stone-500 max-w-[200px] leading-relaxed">
              {t('video_source_hint', 'Import a video file or select one from the media pool')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full px-4">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center gap-2"
              onClick={handleImportFile}
            >
              <Upload className="w-4 h-4" />
              {t('import_video', 'Import Video File')}
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center gap-2"
              onClick={handleSelectFromPool}
            >
              <FolderOpen className="w-4 h-4" />
              {t('select_from_pool', 'Select from Media Pool')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Video configured ───────────────────────────────────────────────
  return (
    <div className="pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Identity */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 shadow-inner">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5 overflow-hidden shrink-0">
          {settings.posterFrame ? (
            <img src={settings.posterFrame} className="w-full h-full object-cover" alt="" />
          ) : (
            <Film className="w-6 h-6 text-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.2em] leading-none mb-1 px-0.5">
            {t('video_clip', 'Video Clip')}
          </p>
          <h3 className="text-sm font-bold text-white truncate px-0.5">
            {mediaItem?.name || t('unknown_file', 'Unknown File')}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={handleImportFile}
          aria-label={t('change_video', 'Change Video')}
          title={t('change_video', 'Change Video')}
        >
          <Upload className="w-4 h-4 text-stone-400" />
        </Button>
      </div>

      {/* Scaling */}
      <div className="space-y-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/60 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            {t('video_scaling', 'Scaling')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['cover', 'contain'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onUpdate({ scaling: mode })}
              className={cn(
                "flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer apple-press",
                settings.scaling === mode
                  ? "bg-accent/15 border-accent/40 text-accent font-bold shadow-sm shadow-accent/10"
                  : "bg-black/40 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-200"
              )}
            >
              {mode === 'cover' ? <Maximize2 className="w-4.5 h-4.5" /> : <Minimize2 className="w-4.5 h-4.5" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {mode === 'cover' ? t('cover', 'Fill') : t('contain', 'Fit')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Playback Strategy */}
      <div className="space-y-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/60 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            {t('playback_strategy', 'When Live')}
          </span>
        </div>
        <div className="space-y-2">
          {STRATEGY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ strategy: opt.value })}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer apple-press",
                  settings.strategy === opt.value
                    ? "bg-accent/15 border-accent/40 text-accent font-bold shadow-sm shadow-accent/10"
                    : "bg-black/40 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-200"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-bold">{t(`strategy_${opt.value}`, opt.label)}</span>
              </button>
            );
          })}
        </div>

        {/* Delay input */}
        {settings.strategy === 'delay' && (
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block px-0.5 mb-2">
              {t('delay_seconds', 'Delay (seconds)')}
            </span>
            <ScrubbableInput
              label={t('delay')}
              value={settings.delaySeconds ?? 1}
              onChange={(v) => onUpdate({ delaySeconds: v })}
              min={0.5}
              max={30}
              step={0.5}
              className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
            />
          </div>
        )}
      </div>

      {/* Speed */}
      <div className="space-y-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/60 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            {t('speed', 'Speed')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SPEED_OPTIONS.map((s) => (
            <Button
              key={s}
              size="xs"
              variant={settings.speed === s ? 'primary' : 'secondary'}
              onClick={() => onUpdate({ speed: s })}
              className={cn(
                "px-3 text-[11px] font-bold",
                settings.speed === s && "border-accent/40 shadow-sm shadow-accent/10"
              )}
            >
              {s}x
            </Button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-accent/60 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
              {t('volume', 'Volume')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            square
            onClick={() => onUpdate({ muted: !settings.muted })}
            className={settings.muted ? "bg-red-500/10 text-red-400 hover:text-red-300" : "text-stone-400"}
            aria-label={settings.muted ? t('unmute', 'Unmute') : t('mute', 'Mute')}
          >
            {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>
        <div className={cn(
          "bg-black/40 p-4 rounded-2xl border border-white/5 transition-opacity",
          settings.muted && "opacity-50 pointer-events-none"
        )}>
          <Slider
            mode="block"
            label={t('volume', 'Volume')}
            min={0}
            max={1}
            step={0.01}
            value={settings.volume ?? 1}
            onChange={(v) => onUpdate({ volume: v })}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>

      {/* Audio Transitions */}
      <div className="space-y-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/60 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            {t('audio_transitions', 'Audio Transitions')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 space-y-2.5 hover:border-white/10 transition-colors">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block px-0.5">
              {t('fade_in', 'Fade In')}
            </span>
            <ScrubbableInput
              value={settings.fadeInSeconds ?? 0}
              onChange={(v) => onUpdate({ fadeInSeconds: v })}
              min={0}
              max={10}
              step={0.1}
              className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
            />
          </div>
          <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 space-y-2.5 hover:border-white/10 transition-colors">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block px-0.5">
              {t('fade_out', 'Fade Out')}
            </span>
            <ScrubbableInput
              value={settings.fadeOutSeconds ?? 0}
              onChange={(v) => onUpdate({ fadeOutSeconds: v })}
              min={0}
              max={10}
              step={0.1}
              className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
            />
          </div>
        </div>
      </div>

      {/* Trimming */}
      <div className="space-y-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/60 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            <Scissors className="w-3 h-3 inline mr-1.5" />
            {t('trimming', 'Trimming')}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 space-y-2.5 hover:border-white/10 transition-colors">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block px-0.5">
                {t('trim_start', 'Start')}
              </span>
              <ScrubbableInput
                value={settings.trimStart ?? 0}
                onChange={(v) => onUpdate({ trimStart: v })}
                min={0}
                step={0.1}
                className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
              />
            </div>
            <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5 space-y-2.5 hover:border-white/10 transition-colors">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block px-0.5">
                {t('trim_end', 'End')}
              </span>
              <ScrubbableInput
                value={settings.trimEnd ?? 0}
                onChange={(v) => onUpdate({ trimEnd: v })}
                min={0}
                step={0.1}
                className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
              />
            </div>
          </div>
          
          {(Boolean(settings.trimStart && settings.trimStart > 0) || Boolean(settings.trimEnd && settings.trimEnd > 0)) && (
            <Button
              variant="primary"
              size="md"
              onClick={handleApplyTrim}
              disabled={isTrimming}
              className="w-full justify-center gap-2"
            >
              <Scissors className={cn("w-4 h-4", isTrimming && "animate-pulse")} />
              {isTrimming ? t('trimming_wait', 'Applying Trim...') : t('apply_physical_trim', 'Apply Physical Trim')}
            </Button>
          )}
        </div>
      </div>

      {/* Loop */}
      <div className="space-y-3 px-1">
        <div
          onClick={() => onUpdate({ loop: !settings.loop })}
          className={cn(
            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all apple-press cursor-pointer",
            settings.loop
              ? "bg-accent/15 border-accent/40 text-accent font-bold"
              : "bg-black/40 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl border transition-colors",
              settings.loop ? "bg-accent/20 border-accent/20" : "bg-white/5 border-white/5"
            )}>
              <Repeat className={cn("w-4 h-4", settings.loop ? "text-accent" : "text-stone-500")} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest">
              {t('loop_playback', 'Loop Playback')}
            </span>
          </div>
          <Switch
            checked={!!settings.loop}
            onChange={(checked) => onUpdate({ loop: checked })}
            size="sm"
          />
        </div>
      </div>

      {/* Remove Video */}
      <div className="pt-4 border-t border-white/5 px-1">
        <Button
          variant="danger"
          size="md"
          onClick={() => onUpdate({ mediaId: undefined, posterFrame: undefined })}
          className="w-full justify-center gap-2 text-[11px] font-bold tracking-wider"
        >
          <Trash2 className="w-4 h-4" />
          {t('remove_video', 'Remove Video')}
        </Button>
      </div>
    </div>
  );
};
