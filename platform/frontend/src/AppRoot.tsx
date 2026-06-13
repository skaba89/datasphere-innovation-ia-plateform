import { useEffect, useState } from 'react';
import { LogOut, UserCircle, ChevronDown, Menu, X } from 'lucide-react';

import { apiRequest, tokenStorage } from './api/client';
import { getUserName } from './api/userContext';
import type { CurrentUser, LoginResult } from './api/authTypes';
import { can, type AppPermission } from './auth/rbac';

import AuditLogPage from './pages/AuditLogPage';
import CommercialPage from './pages/CommercialPage';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import DashboardPage from './pages/DashboardPage';
import DeliverablePage from './pages/DeliverablePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OperationsPage from './pages/OperationsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TeamPage from './pages/TeamPage';
import TenderPage from './pages/TenderPage';
import UserProfilePage from './pages/UserProfilePage';
import WorkspacesPage from './pages/WorkspacesPage';
import DataExportPage from './pages/DataExportPage';
import LinkedInAgentPage from './pages/LinkedInAgentPage';
import OnboardingWizard, { shouldShowOnboarding, markOnboardingDone } from './components/OnboardingWizard';
import ToastContainer from './components/ToastContainer';
import { LangToggle } from './i18n';
import { useRealtimeToasts } from './hooks/useRealtimeToasts';
import type { ToastEvent } from './hooks/useRealtimeToasts';
import { CrmWorkspace } from './components/CrmWorkspace';
import GlobalSearchBar from './components/GlobalSearchBar';
import NotificationBell from './components/NotificationBell';
import NotificationsPanel from './components/NotificationsPanel';

import './root.css';

type AuthView = 'login' | 'forgot' | 'reset';
type RootView =
  | 'dashboard'
  | 'organizations'
  | 'opportunities'
  | 'tenders'
  | 'profiles'
  | 'deliverables'
  | 'commercial'
  | 'operations'
  | 'team'
  | 'audit'
  | 'profile'
  | 'workspaces'
  | 'data-export'
  | 'linkedin'
  | 'consultant-profiles'
  | 'calculator'
  | 'pricing'
  | 'settings';

type NavTab = {
  key: RootView;
  label: string;
  permission: AppPermission;
};

function LoginPage({
  onLogin,
  onForgot,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell auth-shell">
      <section className="hero auth-card">
        <p className="eyebrow">Connexion sécurisée</p>
        <h1>Accéder à la plateforme DataSphere</h1>
        <p className="subtitle">
          Connecte-toi avec le compte administrateur créé au démarrage.
        </p>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              disabled={loading}
            />
          </label>
          <label>
            Mot de passe
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <button
            type="button"
            onClick={onForgot}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', fontSize: '.8rem', marginTop: 8, textDecoration: 'underline',
            }}
          >
            Mot de passe oublié ?
          </button>
        </form>
      </section>
    </main>
  );
}

