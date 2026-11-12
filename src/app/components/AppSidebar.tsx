import React from 'react';
import NavigationPanel from '@/features/bible-browser/components/NavigationPanel';
import VerseList from '@/features/bible-browser/components/VerseList';
import PresentationLibrary from '@/features/presenter/components/library/PresentationLibrary';
import { useResizable } from '@/core/hooks/useResizable';
import { cn } from '@/core/utils/cn';

interface AppSidebarProps {
    appMode: 'scripture' | 'presentation' | 'hymns';
    onOpenSettings: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ appMode, onOpenSettings }) => {
    // Resizable navigation panel width - independent per mode
    const navPanel = useResizable(`nav-panel-width-${appMode}`, 200, 150, 350, 'horizontal');
    // Resizable side panel width - independent per mode
    const sidePanel = useResizable(`side-panel-width-${appMode}`, 280, 200, 500, 'horizontal');

    const isSidePanelOpen = appMode !== 'hymns';
    const effectiveSideWidth = isSidePanelOpen ? sidePanel.size : 0;

    return (
        <>
            {/* Column 1: Navigation / Core App Context */}
            <div
                style={{ width: navPanel.size }}
                className={cn(
                    "h-full shrink-0 relative z-20",
                    !navPanel.isDragging && "transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                )}
            >
                <NavigationPanel onOpenSettings={onOpenSettings} />
            </div>

            {/* Resize Handle 1 */}
            <div
                onMouseDown={navPanel.handleMouseDown}
                className="w-1 bg-stone-800 hover:bg-accent transition-colors cursor-col-resize shrink-0 relative z-20"
            />

            {/* Column 2: Specific Panel (Library or Verse List) - Smoothly collapses in Hymns mode */}
            <div
                style={{ width: effectiveSideWidth }}
                className={cn(
                    "h-full shrink-0 relative z-20 overflow-hidden",
                    !sidePanel.isDragging && "transition-[width,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isSidePanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
            >
                <div style={{ width: sidePanel.size }} className="h-full">
                    {appMode === 'scripture' ? (
                        <VerseList />
                    ) : (
                        <PresentationLibrary />
                    )}
                </div>
            </div>

            {/* Resize Handle 2 */}
            <div
                onMouseDown={sidePanel.handleMouseDown}
                className={cn(
                    "bg-stone-800 hover:bg-accent transition-colors cursor-col-resize shrink-0 relative z-20",
                    !sidePanel.isDragging && "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isSidePanelOpen ? "w-1 opacity-100 pointer-events-auto" : "w-0 opacity-0 pointer-events-none"
                )}
            />
        </>
    );
};
