const GLOBAL_SPEED_STORAGE_KEY = 'mirato-live-playback-speed';
const GLOBAL_VOLUME_STORAGE_KEY = 'mirato-live-volume';
const GLOBAL_MUTED_STORAGE_KEY = 'mirato-live-muted';

export const readStoredGlobalSpeed = (): number => {
    try {
        if (typeof localStorage === 'undefined') return 1;
        const raw = localStorage.getItem(GLOBAL_SPEED_STORAGE_KEY);
        const parsed = raw ? Number(raw) : 1;
        if (Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 4) return parsed;
    } catch {
        // Ignore storage errors in restricted environments
    }
    return 1;
};

export const readStoredGlobalVolume = (): number => {
    try {
        if (typeof localStorage === 'undefined') return 1;
        const raw = localStorage.getItem(GLOBAL_VOLUME_STORAGE_KEY);
        const parsed = raw ? Number(raw) : 1;
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    } catch {
        // Ignore storage errors
    }
    return 1;
};

export const readStoredGlobalMuted = (): boolean => {
    try {
        if (typeof localStorage === 'undefined') return false;
        return localStorage.getItem(GLOBAL_MUTED_STORAGE_KEY) === 'true';
    } catch {
        // Ignore storage errors
    }
    return false;
};

export const persistGlobalSpeed = (speed: number): void => {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(GLOBAL_SPEED_STORAGE_KEY, String(speed));
    } catch { /* ignore */ }
};

export const persistGlobalVolume = (volume: number): void => {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(GLOBAL_VOLUME_STORAGE_KEY, String(volume));
    } catch { /* ignore */ }
};

export const persistGlobalMuted = (muted: boolean): void => {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(GLOBAL_MUTED_STORAGE_KEY, String(muted));
    } catch { /* ignore */ }
};
