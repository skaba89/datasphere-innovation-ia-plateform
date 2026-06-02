import { useState } from 'react';

import AppConnected from './AppConnected';
import AuditLogPage from './pages/AuditLogPage';
import CommercialPage from './pages/CommercialPage';
import DeliverablePage from './pages/DeliverablePage';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import OperationsPage from './pages/OperationsPage';
import TeamPage from './pages/TeamPage';
import TenderPage from './pages/TenderPage';
import './root.css';

type RootView = 'console' | 'tenders' | 'profiles' | 'deliverables' | 'commercial' | 'operations' | 'team' | 'audit';

export default function AppRoot() {
  const [rootView, setRootView] = useState<RootView>('console');

  const tabs: { key: RootView; label: string }[] = [
    { key: 'console',      label: 'Console' },
    { key: 'tenders',      label: 'Appels d offres' },
    { key: 'profiles',     label: 'Profils consultants' },
    { key: 'deliverables', label: 'Livrables' },
    { key: 'commercial',   label: 'Commercial' },
    { key: 'operations',   label: 'Opérations' },
    { key: 'team',         label: 'Équipe' },
    { key: 'audit',        label: 'Audit' },
  ];

  return (
    <>
      <div className="root-switcher">
        {tabs.map(t => (
          <button
            key={t.key}
            className={rootView === t.key ? 'active' : ''}
            onClick={() => setRootView(t.key)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      {rootView === 'console'      && <AppConnected />}
      {rootView === 'tenders'      && <TenderPage />}
      {rootView === 'profiles'     && <ConsultantProfilesPage />}
      {rootView === 'deliverables' && <DeliverablePage />}
      {rootView === 'commercial'   && <CommercialPage />}
      {rootView === 'operations'   && <OperationsPage />}
      {rootView === 'team'         && <TeamPage />}
      {rootView === 'audit'        && <AuditLogPage />}
    </>
  );
}
