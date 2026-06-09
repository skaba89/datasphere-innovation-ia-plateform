import { useEffect, useState } from 'react';
import { FileText, Zap } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';
import { TenderWorkspace } from '../components/TenderWorkspace';
import TenderPDFUpload from '../components/TenderPDFUpload';
import WorkflowPanel from '../components/WorkflowPanel';

interface TenderOption { id: number; title: string; }

export default function TenderPage() {
  const accessKey = tokenStorage.get();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [defaultOppId, setDefaultOppId] = useState<number>(0);
  const [tenders, setTenders] = useState<TenderOption[]>([]);
  const [activeTenderId, setActiveTenderId] = useState<number | null>(null);
  const [showWorkflow, setShowWorkflow] = useState(false);

  useEffect(() => {
    if (!accessKey) return;
    apiRequest<{ id: number }[]>('/opportunities', {}, accessKey)
      .then(opps => { if (opps.length > 0) setDefaultOppId(opps[0].id); })
      .catch(() => {});
    apiRequest<CurrentUser>('/auth/me', {}, accessKey)
      .then(setUser).catch(() => setUser(null));
    apiRequest<TenderOption[]>('/tenders?limit=50', {}, accessKey)
      .then(list => {
        setTenders(list ?? []);
        if (list?.length > 0) setActiveTenderId(list[0].id);
      })
      .catch(() => {});
  }, [accessKey]);

  if (!accessKey) return (
    <main className="app-shell">
      <section className="panel">
        <h1>Appels d'offres</h1>
        <p>Connecte-toi d'abord pour accéder au module.</p>
      </section>
    </main>
  );

  const activeTender = tenders.find(t => t.id === activeTenderId);

  return (
    <main className="app-shell">

      {/* PDF Upload modal */}
      {showPDFUpload && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 5000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', padding: 16,
        }}>
          <TenderPDFUpload
            opportunityId={defaultOppId || 1}
            onCreated={() => { setShowPDFUpload(false); window.location.reload(); }}
            onClose={() => setShowPDFUpload(false)}
          />
        </div>
      )}

      {/* Header */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Module stratégique</p>
            <h1>Appels d'offres</h1>
            <p className="subtitle">Qualification, workflow IA, validation humaine, livrable.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <button
              onClick={() => setShowPDFUpload(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(250,204,21,.25)', background: 'rgba(250,204,21,.08)', color: '#facc15', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem' }}
            >
              <FileText size={14} /> Importer PDF
            </button>
            <button
              onClick={() => setShowWorkflow(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: `1px solid ${showWorkflow ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.15)'}`, background: showWorkflow ? 'rgba(250,204,21,.1)' : 'none', color: showWorkflow ? '#facc15' : '#64748b', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem' }}
            >
              <Zap size={14} /> Workflow IA
            </button>
          </div>
        </div>
      </section>

      {/* Workflow panel — inline, collapsible */}
      {showWorkflow && (
        <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>

          {/* AO selector */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 700 }}>AO cible :</span>
            {tenders.length === 0 ? (
              <span style={{ fontSize: '.78rem', color: '#475569' }}>Aucun AO — créez-en un d'abord.</span>
            ) : (
              <select
                value={activeTenderId ?? ''}
                onChange={e => setActiveTenderId(Number(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', color: '#e2e8f0', fontSize: '.82rem', cursor: 'pointer', minWidth: 220 }}
              >
                {tenders.map(t => (
                  <option key={t.id} value={t.id}>#{t.id} — {t.title}</option>
                ))}
              </select>
            )}
          </div>

          {activeTenderId && (
            <WorkflowPanel
              tenderId={activeTenderId}
              tenderTitle={activeTender?.title}
              token={accessKey}
            />
          )}
        </section>
      )}

      {/* Workspace — liste + édition AO */}
      <TenderWorkspace token={accessKey} />
    </main>
  );
}
