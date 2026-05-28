import { useState } from 'react';

import AppConnected from './AppConnected';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import TenderPage from './pages/TenderPage';
import './root.css';

type RootView = 'console' | 'tenders' | 'profiles';

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
      </div>
      {rootView === 'tenders' && <TenderPage />}
      {rootView === 'profiles' && <ConsultantProfilesPage />}
      {rootView === 'console' && <AppConnected />}
    </>
  );
}
