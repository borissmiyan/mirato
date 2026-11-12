import './core/utils/blobDebugger';
import React from 'react';
import ReactDOM from 'react-dom/client';
// audit-ignore: secondary window entry point mounting projector view
import ProjectorView from '@/features/presenter/components/display/ProjectorView';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

import './core/styles/globals.css';
import './core/styles/fonts';
import './core/i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <ErrorBoundary fallback={<div className="w-full h-full min-h-screen bg-black" />}>
            <ProjectorView />
        </ErrorBoundary>
    </React.StrictMode>
);
