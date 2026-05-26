import { useState } from 'react';

import AppConnected from './AppConnected';
import TenderPage from './pages/TenderPage';

type RootView = 'console' | 'tenders';

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
      </div>
      {rootView === 'tenders' ? <TenderPage /> : <AppConnected />}
    </>
  );
}
