import { tokenStorage } from '../api/client';
import { AgentManagementPanel } from '../components/AgentManagementPanel';

export default function ConsultantProfilesPage() {
  const token = tokenStorage.get();

  if (!token) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p className="eyebrow">Consultants augmentes</p>
          <h1>Profils consultants</h1>
          <p>Connecte-toi depuis la console pour acceder au catalogue.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Consultants augmentes</p>
        <h1>Profils consultants</h1>
        <p className="subtitle">
          Installe et pilote les profils standards qui assistent les missions, opportunites et appels d offres.
        </p>
      </section>
      <AgentManagementPanel token={token} />
    </main>
  );
}
