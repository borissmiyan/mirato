import { app, BrowserWindow, screen, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// audit-ignore: Node.js main process environment
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

const getPreloadPath = (): string => {
    const defaultPath = path.join(__dirname, 'preload.cjs');
    if (fs.existsSync(defaultPath)) return defaultPath;
    if (process.env.DIST_ELECTRON) {
        const envPath = path.join(process.env.DIST_ELECTRON, 'preload.cjs');
        if (fs.existsSync(envPath)) return envPath;
    }
    return defaultPath;
};

export interface ElectronDisplaySettings {
    presenterDisplayId?: number;
    autoDefine?: boolean;
    stageDisplayId?: number;
    [key: string]: unknown;
}

let mainWindow: BrowserWindow | null = null;
let projectorWindow: BrowserWindow | null = null;
let stageWindow: BrowserWindow | null = null;
let lastDisplaySettings: ElectronDisplaySettings | null = null;
let lastStageDisplaySettings: ElectronDisplaySettings | null = null;

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}

export function getProjectorWindow(): BrowserWindow | null {
    return projectorWindow;
}

export function getStageWindow(): BrowserWindow | null {
    return stageWindow;
}

export function createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'GraceLib',
                    submenu: [
                        {
                            label: 'Export GraceLib...',
                            click: () => {
                                mainWindow?.webContents.send('menu:export-gracelib');
                            }
                        },
                        {
                            label: 'Export GraceLib Presentations...',
                            click: () => {
                                mainWindow?.webContents.send('menu:export-presentations');
                            }
                        },
                        {
                            label: 'Export GraceLib Templates...',
                            click: () => {
                                mainWindow?.webContents.send('menu:export-templates');
                            }
                        },
                    ]
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

export function createMainWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#0c0a09',
        webPreferences: {
            preload: getPreloadPath(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            autoplayPolicy: 'no-user-gesture-required'
        },
    });

    console.log('Main Process: Main Window Created');
    console.log('Main Process: Preload Path:', getPreloadPath());

    if (VITE_DEV_SERVER_URL && process.env.OPEN_DEVTOOLS === 'true') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Test active push message to Renderer-process
    mainWindow.webContents.on('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('main-process-message', (new Date).toLocaleString());
        }
    });

    if (VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
    } else {
        // audit-ignore: Node.js main process environment
        mainWindow.loadFile(path.join(process.env.DIST || '', 'index.html'));
    }

    mainWindow.on('close', () => {
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.close();
        }
        if (stageWindow && !stageWindow.isDestroyed()) {
            stageWindow.close();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

export function createProjectorWindow(displaySettings?: ElectronDisplaySettings | null): void {
    if (displaySettings) {
        lastDisplaySettings = displaySettings;
    } else {
        displaySettings = lastDisplaySettings;
    }

    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    // 1. Determine target display
    let targetDisplay: Electron.Display | undefined;

    if (displaySettings && !displaySettings.autoDefine && displaySettings.presenterDisplayId !== undefined) {
        targetDisplay = displays.find(d => d.id === displaySettings.presenterDisplayId);
    }

    if (!targetDisplay) {
        // Multi-monitor: select an external monitor (display where mainWindow is not located)
        const mainWindowDisplay = mainWindow && !mainWindow.isDestroyed()
            ? screen.getDisplayMatching(mainWindow.getBounds())
            : primaryDisplay;

        targetDisplay = displays.find(d => d.id !== mainWindowDisplay.id);
        if (!targetDisplay) {
            targetDisplay = displays.find(d => d.id !== primaryDisplay.id);
        }
        if (!targetDisplay) {
            targetDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
        }
        if (!targetDisplay) {
            targetDisplay = displays[1] || displays[0];
        }
    }

    const isMultiScreen = displays.length > 1;

    // 2. If projector window already exists:
    if (projectorWindow && !projectorWindow.isDestroyed()) {
        projectorWindow.setBounds({
            x: targetDisplay.bounds.x,
            y: targetDisplay.bounds.y,
            width: targetDisplay.bounds.width,
            height: targetDisplay.bounds.height
        });
        projectorWindow.setFullScreen(true);
        projectorWindow.setAlwaysOnTop(isMultiScreen);
        projectorWindow.show();
        projectorWindow.focus();
        return;
    }

    projectorWindow = new BrowserWindow({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height,
        fullscreen: true,
        autoHideMenuBar: true,
        frame: false,
        alwaysOnTop: isMultiScreen,
        backgroundColor: '#000000',
        title: 'Deck.CE — Live Output',
        webPreferences: {
            preload: getPreloadPath(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            autoplayPolicy: 'no-user-gesture-required'
        },
    });

    console.log('Main Process: Projector Window Created on display', targetDisplay.id, targetDisplay.bounds, { isMultiScreen });

    if (VITE_DEV_SERVER_URL) {
        const baseUrl = VITE_DEV_SERVER_URL.replace(/\/+$/, '');
        projectorWindow.loadURL(`${baseUrl}/projector.html`);
    } else {
        // audit-ignore: Node.js main process environment
        projectorWindow.loadFile(path.join(process.env.DIST || '', 'projector.html'));
    }

    // Reliably notify main window when projector page is loaded (Electron-level event)
    projectorWindow.webContents.on('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector-ready');
        }
    });

    projectorWindow.on('closed', () => {
        projectorWindow = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector-closed');
        }
    });
}

