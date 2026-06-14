
import React from 'react';
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#fca5a5', fontWeight: 700 }}>Une erreur est survenue</p>
        <p style={{ color: '#64748b', fontSize: '.82rem' }}>{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e40af', color: 'white', cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
    return this.props.children;
  }
}

import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Target, FileText, Briefcase, Building2, TrendingUp,
  Settings, Download, Share2, UserCheck, Bell, Search, Zap, Users, Shield,
  Layers, UserCircle, LogOut, ChevronLeft, Menu, X, ChevronRight,
} from 'lucide-react';

import { apiRequest, tokenStorage } from './api/client';
import { getUserName } from './api/userContext';
import type { CurrentUser, LoginResult } from './api/authTypes';
import { can, type AppPermission } from './auth/rbac';

import AuditLogPage from './pages/AuditLogPage';
import CommercialPage from './pages/CommercialPage';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import NotificationsPage from './pages/NotificationsPage';
import SearchPage from './pages/SearchPage';
import AIProvidersPage from './pages/AIProvidersPage';
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
import { LangToggle, useI18n } from './i18n';
import { useRealtimeToasts } from './hooks/useRealtimeToasts';
import { useWorkflowSSE } from './hooks/useWorkflowSSE';
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
  | 'notifications'
  | 'search'
  | 'ai-providers'
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


