import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';

import { apiRequest, tokenStorage } from './api/client';
import type { CurrentUser, LoginResult } from './api/authTypes';
import { CrmWorkspace } from './components/CrmWorkspace';
import NotificationBell from './components/NotificationBell';
import DashboardPage from './pages/DashboardPage';

type View = 'dashboard' | 'organizations' | 'opportunities';

export default function AppConnected() {
  const [accessKey, setAccessKey] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('change-me-now');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');

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
    setError(null);
    try {
      const result = await apiRequest<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      tokenStorage.set(result.access_token);
      setAccessKey(result.access_token);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    }
  }

  function logout() {
    tokenStorage.clear();
    setAccessKey(null);
    setUser(null);
  }

  if (!accessKey) {
    return (
      <main className="app-shell auth-shell">
        <section className="hero auth-card">
          <p className="eyebrow">Connexion securisee</p>
          <h1>Acceder a la plateforme DataSphere</h1>
          <p className="subtitle">Connecte-toi avec le compte administrateur cree au demarrage.</p>
          <form className="form" onSubmit={handleLogin}>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
            <label>Mot de passe<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
            {error && <p className="error">{error}</p>}
            <button type="submit">Se connecter</button>
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
          <NotificationBell />
          <span>{user?.email}</span>
          <button className="icon-button" onClick={logout} type="button">
            <LogOut size={18} /> Deconnexion
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')} type="button">
          Dashboard
        </button>
        <button className={view === 'organizations' ? 'active' : ''} onClick={() => setView('organizations')} type="button">
          Organisations
        </button>
        <button className={view === 'opportunities' ? 'active' : ''} onClick={() => setView('opportunities')} type="button">
          Opportunites
        </button>
      </nav>

      {view === 'dashboard' && <DashboardPage />}
      {(view === 'organizations' || view === 'opportunities') && (
        <CrmWorkspace token={accessKey} view={view} />
      )}
    </main>
  );
}
