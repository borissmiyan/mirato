import './core/utils/blobDebugger';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './core/styles/globals.css';
import './core/i18n';
import './core/styles/fonts';
import { PerformanceMonitor } from './core/components/PerformanceMonitor';
import { LoadingScreen } from './core/components/LoadingScreen';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const App = lazy(() => import('./app/App'));

if (import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('UNHANDLED RENDERER REJECTION:', event.reason);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PerformanceMonitor />
      <LoadingScreen />
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);