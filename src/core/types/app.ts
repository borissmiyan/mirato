// For UI state managed by Jotai
export type ThemeMode = 'light' | 'dark';
export type AppMode = 'scripture' | 'presentation' | 'hymns';
export type PresentationMode = 'normal' | 'fullscreen';

// --- Projector/Command Types ---

export type ProjectorCommandType = 
  | 'show-verse' 
  | 'show-slide' 
  | 'show-preview-slide'
  | 'set-override' 
  | 'clear-override' 
  | 'projector-ready' 
  | 'sync-state'
  | 'set-relay-pin';

export interface IProjectorCommand {
  type: ProjectorCommandType;
  payload: unknown;
}

export interface IProjectorState {
  activeSlideId: string | null;
  activePresentationId: string | null;
  activeOverride: 'blackout' | 'whiteout' | 'logo' | null;
  timestamp: number;
}
