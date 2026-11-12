import { create } from 'zustand';

interface DisplayState {
    aspectRatio: number;
    setAspectRatio: (ratio: number) => void;
    initElectronListener: () => (() => void) | void;
}

export const useDisplayStore = create<DisplayState>((set) => ({
    aspectRatio: 16 / 9,

    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

    initElectronListener: () => {
        if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
            const electron = window.electron;

            // Initial aspect ratio fetch if possible
            electron.ipcRenderer.invoke<Array<{ bounds: { x: number; y: number; width: number; height: number } }>>('get-displays').then((displays) => {
                const external = displays?.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
                const target = external || displays?.[0];
                if (target) {
                    set({ aspectRatio: target.bounds.width / target.bounds.height });
                }
            });

            // Listen for changes
            const removeListener = electron.ipcRenderer.on('on-aspect-ratio-changed', (ratio: unknown) => {
                if (typeof ratio === 'number') {
                    set({ aspectRatio: ratio });
                }
            });

            return removeListener;
        }
    },
}));
