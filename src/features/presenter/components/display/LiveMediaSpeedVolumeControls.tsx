import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Gauge, Volume2, VolumeX } from 'lucide-react';
import { Slider, Tooltip } from '@/shared/ui';
import { cn } from '@/core/utils/cn';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const formatSpeedBadge = (speed: number): string => {
  const rounded = Math.round(speed * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded}`;
};

export interface LiveMediaSpeedVolumeControlsProps {
  isAudioMode: boolean;
  currentSpeed: number;
  currentVolume: number;
  isMuted: boolean;
  onSpeedChange: (speed: number) => void;
  onMuteToggle: () => void;
  onVolumeChange: (val: number) => void;
  onVolumeChangeEnd: (val: number) => void;
}

/**
 * Compact Speed (icon + corner rounded-square badge) and Hover-Expanding Volume controls
 * for LiveMediaToolbar. Works uniformly for both live video and audio tracks.
 */
export const LiveMediaSpeedVolumeControls: React.FC<LiveMediaSpeedVolumeControlsProps> = React.memo(({
  isAudioMode,
  currentSpeed,
  currentVolume,
  isMuted,
  onSpeedChange,
  onMuteToggle,
  onVolumeChange,
  onVolumeChangeEnd,
}) => {
  const { t } = useTranslation();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ bottom: 0, right: 0 });

  // Close speed popover on outside click or Escape key
  useEffect(() => {
    if (!showSpeedMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        speedButtonRef.current?.contains(target) ||
        speedMenuRef.current?.contains(target)
      ) {
        return;
      }
      setShowSpeedMenu(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSpeedMenu(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSpeedMenu]);

  const isVolumeExpanded = isVolumeHovered || isDraggingVolume;
  const isCustomSpeed = Math.abs(currentSpeed - 1) > 0.001;

  return (
    <div className="flex items-center gap-1 shrink-0 ml-1">
      {/* Speed Control: Gauge icon with bottom-right rounded square badge matching button bg */}
      <div className="relative shrink-0">
        <Tooltip content={`${t('playback_speed', 'Playback Speed')}: ${currentSpeed}x`} position="top">
          <button
            type="button"
            ref={speedButtonRef}
            onClick={() => {
              const rect = speedButtonRef.current?.getBoundingClientRect();
              if (rect) {
                setMenuPosition({
                  bottom: window.innerHeight - rect.top + 8,
                  right: window.innerWidth - rect.right,
                });
              }
              setShowSpeedMenu(prev => !prev);
            }}
            className={cn(
              'group relative w-8 h-8 flex items-center justify-center rounded-xl transition-colors cursor-pointer apple-press',
              showSpeedMenu ? 'bg-stone-800 text-white' : 'bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white',
              isCustomSpeed && (isAudioMode ? 'text-amber-400 hover:text-amber-300' : 'text-accent hover:text-accent')
            )}
            aria-label={`${t('playback_speed', 'Playback Speed')} ${currentSpeed}x`}
          >
            <Gauge className="w-4 h-4" />
            <span
              className={cn(
                'absolute bottom-0.5 right-0.5 min-w-[15px] h-[13px] px-[2px] flex items-center justify-center rounded-[4px] text-[8px] font-black leading-none tabular-nums tracking-tighter transition-colors pointer-events-none',
                showSpeedMenu ? 'bg-stone-800' : 'bg-stone-900 group-hover:bg-stone-800',
                isCustomSpeed
                  ? (isAudioMode ? 'text-amber-400' : 'text-accent')
                  : 'text-stone-200 group-hover:text-white'
              )}
            >
              {formatSpeedBadge(currentSpeed)}
            </span>
          </button>
        </Tooltip>

        {showSpeedMenu && createPortal(
          <div
            ref={speedMenuRef}
            className="fixed bg-stone-900 border border-white/10 rounded-xl shadow-xl py-1 min-w-[92px] z-100 animate-in fade-in zoom-in-95"
            style={{ bottom: menuPosition.bottom, right: menuPosition.right }}
          >
            {SPEED_OPTIONS.map((s) => {
              const isSelected = Math.abs(s - currentSpeed) < 0.001;
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => {
                    onSpeedChange(s);
                    setShowSpeedMenu(false);
                  }}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-[11px] font-medium transition-colors cursor-pointer block apple-press tabular-nums',
                    isSelected
                      ? (isAudioMode ? 'text-amber-400 bg-amber-500/10' : 'text-accent bg-accent/10')
                      : 'text-stone-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {s}x
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </div>

      {/* Compact Volume Control: Mutes on click, expands slider smoothly on hover */}
      <div
        className={cn(
          'flex items-center rounded-xl transition-colors duration-200',
          isVolumeExpanded && 'bg-stone-800/80'
        )}
        onMouseEnter={() => setIsVolumeHovered(true)}
        onMouseLeave={() => {
          setIsVolumeHovered(false);
        }}
      >
        <Tooltip content={isMuted || currentVolume === 0 ? t('unmute', 'Unmute') : t('mute', 'Mute')} position="top">
          <button
            type="button"
            onClick={onMuteToggle}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-stone-300 hover:text-white apple-press shrink-0"
            aria-label={isMuted || currentVolume === 0 ? t('unmute', 'Unmute') : t('mute', 'Mute')}
          >
            {isMuted || currentVolume === 0 ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </Tooltip>

        <div
          className={cn(
            'h-8 flex items-center overflow-hidden transition-all duration-200 ease-out',
            isVolumeExpanded ? 'w-20 opacity-100 pl-0.5 pr-2.5' : 'w-0 opacity-0 pointer-events-none'
          )}
          title={t('volume', 'Volume')}
          onPointerDown={() => setIsDraggingVolume(true)}
        >
          <div className="w-full min-w-[68px]">
            <Slider
              mode="track"
              color={isAudioMode ? 'amber' : 'accent'}
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : currentVolume}
              onChange={onVolumeChange}
              onChangeEnd={(val) => {
                setIsDraggingVolume(false);
                onVolumeChangeEnd(val);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

LiveMediaSpeedVolumeControls.displayName = 'LiveMediaSpeedVolumeControls';
