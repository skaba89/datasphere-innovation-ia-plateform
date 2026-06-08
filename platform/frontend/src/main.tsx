import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoot from './AppRoot';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import './styles.css';
import './responsive.css';

// Register Service Worker for PWA offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <AppRoot />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
