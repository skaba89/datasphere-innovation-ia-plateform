import { tokenStorage } from '../api/client';
import { TenderAutomationPanel } from '../components/TenderAutomationPanel';
import { TenderWorkspace } from '../components/TenderWorkspace';

export default function TenderPage() {
  const accessKey = tokenStorage.get();

  if (!accessKey) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Appels d offres</h1>
          <p>Connecte-toi d abord pour acceder au module.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Module strategique</p>
        <h1>Appels d offres</h1>
        <p className="subtitle">Qualification, exigences, Go / No-Go et matrice de conformite.</p>
      </section>
      <TenderAutomationPanel token={accessKey} />
      <TenderWorkspace token={accessKey} />
    </main>
  );
}
