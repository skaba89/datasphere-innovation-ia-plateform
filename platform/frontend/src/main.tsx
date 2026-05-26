import React from 'react';
import ReactDOM from 'react-dom/client';
import AppConnected from './AppConnected';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppConnected />
  </React.StrictMode>,
);
