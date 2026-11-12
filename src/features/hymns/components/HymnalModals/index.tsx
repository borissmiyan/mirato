import React from 'react';
import { RemoveHymnalModal } from './RemoveHymnalModal';
import { ImportCollisionModal } from './ImportCollisionModal';
import { HymnalInstructionModal } from './HymnalInstructionModal';
import { OrphanAudioScopesModal } from './OrphanAudioScopesModal';

export const HymnalModalsManager: React.FC = () => {
    return (
        <>
            <RemoveHymnalModal />
            <ImportCollisionModal />
            <HymnalInstructionModal />
            <OrphanAudioScopesModal />
        </>
    );
};