export default function AppRoot() {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authView, setAuthView] = useState<AuthView>(() =>
    new URLSearchParams(window.location.search).has('token') ? 'reset' : 'login',
  );
  const [view, setView] = useState<RootView>('dashboard');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const [toasts, setToasts] = useState<ToastEvent[]>([]);
  const addToast = (t: ToastEvent) => setToasts(prev => [...prev.slice(-3), t]);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Real-time SSE toasts
  useRealtimeToasts(token, addToast);

  useEffect(() => {
    if (!token) return;
    apiRequest<CurrentUser>('/auth/me', {}, token)
      .then(u => {
        setUser(u);
        localStorage.setItem('ds_user', JSON.stringify(u));
      })
      .catch(() => {
        tokenStorage.clear();
        localStorage.removeItem('ds_user');
        setToken(null);
        setUser(null);
      });
  }, [token]);

  async function handleLogin(email: string, password: string) {
    const result = await apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    tokenStorage.set(result.access_token, result.refresh_token);
    localStorage.setItem('ds_user', JSON.stringify(result.user));
    setToken(result.access_token);
    setUser(result.user);
  }

  function logout() {
    tokenStorage.clear();
    localStorage.removeItem('ds_user');
    setToken(null);
    setUser(null);
    setView('dashboard');
  }

  if (!token) {
    if (authView === 'forgot')
      return <ForgotPasswordPage onBack={() => setAuthView('login')} />;
    if (authView === 'reset')
      return (
        <ResetPasswordPage
          onSuccess={() => {
            window.history.replaceState({}, '', '/');
            setAuthView('login');
          }}
        />
      );
    return (
      <LoginPage
        onLogin={handleLogin}
        onForgot={() => setAuthView('forgot')}
      />
    );
  }

  const tabs: NavTab[] = [
    { key: 'dashboard',     label: 'Dashboard',            permission: 'dashboard:read' },
    { key: 'tenders',       label: 'Appels d\'offres',     permission: 'tenders:read' },
    { key: 'profiles',      label: 'Profils consultants',  permission: 'profiles:read' },
    { key: 'deliverables',  label: 'Livrables',            permission: 'deliverables:read' },
    { key: 'commercial',    label: 'Commercial',           permission: 'commercial:read' },
    { key: 'organizations', label: 'Organisations',        permission: 'crm:read' },
    { key: 'opportunities', label: 'Opportunités',         permission: 'crm:read' },
    { key: 'operations',    label: 'Opérations',           permission: 'operations:read' },
    { key: 'data-export',   label: 'Export données',       permission: 'audit:read' },
    { key: 'linkedin',      label: 'Agent LinkedIn',        permission: 'deliverables:write' },
    { key: 'consultant-profiles', label: 'Agent CV Consultant',  permission: 'deliverables:write' },
    { key: 'team',          label: 'Équipe',               permission: 'team:read' },
    { key: 'audit',         label: 'Audit',                permission: 'audit:read' },
    { key: 'workspaces',    label: 'Workspaces',           permission: 'workspaces:read' },
    { key: 'profile',       label: 'Mon profil',           permission: 'profile:read' },
  ];

  const userRole = user?.role;
  const visibleTabs = tabs.filter(tab => can(userRole, tab.permission));
  const selectedTab = visibleTabs.find(t => t.key === view) ?? visibleTabs[0];
  const activeView = selectedTab?.key ?? 'dashboard';
  const userName = getUserName();

  function openView(nextView: RootView) {
    if (!visibleTabs.some(tab => tab.key === nextView)) return;
    setView(nextView);
    setNavOpen(false);
  }

  return (
    <>
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 24px)',
          background: 'rgba(6,14,24,.97)',
          borderBottom: '1px solid rgba(148,163,184,.08)',
          position: 'sticky', top: 0, zIndex: 200,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 900,
            fontSize: '.85rem', letterSpacing: '.06em',
            background: 'linear-gradient(135deg,#facc15,#f59e0b)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            DataSphere
          </span>
          <span style={{ color: '#334155', fontSize: '.75rem', fontFamily: 'monospace' }}>
            IA Platform
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlobalSearchBar onNavigate={(tab) => setView(tab as RootView)} />
          <LangToggle />
          <NotificationsPanel />
          <NotificationBell />

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 12px', borderRadius: 8,
                border: '1px solid rgba(148,163,184,.12)',
                background: 'rgba(255,255,255,.03)',
                cursor: 'pointer', color: '#cbd5e1', fontSize: '.82rem',
              }}
              type="button"
            >
              <UserCircle size={15} color="#64748b" />
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
              <ChevronDown size={12} color="#64748b" />
            </button>

            {userMenuOpen && (
              <div
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  background: '#0c1425', border: '1px solid rgba(148,163,184,.15)',
                  borderRadius: 10, padding: 8, minWidth: 180,
                  boxShadow: '0 12px 40px rgba(0,0,0,.5)',
                  zIndex: 300,
                }}
              >
                <div style={{ padding: '6px 12px', marginBottom: 4, borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                  <div style={{ fontSize: '.72rem', color: '#64748b', fontFamily: 'monospace' }}>Connecté en tant que</div>
                  <div style={{ fontSize: '.83rem', color: '#f1f5f9', marginTop: 2 }}>
                    {user?.email}
                  </div>
                  {user?.role && (
                    <span style={{
                      display: 'inline-block', marginTop: 4, padding: '1px 7px',
                      borderRadius: 99, fontSize: '.67rem',
                      background: 'rgba(250,204,21,.1)', color: '#facc15',
                      border: '1px solid rgba(250,204,21,.2)', fontFamily: 'monospace',
                    }}>
                      {user.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { openView('profile'); setUserMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 12px', borderRadius: 7,
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#94a3b8', fontSize: '.82rem', textAlign: 'left',
                  }}
                >
                  <UserCircle size={13} /> Mon profil
                </button>
                <button
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 12px', borderRadius: 7,
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#fca5a5', fontSize: '.82rem', textAlign: 'left',
                  }}
                >
                  <LogOut size={13} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {userMenuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setUserMenuOpen(false)}
        />
      )}

      {showOnboarding && (
        <OnboardingWizard onComplete={() => { markOnboardingDone(); setShowOnboarding(false); }} />
      )}

      <nav className="root-switcher" aria-label="Navigation principale">
        <button
          className="root-switcher-toggle"
          onClick={() => setNavOpen(o => !o)}
          aria-expanded={navOpen}
          type="button"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {navOpen ? <X size={14} /> : <Menu size={14} />}
            {selectedTab?.label ?? 'Navigation'}
          </span>
          <ChevronDown size={13} style={{ transform: navOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        <div className={`root-switcher-inner${navOpen ? ' open' : ''}`} role="tablist">
          {visibleTabs.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeView === t.key}
              className={activeView === t.key ? 'active' : ''}
              onClick={() => openView(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {activeView === 'dashboard'     && <DashboardPage />}
      {activeView === 'tenders'       && <TenderPage />}
      {activeView === 'profiles'      && <ConsultantProfilesPage />}
      {activeView === 'deliverables'  && <DeliverablePage />}
      {activeView === 'commercial'    && <CommercialPage />}
      {activeView === 'organizations' && <CrmWorkspace token={token} view="organizations" />}
      {activeView === 'opportunities' && <CrmWorkspace token={token} view="opportunities" />}
      {activeView === 'operations'    && <OperationsPage />}
      {activeView === 'data-export'   && <DataExportPage />}
      {activeView === 'linkedin'       && <LinkedInAgentPage />}
      {activeView === 'consultant-profiles' && <ConsultantProfilesPage />}
      {activeView === 'team'          && <TeamPage />}
      {activeView === 'audit'         && <AuditLogPage />}
      {activeView === 'workspaces'    && <WorkspacesPage />}
      {activeView === 'profile'       && <UserProfilePage />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
