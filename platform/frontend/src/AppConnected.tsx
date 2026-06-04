import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';

import { apiRequest, tokenStorage } from './api/client';
import type { CurrentUser, LoginResult } from './api/authTypes';
import { CrmWorkspace } from './components/CrmWorkspace';
import NotificationBell from './components/NotificationBell';
import GlobalSearchBar from './components/GlobalSearchBar';
import NotificationsPanel from './components/NotificationsPanel';
import DashboardPage from './pages/DashboardPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

type View = 'dashboard' | 'organizations' | 'opportunities';
type AuthView = 'login' | 'forgot' | 'reset';

export default function AppConnected() {
  const [accessKey, setAccessKey] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('token') ? 'reset' : 'login';
  });

  useEffect(() => {
    if (!accessKey) return;
    apiRequest<CurrentUser>('/auth/me', {}, accessKey)
      .then(setUser)
      .catch(() => {
        tokenStorage.clear();
        setAccessKey(null);
        setUser(null);
      });
  }, [accessKey]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoggingIn) return;
    setError(null);
    setIsLoggingIn(true);
    try {
      const result = await apiRequest<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password: passwordInput }),
      });
      tokenStorage.set(result.access_token, result.refresh_token);
      setAccessKey(result.access_token);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout() {
    tokenStorage.clear();
    setAccessKey(null);
    setUser(null);
  }

  if (!accessKey) {
    if (authView === 'forgot') {
      return <ForgotPasswordPage onBack={() => setAuthView('login')} />;
    }
    if (authView === 'reset') {
      return <ResetPasswordPage onSuccess={() => { window.history.replaceState({}, '', '/'); setAuthView('login'); }} />;
    }
    return (
      <main className="app-shell auth-shell">
        <section className="hero auth-card">
          <p className="eyebrow">Connexion sécurisée</p>
          <h1>Accéder à la plateforme DataSphere</h1>
          <p className="subtitle">Connecte-toi avec le compte administrateur créé au démarrage.</p>
          <form className="form" onSubmit={handleLogin} aria-busy={isLoggingIn}>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" disabled={isLoggingIn} /></label>
            <label>Mot de passe<input value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} type="password" disabled={isLoggingIn} /></label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isLoggingIn}>{isLoggingIn ? 'Connexion…' : 'Se connecter'}</button>
            <button type="button" onClick={() => setAuthView('forgot')} disabled={isLoggingIn} style={{ background: 'none', border: 'none', cursor: isLoggingIn ? 'not-allowed' : 'pointer', color: '#64748b', fontSize: '.8rem', marginTop: 8, textDecoration: 'underline' }}>
              Mot de passe oublié ?
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DataSphere Innovation IA Platform</p>
          <h1>Console</h1>
        </div>
        <div className="user-box" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobalSearchBar />
          <NotificationsPanel />
          <NotificationBell />
          <span>{user?.email}</span>
          <button className="icon-button" onClick={logout} type="button">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')} type="button">Dashboard</button>
        <button className={view === 'organizations' ? 'active' : ''} onClick={() => setView('organizations')} type="button">Organisations</button>
        <button className={view === 'opportunities' ? 'active' : ''} onClick={() => setView('opportunities')} type="button">Opportunités</button>
      </nav>

      {view === 'dashboard' && <DashboardPage />}
      {(view === 'organizations' || view === 'opportunities') && (
        <CrmWorkspace token={accessKey} view={view} role={user?.role} />
      )}
    </main>
  );
}
