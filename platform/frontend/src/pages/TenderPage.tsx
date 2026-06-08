import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';
import { TenderAutomationPanel } from '../components/TenderAutomationPanel';
import { TenderWorkspace } from '../components/TenderWorkspace';
import TenderPDFUpload from '../components/TenderPDFUpload';

export default function TenderPage() {
  const accessKey = tokenStorage.get();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [defaultOppId, setDefaultOppId] = useState<number>(0);

  // Load first opportunity as default for PDF import
  useEffect(() => {
    if (!accessKey) return;
    apiRequest<{ id: number }[]>('/opportunities', {}, accessKey)
      .then(opps => { if (opps.length > 0) setDefaultOppId(opps[0].id); })
      .catch(() => {});
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
      {/* PDF Upload modal */}
      {showPDFUpload && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 5000, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', padding: 16,
        }}>
          <TenderPDFUpload
            opportunityId={defaultOppId || 1}
            onCreated={() => { setShowPDFUpload(false); window.location.reload(); }}
            onClose={() => setShowPDFUpload(false)}
          />
        </div>
      )}

      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Module stratégique</p>
            <h1>Appels d'offres</h1>
            <p className="subtitle">Qualification, exigences, Go / No-Go et matrice de conformité.</p>
          </div>
          <button
            onClick={() => setShowPDFUpload(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'rgba(250,204,21,.12)', color: '#facc15',
              cursor: 'pointer', fontWeight: 700, fontSize: '.84rem',
              border_: '1px solid rgba(250,204,21,.25)',
              marginTop: 8, flexShrink: 0,
            } as React.CSSProperties}
          >
            <FileText size={15} />
            Importer depuis PDF
          </button>
        </div>
      </section>
      <TenderAutomationPanel token={accessKey} role={user?.role} />
      <TenderWorkspace token={accessKey} />
    </main>
  );
}
