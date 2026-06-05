import { tokenStorage } from '../api/client';
import { AgentManagementPanel } from '../components/AgentManagementPanel';
import { AgentOperationsPanel } from '../components/AgentOperationsPanel';

export default function ConsultantProfilesPage() {
  const token = tokenStorage.get();

  if (!token) {
    return (
      <main className="app-shell profiles-page">
        <section className="panel">
          <p className="eyebrow">Consultants augmentés</p>
          <h1>Profils consultants</h1>
          <p>Connecte-toi depuis la console pour accéder au catalogue.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell profiles-page">
      <section className="panel">
        <p className="eyebrow">Consultants augmentés</p>
        <h1>Profils consultants</h1>
        <p className="subtitle">
          Installe les profils standards, affecte-les aux opportunités ou appels d'offres, puis génère les actions gouvernées.
        </p>
      </section>
      <section className="profiles-panels">
        <AgentManagementPanel token={token} />
        <AgentOperationsPanel token={token} />
      </section>
    </main>
  );
}
