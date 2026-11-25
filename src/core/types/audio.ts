export type HymnalAudioVariant = 'minus' | 'plus';

export interface IAudioAttachment {
  filename: string;
  path: string;
}

export interface IAudioScope {
  id: string;
  presentationId: string;
  startSlideId: string;
  endSlideId: string;
  fileId: string;   // Reference to the audio file in the DB or filesystem
  fileName?: string; // Original filename for persistence and auto-repair
  volume: number;   // 0-1
  loop: boolean;
  isGlobal?: boolean;
  isMuted?: boolean;
  trimStart?: number; // In seconds
  trimEnd?: number;   // In seconds
  crossfadeSettings?: {
    fadeInDuration: number;
    fadeOutDuration: number;
  };
  volumeFadeDuration?: number; // custom duration for programmatic fades
  speed?: number; // Playback speed (0.5 - 2.0)
  strategy?: 'auto' | 'delay' | 'manual';
  delaySeconds?: number;
  onEnded?: () => void;
  needsManualReview?: boolean;
  /** Audio track variant for hymnal backing tracks ('minus' = instrumental, 'plus' = with vocals). */
  audioVariant?: HymnalAudioVariant;
}
