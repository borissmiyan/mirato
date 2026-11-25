import { BrowserWindow, Menu } from 'electron';

/**
 * Builds and registers the native Electron application menu (File -> Export / GraceLib, Edit, View, Window).
 */
export function buildApplicationMenu(getMainWindow: () => BrowserWindow | null): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Export',
                    submenu: [
                        {
                            label: 'Export MRTP (.mrtp)...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-presentation', 'mrtp');
                            }
                        },
                        {
                            label: 'Export PDF (.pdf)...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-presentation', 'pdf');
                            }
                        },
                        {
                            label: 'Export PowerPoint (.pptx)...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-presentation', 'pptx');
                            }
                        },
                        {
                            label: 'Export OpenDocument (.odp)...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-presentation', 'odp');
                            }
                        },
                    ]
                },
                { type: 'separator' },
                {
                    label: 'GraceLib',
                    submenu: [
                        {
                            label: 'Export GraceLib...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-gracelib');
                            }
                        },
                        {
                            label: 'Export GraceLib Presentations...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-presentations');
                            }
                        },
                        {
                            label: 'Export GraceLib Templates...',
                            click: () => {
                                getMainWindow()?.webContents.send('menu:export-templates');
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
