import { useEffect, useState } from 'react';

import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';
import { TenderAutomationPanel } from '../components/TenderAutomationPanel';
import { TenderWorkspace } from '../components/TenderWorkspace';

export default function TenderPage() {
  const accessKey = tokenStorage.get();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!accessKey) return;
    apiRequest<CurrentUser>('/auth/me', {}, accessKey)
      .then(setUser)
      .catch(() => setUser(null));
  }, [accessKey]);

  if (!accessKey) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Appels d'offres</h1>
          <p>Connecte-toi d'abord pour accéder au module.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Module stratégique</p>
        <h1>Appels d'offres</h1>
        <p className="subtitle">Qualification, exigences, Go / No-Go et matrice de conformité.</p>
      </section>
      <TenderAutomationPanel token={accessKey} role={user?.role} />
      <TenderWorkspace token={accessKey} role={user?.role} />
    </main>
  );
}
