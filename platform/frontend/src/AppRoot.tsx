import { useState } from 'react';

import AppConnected from './AppConnected';
import AuditLogPage from './pages/AuditLogPage';
import CommercialPage from './pages/CommercialPage';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import DeliverablePage from './pages/DeliverablePage';
import OperationsPage from './pages/OperationsPage';
import TeamPage from './pages/TeamPage';
import TenderPage from './pages/TenderPage';
import UserProfilePage from './pages/UserProfilePage';
import WorkspacesPage from './pages/WorkspacesPage';
import './root.css';

type RootView = 'console' | 'tenders' | 'profiles' | 'deliverables' | 'commercial' | 'operations' | 'team' | 'audit' | 'profile' | 'workspaces';

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
    { key: 'profile',      label: 'Mon profil' },
    { key: 'workspaces',   label: 'Workspaces' },
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
      {rootView === 'profile'      && <UserProfilePage />}
      {rootView === 'workspaces'   && <WorkspacesPage />}
    </>
  );
}
