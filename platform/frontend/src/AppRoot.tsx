import { useEffect, useMemo, useState } from 'react';

import { apiRequest, tokenStorage } from './api/client';
import type { CurrentUser } from './api/authTypes';
import { can } from './auth/rbac';
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

const tabs = [
  { key: 'console' as RootView, label: 'Console' },
  { key: 'tenders' as RootView, label: 'Appels offres', permission: 'tenders:read' },
  { key: 'profiles' as RootView, label: 'Profils consultants', permission: 'team:read' },
  { key: 'deliverables' as RootView, label: 'Livrables', permission: 'deliverables:read' },
  { key: 'commercial' as RootView, label: 'Commercial', permission: 'commercial:read' },
  { key: 'operations' as RootView, label: 'Operations', permission: 'operations:read' },
  { key: 'team' as RootView, label: 'Equipe', permission: 'team:read' },
  { key: 'audit' as RootView, label: 'Audit', permission: 'audit:read' },
];

export default function AppRoot() {
  const [rootView, setRootView] = useState<RootView>('console');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const token = tokenStorage.get();

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    apiRequest<CurrentUser>('/auth/me', {}, token)
      .then(setUser)
      .catch(() => setUser(null));
  }, [token]);

  const visibleTabs = useMemo(() => {
    return tabs.filter((tab) => !tab.permission || can(user?.role, tab.permission));
  }, [user?.role]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === rootView)) {
      setRootView('console');
    }
  }, [rootView, visibleTabs]);

  return (
    <>
      <div className="root-switcher" aria-label="Navigation principale">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={rootView === tab.key ? 'active' : ''}
            onClick={() => setRootView(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {rootView === 'console' && <AppConnected />}
      {rootView === 'tenders' && <TenderPage />}
      {rootView === 'profiles' && <ConsultantProfilesPage />}
      {rootView === 'deliverables' && <DeliverablePage />}
      {rootView === 'commercial' && <CommercialPage />}
      {rootView === 'operations' && <OperationsPage />}
      {rootView === 'team' && <TeamPage />}
      {rootView === 'audit' && <AuditLogPage />}
    </>
  );
}