export function createStageWindow(displaySettings?: ElectronDisplaySettings | null): void {
    if (displaySettings) {
        lastStageDisplaySettings = displaySettings;
    } else {
        displaySettings = lastStageDisplaySettings;
    }

    const displays = screen.getAllDisplays();
    let display: Electron.Display | undefined;

    if (displaySettings && displaySettings.stageDisplayId !== undefined) {
        display = displays.find(d => d.id === displaySettings.stageDisplayId);
    }

    // Safety guard: Do NOT open stage window if no specific stage display is configured,
    // or if the requested stage display is disconnected. This prevents covering the operator's workspace.
    if (!display) {
        console.log('Main Process: Stage window creation skipped — stage display is not assigned or disconnected.');
        return;
    }

    if (stageWindow && !stageWindow.isDestroyed()) {
        stageWindow.setBounds({
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height
        });
        if (process.platform === 'darwin') {
            stageWindow.setSimpleFullScreen(true);
        } else {
            stageWindow.setFullScreen(true);
        }
        stageWindow.setAlwaysOnTop(true, 'screen-saver');
        stageWindow.show();
        stageWindow.focus();
        return;
    }

    stageWindow = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        fullscreen: process.platform !== 'darwin',
        simpleFullscreen: process.platform === 'darwin',
        autoHideMenuBar: true,
        frame: false,
        alwaysOnTop: true,
        enableLargerThanScreen: true,
        backgroundColor: '#000000',
        webPreferences: {
            preload: getPreloadPath(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            autoplayPolicy: 'no-user-gesture-required'
        },
    });

    stageWindow.setBounds({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height
    });

    if (process.platform === 'darwin') {
        stageWindow.setSimpleFullScreen(true);
    } else {
        stageWindow.setFullScreen(true);
    }
    stageWindow.setAlwaysOnTop(true, 'screen-saver');

    console.log('Main Process: Stage Window Created on display', display.id, display.bounds);

    if (VITE_DEV_SERVER_URL) {
        const baseUrl = VITE_DEV_SERVER_URL.replace(/\/+$/, '');
        stageWindow.loadURL(`${baseUrl}/stage.html`);
    } else {
        // audit-ignore: Node.js main process environment
        stageWindow.loadFile(path.join(process.env.DIST || '', 'stage.html'));
    }

    stageWindow.on('closed', () => {
        stageWindow = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stage-closed');
        }
    });
}

export function broadcastAspectRatio() {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const mainWindowDisplay = mainWindow && !mainWindow.isDestroyed()
        ? screen.getDisplayMatching(mainWindow.getBounds())
        : primaryDisplay;
    const external = displays.find(d => d.id !== mainWindowDisplay.id) || displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
    const target = external || displays[0];

    if (target) {
        const ratio = target.bounds.width / target.bounds.height;

        // Send ratio to main window
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('on-aspect-ratio-changed', ratio);
        }

        // Send ratio to projector window as well
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.webContents.send('on-aspect-ratio-changed', ratio);
        }
    }
}

export function setupWindowIpc(): void {
    ipcMain.handle('open-projector', (_event, displaySettings) => {
        createProjectorWindow(displaySettings);
        return true;
    });

    ipcMain.handle('open-stage', (_event, displaySettings) => {
        createStageWindow(displaySettings);
        return true;
    });

    ipcMain.handle('get-displays', () => {
        return screen.getAllDisplays().map(d => ({
            id: d.id,
            label: d.label,
            bounds: d.bounds,
            size: d.size,
            scaleFactor: d.scaleFactor
        }));
    });

    ipcMain.on('projector-command', (event, command, payload) => {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
            if (win && !win.isDestroyed() && win.webContents !== event.sender) {
                win.webContents.send('projector-command', command, payload);
            }
        });
    });

    ipcMain.on('projector-ready', (_event, payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector-ready', payload);
        }
    });

    ipcMain.on('projector:render-error', (_event, payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector:render-error', payload);
        }
    });

    ipcMain.on('relay-keydown', (_event, payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('relay-keydown', payload);
        }
    });

    ipcMain.on('navigate-verse', (_event, direction) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('navigate-verse', direction);
        }
    });

    ipcMain.handle('close-projector', () => {
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.close();
            projectorWindow = null;
        }
        return true;
    });

    ipcMain.handle('projector:toggle-fullscreen', () => {
        if (!projectorWindow || projectorWindow.isDestroyed()) return false;
        const isFS = projectorWindow.isFullScreen();
        projectorWindow.setFullScreen(!isFS);
        return !isFS;
    });

    ipcMain.handle('close-stage', () => {
        if (stageWindow && !stageWindow.isDestroyed()) {
            stageWindow.close();
            stageWindow = null;
        }
        return true;
    });

    const handleDisplayChange = () => {
        broadcastAspectRatio();
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            console.log('Main Process: Display changed, updating projector window...');
            createProjectorWindow();
        }
        if (stageWindow && !stageWindow.isDestroyed()) {
            console.log('Main Process: Display changed, updating stage window...');
            createStageWindow();
        }
    };

    screen.on('display-added', handleDisplayChange);
    screen.on('display-removed', handleDisplayChange);
    screen.on('display-metrics-changed', handleDisplayChange);
}

