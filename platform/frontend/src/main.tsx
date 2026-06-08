import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoot from './AppRoot';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import './styles.css';
import './responsive.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <AppRoot />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