function ThemeToggle() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('datasphere_theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  function setTheme(t: 'dark' | 'light') {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('datasphere_theme', t); } catch {}
  }
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
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
  const [sidebarMini, setSidebarMini] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const [toasts, setToasts] = useState<ToastEvent[]>([]);
  const addToast = (t: ToastEvent) => setToasts(prev => [...prev.slice(-3), t]);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Real-time SSE toasts
  useRealtimeToasts(token, addToast);

  // Workflow real-time events → toasts
  useWorkflowSSE({
    token,
    onEvent: (event) => {
      if (event.type === 'workflow.step_awaiting') {
        addToast({ id: `wf-${Date.now()}`, type: 'warning', title: '⏳ Validation requise',
          message: `Étape « ${(event as any).step_label || (event as any).step_key} » en attente de votre approbation`, at: Date.now() });
      } else if (event.type === 'workflow.step_done') {
        addToast({ id: `wf-${Date.now()}`, type: 'success', title: '✅ Étape terminée',
          message: `« ${(event as any).step_label || (event as any).step_key} » complétée`, at: Date.now() });
      } else if (event.type === 'workflow.completed') {
        addToast({ id: `wf-${Date.now()}`, type: 'success', title: '🎉 Workflow terminé !',
          message: 'Le mémoire technique est prêt à consulter', at: Date.now() });
      }
    },
  });

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

  const { t } = useI18n();

  // ── Navigation icon mapping ──────────────────────────────────
  const NAV_ICONS: Record<string, React.ReactElement> = {
    dashboard:            <LayoutDashboard size={16} />,
    tenders:              <Target size={16} />,
    deliverables:         <FileText size={16} />,
    commercial:           <Briefcase size={16} />,
    organizations:        <Building2 size={16} />,
    opportunities:        <TrendingUp size={16} />,
    operations:           <Settings size={16} />,
    'data-export':        <Download size={16} />,
    linkedin:             <Share2 size={16} />,
    'consultant-profiles':<UserCheck size={16} />,
    notifications:        <Bell size={16} />,
    search:               <Search size={16} />,
    'ai-providers':       <Zap size={16} />,
    team:                 <Users size={16} />,
    audit:                <Shield size={16} />,
    workspaces:           <Layers size={16} />,
    profile:              <UserCircle size={16} />,
    settings:             <Settings size={16} />,
  };

  // ── Navigation groups ────────────────────────────────────────
  const NAV_GROUPS = [
    { label: 'Principal', keys: ['dashboard', 'tenders', 'deliverables'] },
    { label: 'CRM',       keys: ['organizations', 'opportunities', 'commercial'] },
    { label: 'IA',        keys: ['ai-providers', 'consultant-profiles', 'linkedin'] },
    { label: 'Opérations',keys: ['operations', 'data-export'] },
    { label: 'Admin',     keys: ['team', 'audit', 'workspaces'] },
    { label: 'Personnel', keys: ['notifications', 'search', 'profile', 'settings'] },
  ];

  // Bottom bar items (mobile) — top 5 most used
  const BOTTOM_TABS = ['dashboard', 'tenders', 'deliverables', 'operations', 'search'];



  const tabs: NavTab[] = [
    { key: 'dashboard',     label: t('nav.dashboard'),            permission: 'dashboard:read' },
    { key: 'tenders',       label: t('nav.tenders'),     permission: 'tenders:read' },
    { key: 'profiles',      label: t('nav.profiles'),  permission: 'profiles:read' },
    { key: 'deliverables',  label: t('nav.deliverables'),            permission: 'deliverables:read' },
    { key: 'commercial',    label: t('nav.commercial'),           permission: 'commercial:read' },
    { key: 'organizations', label: t('nav.organizations'),        permission: 'crm:read' },
    { key: 'opportunities', label: t('nav.opportunities'),         permission: 'crm:read' },
    { key: 'operations',    label: t('nav.operations'),           permission: 'operations:read' },
    { key: 'data-export',   label: t('nav.data_export'),       permission: 'audit:read' },
    { key: 'linkedin',      label: t('nav.linkedin'),        permission: 'deliverables:write' },
    { key: 'consultant-profiles', label: t('nav.cv_consultant'),  permission: 'deliverables:write' },
    { key: 'notifications',       label: t('nav.notifications'),    permission: 'deliverables:read'  },
    { key: 'search',              label: t('nav.search'),           permission: 'deliverables:read'  },
    { key: 'ai-providers',        label: t('nav.ai_providers'),     permission: 'operations:read'              },
    { key: 'team',          label: t('nav.team'),               permission: 'team:read' },
    { key: 'audit',         label: t('nav.audit'),                permission: 'audit:read' },
    { key: 'workspaces',    label: t('nav.workspaces'),           permission: 'workspaces:read' },
    { key: 'profile',       label: t('nav.profile'),           permission: 'profile:read' },
    { key: 'settings',      label: t('nav.settings'),          permission: 'profile:read' },
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

  const initials = userName?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || 'DS';

  return (
    <div className={`ds-app${sidebarMini ? ' ds-sidebar-mini' : ''}`}>

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="ds-header">
        {/* Logo */}
        <div className="ds-header-logo">
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#facc15,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '.7rem', fontWeight: 900, color: '#0a0f1a' }}>DS</span>
          </div>
          <div>
            <div className="ds-logo-text">DataSphere</div>
            <div className="ds-logo-badge">IA Platform</div>
          </div>
        </div>

        {/* Burger (mobile) */}
        <button className="ds-burger" onClick={() => setNavOpen(o => !o)} type="button" aria-label="Menu">
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Center */}
        <div className="ds-header-center">
          <GlobalSearchBar onNavigate={(tab) => openView(tab as RootView)} />
        </div>

        {/* Right actions */}
        <div className="ds-header-right">
          <ThemeToggle />
          <LangToggle />
          <NotificationsPanel />
          <NotificationBell />

          {/* Sidebar collapse (desktop) */}
          <button
            className="ds-pin-btn"
            onClick={() => setSidebarMini(m => !m)}
            title={sidebarMini ? 'Développer le menu' : 'Réduire le menu'}
            type="button"
            style={{ display: 'none' }}
            id="ds-pin-btn-desktop"
          >
            {sidebarMini ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 10px 5px 5px', borderRadius: 10,
                border: '1px solid rgba(148,163,184,.12)',
                background: 'rgba(255,255,255,.03)',
                cursor: 'pointer', color: '#cbd5e1',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#1e40af,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {initials}
              </div>
              <span style={{ fontSize: '.78rem', fontWeight: 600, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
            </button>
            {userMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: '0 12px 40px rgba(0,0,0,.5)', zIndex: 400 }}>
                <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid rgba(148,163,184,.08)', marginBottom: 4 }}>
                  <div style={{ fontSize: '.7rem', color: '#64748b' }}>Connecté en tant que</div>
                  <div style={{ fontSize: '.82rem', color: '#f1f5f9', marginTop: 2, fontWeight: 600 }}>{user?.email}</div>
                  {user?.role && (
                    <span style={{ display: 'inline-block', marginTop: 4, padding: '1px 7px', borderRadius: 99, fontSize: '.67rem', background: 'rgba(250,204,21,.1)', color: '#facc15', border: '1px solid rgba(250,204,21,.2)', fontFamily: 'monospace' }}>
                      {user.role}
                    </span>
                  )}
                </div>
                <button onClick={() => { openView('profile'); setUserMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '.82rem', textAlign: 'left' }}>
                  <UserCircle size={13} /> Mon profil
                </button>
                <button onClick={() => { logout(); setUserMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: '.82rem', textAlign: 'left' }}>
                  <LogOut size={13} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {userMenuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 399 }} onClick={() => setUserMenuOpen(false)} />}

      {/* ── Layout body ───────────────────────────────────────── */}
      <div className="ds-body">

        {/* Overlay mobile */}
        {navOpen && (
          <div className="ds-sidebar-overlay" onClick={() => setNavOpen(false)} />
        )}

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <nav className={`ds-sidebar${navOpen ? ' ds-sidebar-open' : ''}`} aria-label="Navigation principale">
          <div className="ds-sidebar-scroll">
            {NAV_GROUPS.map((group) => {
              const groupItems = group.keys
                .map(key => visibleTabs.find(t => t.key === key))
                .filter(Boolean) as NavTab[];
              if (groupItems.length === 0) return null;
              return (
                <div key={group.label} className="ds-nav-group">
                  <div className="ds-nav-group-label">
                    <div className="ds-nav-group-divider" style={{ flex: 1 }} />
                    <span className="ds-nav-group-label-text">{group.label}</span>
                    <div className="ds-nav-group-divider" style={{ flex: 1 }} />
                  </div>
                  {groupItems.map(tab => (
                    <button
                      key={tab.key}
                      className={`ds-nav-item${activeView === tab.key ? ' active' : ''}`}
                      onClick={() => openView(tab.key)}
                      data-tooltip={tab.label}
                      type="button"
                    >
                      <span className="ds-nav-icon">
                        {NAV_ICONS[tab.key] ?? <Settings size={16} />}
                      </span>
                      <span className="ds-nav-label">{tab.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Sidebar footer — user + collapse */}
          <div className="ds-sidebar-footer">
            <button
              className="ds-user-pill"
              onClick={() => openView('profile')}
              type="button"
            >
              <div className="ds-user-avatar">{initials}</div>
              <div className="ds-user-info">
                <div className="ds-user-name">{userName}</div>
                <div className="ds-user-role">{user?.role}</div>
              </div>
            </button>
            {/* Collapse toggle (desktop) */}
            <button
              onClick={() => setSidebarMini(m => !m)}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', marginTop: 6, padding: '6px', borderRadius: 8,
                border: '1px solid rgba(148,163,184,.08)', background: 'none',
                color: '#334155', cursor: 'pointer', gap: 6, fontSize: '.72rem',
                transition: 'all .15s',
              }}
            >
              {sidebarMini ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /><span style={{ opacity: 1 }}>Réduire</span></>}
            </button>
          </div>
        </nav>

        {/* ── Main ─────────────────────────────────────────────── */}
        <main className="ds-main">
          <ErrorBoundary>
            {activeView === 'dashboard'          && <DashboardPage />}
            {activeView === 'tenders'            && <TenderPage />}
            {activeView === 'profiles'           && <CrmWorkspace token={token} view='organizations' />}
            {activeView === 'deliverables'       && <DeliverablePage />}
            {activeView === 'commercial'         && <CommercialPage />}
            {activeView === 'organizations'      && <CrmWorkspace token={token} view='organizations' />}
            {activeView === 'opportunities'      && <CrmWorkspace token={token} view='opportunities' />}
            {activeView === 'operations'         && <OperationsPage />}
            {activeView === 'team'               && <TeamPage />}
            {activeView === 'audit'              && <AuditLogPage />}
            {activeView === 'profile'            && <UserProfilePage />}
            {activeView === 'workspaces'         && <WorkspacesPage />}
            {activeView === 'data-export'        && <DataExportPage />}
            {activeView === 'linkedin'           && <LinkedInAgentPage />}
            {activeView === 'consultant-profiles' && <ConsultantProfilesPage />}
            {activeView === 'notifications'      && <NotificationsPage />}
            {activeView === 'search'             && <SearchPage />}
            {activeView === 'ai-providers'       && <AIProvidersPage />}
            {activeView === 'settings'           && <OperationsPage />}
          </ErrorBoundary>
        </main>

        {/* ── Bottom tab bar (mobile only) ─────────────────────── */}
        <nav className="ds-bottom-bar" aria-label="Navigation rapide">
          {BOTTOM_TABS
            .map(key => visibleTabs.find(t => t.key === key))
            .filter(Boolean)
            .map(tab => tab && (
              <button
                key={tab.key}
                className={`ds-bottom-tab${activeView === tab.key ? ' active' : ''}`}
                onClick={() => openView(tab.key)}
                type="button"
              >
                <span style={{ fontSize: 20 }}>
                  {NAV_ICONS[tab.key] ?? <Settings size={20} />}
                </span>
                <span className="ds-bottom-tab-label">{tab.label}</span>
              </button>
            ))
          }
          {/* More button */}
          <button
            className={`ds-bottom-tab${navOpen ? ' active' : ''}`}
            onClick={() => setNavOpen(o => !o)}
            type="button"
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
            <span className="ds-bottom-tab-label">Menu</span>
          </button>
        </nav>
      </div>

      {/* ── Toasts ───────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => { markOnboardingDone(); setShowOnboarding(false); }} />
      )}
    </div>
  );
}
