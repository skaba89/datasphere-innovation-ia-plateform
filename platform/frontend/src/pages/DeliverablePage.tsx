import { useEffect, useState } from 'react';

import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';
import { DeliverablePanel } from '../components/DeliverablePanel';

export default function DeliverablePage() {
  const token = tokenStorage.get();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<CurrentUser>('/auth/me', {}, token)
      .then(setUser)
      .catch(() => setUser(null));
  }, [token]);

  if (!token) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p className="eyebrow">Livrables gouvernés</p>
          <h1>Bibliothèque de livrables</h1>
          <p>Connecte-toi depuis la console pour accéder au module livrables.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Livrables gouvernés</p>
        <h1>Bibliothèque de livrables</h1>
        <p className="subtitle">
          Génère des brouillons structurés (note de cadrage, mémoire technique, offre
          commerciale…), soumets-les en révision, puis approuve-les avant toute
          transmission client. Validation humaine obligatoire.
        </p>
      </section>
      <DeliverablePanel token={token} role={user?.role} />
    </main>
  );
}
