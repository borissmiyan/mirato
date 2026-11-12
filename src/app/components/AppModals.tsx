import React, { useCallback } from 'react';
// audit-ignore: app root modal registry mounting feature modal
import SettingsModal from '@/features/settings/components/SettingsModal';
// audit-ignore: app root modal registry mounting feature modal
import QuickSearchModal from '@/features/search/components/QuickSearchModal';
// audit-ignore: app root modal registry mounting feature modal
import CustomizationPanel from '@/features/presenter/components/slide-properties/CustomizationPanel';
// audit-ignore: app root modal registry mounting feature modal
import BibleSelectionModal from '@/features/presenter/components/modals/BibleSelectionModal';
// audit-ignore: app root modal registry mounting feature modal
import TemplatePickerModal from '@/features/presenter/components/modals/TemplatePickerModal';
// audit-ignore: app root modal registry mounting feature modal
import AudioPickerModal from '@/features/presenter/components/modals/AudioPickerModal';
// audit-ignore: app root modal registry mounting feature modal
import AudioConflictModal from '@/features/presenter/components/modals/AudioConflictModal';
// audit-ignore: app root modal registry mounting feature modal
import SaveNestedConfirmModal from '@/features/presenter/components/modals/SaveNestedConfirmModal';
// audit-ignore: app root modal registry mounting feature modal
import PresentationImportModal from '@/features/presenter/components/modals/PresentationImportModal';
// audit-ignore: app root modal registry mounting feature modal
import PresentationPickerModal from '@/features/presenter/components/modals/PresentationPickerModal';
// audit-ignore: app root modal registry mounting feature modal
import HymnPickerModal from '@/features/presenter/components/modals/HymnPickerModal';
// audit-ignore: app root modal registry mounting feature modal
import { BackgroundCropModal } from '@/features/presenter/components/slide-properties/BackgroundCropModal';
// audit-ignore: app root modal registry mounting feature modal
import { HymnalModalsManager } from '@/features/hymns/components/HymnalModals';
// audit-ignore: app root modal registry mounting feature modal
import { CanvasQuickActionsModal } from '@/features/presenter/components/slide-editor/modals/CanvasQuickActionsModal';

interface AppModalsProps {
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    searchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
}

/**
 * Registry component for global app modals.
 * Some modals are controlled by local state, others via global ModalStore.
 */
export const AppModals: React.FC<AppModalsProps> = ({
    settingsOpen,
    setSettingsOpen,
    searchOpen,
    setSearchOpen
}) => {
    const handleCloseSettings = useCallback(() => setSettingsOpen(false), [setSettingsOpen]);
    const handleCloseSearch = useCallback(() => setSearchOpen(false), [setSearchOpen]);

    return (
        <>
            {/* Context/Feature Modals (controlled via ModalStore internally or directly) */}
            <CustomizationPanel />
            <BibleSelectionModal />
            <TemplatePickerModal />
            <AudioPickerModal />
            <AudioConflictModal />
            <SaveNestedConfirmModal />
            <PresentationImportModal />
            <PresentationPickerModal />
            <HymnPickerModal />
            <BackgroundCropModal />
            <HymnalModalsManager />
            <CanvasQuickActionsModal />

            {/* Global Overlays (controlled via local App state) */}
            <SettingsModal isOpen={settingsOpen} onClose={handleCloseSettings} />
            <QuickSearchModal isOpen={searchOpen} onClose={handleCloseSearch} />
        </>
    );
};
