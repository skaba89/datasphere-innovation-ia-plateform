import { useEffect, useMemo, useState } from 'react';
import { Brain, BriefcaseBusiness, FileCheck2, LogOut, ShieldCheck } from 'lucide-react';

import { apiRequest, tokenStorage } from './api/client';
import type { CurrentUser, LoginResult } from './api/authTypes';
import type { Opportunity, Organization } from './api/domainTypes';

type View = 'dashboard' | 'organizations' | 'opportunities';

const cards = [
  {
    title: 'CRM Opportunites',
    description: 'Suivre prospects, partenaires, appels d offres et pipeline commercial.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Appels d offres',
    description: 'Analyser les cahiers des charges, produire matrices et livrables.',
    icon: FileCheck2,
  },
  {
    title: 'Agents IA',
    description: 'Utiliser des agents specialises supervises par des experts humains.',
    icon: Brain,
  },
  {
    title: 'Gouvernance',
    description: 'Tracer les decisions, valider les livrables et securiser les donnees.',
    icon: ShieldCheck,
  },
];

function App() {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('change-me-now');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    if (!token) return;
    apiRequest<CurrentUser>('/auth/me', {}, token)
      .then(setUser)
      .catch(() => {
        tokenStorage.clear();
        setToken(null);
        setUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<Organization[]>('/organizations', {}, token),
      apiRequest<Opportunity[]>('/opportunities', {}, token),
    ])
      .then(([orgs, opps]) => {
        setOrganizations(orgs);
        setOpportunities(opps);
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const result = await apiRequest<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      tokenStorage.set(result.access_token);
      setToken(result.access_token);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    }
  }

  function logout() {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setOpportunities([]);
  }

  if (!isAuthenticated) {
    return (
      <main className="app-shell auth-shell">
        <section className="hero auth-card">
          <p className="eyebrow">Connexion securisee</p>
          <h1>Acceder a la plateforme DataSphere</h1>
          <p className="subtitle">
            Connecte-toi avec le compte admin cree via /api/v1/auth/bootstrap-admin.
          </p>
          <form className="form" onSubmit={handleLogin}>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>
            <label>
              Mot de passe
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
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
          <h1>Console MVP</h1>
        </div>
        <div className="user-box">
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

      {error && <p className="error">{error}</p>}

      {view === 'dashboard' && (
        <>
          <section className="stats">
            <article><strong>{organizations.length}</strong><span>Organisations</span></article>
            <article><strong>{opportunities.length}</strong><span>Opportunites</span></article>
            <article><strong>{opportunities.filter((item) => item.priority === 'Haute').length}</strong><span>Priorite haute</span></article>
          </section>
          <section className="grid">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="card">
                  <Icon size={28} />
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </article>
              );
            })}
          </section>
        </>
      )}

      {view === 'organizations' && (
        <section className="panel">
          <h2>Organisations</h2>
          <div className="table">
            {organizations.map((org) => (
              <article key={org.id} className="row-card">
                <strong>{org.name}</strong>
                <span>{org.country || 'Pays non renseigne'} · {org.sector || 'Secteur non renseigne'}</span>
              </article>
            ))}
            {organizations.length === 0 && <p>Aucune organisation pour le moment.</p>}
          </div>
        </section>
      )}

      {view === 'opportunities' && (
        <section className="panel">
          <h2>Opportunites</h2>
          <div className="table">
            {opportunities.map((opp) => (
              <article key={opp.id} className="row-card">
                <strong>{opp.title}</strong>
                <span>{opp.status} · Priorite {opp.priority} · Probabilite {opp.probability}%</span>
              </article>
            ))}
            {opportunities.length === 0 && <p>Aucune opportunite pour le moment.</p>}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
