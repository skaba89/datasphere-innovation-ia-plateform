import { tokenStorage } from '../api/client';
import { AgentManagementPanel } from '../components/AgentManagementPanel';
import { AgentOperationsPanel } from '../components/AgentOperationsPanel';

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
          Installe les profils standards, affecte-les aux opportunites ou appels d offres, puis genere les actions gouvernees.
        </p>
      </section>
      <AgentManagementPanel token={token} />
      <AgentOperationsPanel token={token} />
    </main>
  );
}
