import { useState } from 'react';

import AppConnected from './AppConnected';
import DeliverablePage from './pages/DeliverablePage';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import OperationsPage from './pages/OperationsPage';
import TenderPage from './pages/TenderPage';
import './root.css';

type RootView = 'console' | 'tenders' | 'profiles' | 'deliverables' | 'operations';

export default function AppRoot() {
  const [rootView, setRootView] = useState<RootView>('console');

  return (
    <>
      <div className="root-switcher">
        <button className={rootView === 'console' ? 'active' : ''} onClick={() => setRootView('console')} type="button">
          Console
        </button>
        <button className={rootView === 'tenders' ? 'active' : ''} onClick={() => setRootView('tenders')} type="button">
          Appels d offres
        </button>
        <button className={rootView === 'profiles' ? 'active' : ''} onClick={() => setRootView('profiles')} type="button">
          Profils consultants
        </button>
        <button className={rootView === 'deliverables' ? 'active' : ''} onClick={() => setRootView('deliverables')} type="button">
          Livrables
        </button>
        <button className={rootView === 'operations' ? 'active' : ''} onClick={() => setRootView('operations')} type="button">
          ⚙ Opérations
        </button>
      </div>
      {rootView === 'console' && <AppConnected />}
      {rootView === 'tenders' && <TenderPage />}
      {rootView === 'profiles' && <ConsultantProfilesPage />}
      {rootView === 'deliverables' && <DeliverablePage />}
      {rootView === 'operations' && <OperationsPage />}
    </>
  );
}
