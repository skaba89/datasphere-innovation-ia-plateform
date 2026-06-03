import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, GitBranch, RefreshCw, RotateCcw } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { DeliverableVersionItem } from '../api/domainTypes';

interface DiffLine {
  type: 'add' | 'remove' | 'equal';
  line: string;
  line_no_old: number | null;
  line_no_new: number | null;
}

interface Props {
  deliverableId: number;
  currentVersion: number;
  onRestored?: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function DeliverableVersionsPanel({ deliverableId, currentVersion, onRestored }: Props) {
  const [versions, setVersions] = useState<DeliverableVersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [diffData, setDiffData] = useState<{ version_old: number; version_new: number; lines_added: number; lines_removed: number; diff: DiffLine[] } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const vs = await apiRequest<DeliverableVersionItem[]>(`/deliverables/${deliverableId}/versions`, {}, token);
      setVersions(vs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function snapshot() {
    await apiRequest(`/deliverables/${deliverableId}/versions/snapshot`, {
      method: 'POST',
    }, token);
    load();
  }

  async function showDiff(vOld: number, vNew: number) {
    setDiffLoading(true); setDiffData(null);
    try {
      const d = await apiRequest<any>(`/deliverables/${deliverableId}/versions/${vOld}/diff?compare_to=${vNew}`, {}, token);
      setDiffData(d);
    } finally { setDiffLoading(false); }
  }

  async function restore(versionNumber: number) {
    if (!confirm(`Restaurer la version ${versionNumber} ? Le livrable sera remis en brouillon.`)) return;
    setRestoring(true);
    try {
      await apiRequest(`/deliverables/${deliverableId}/versions/restore`, {
        method: 'POST',
        body: JSON.stringify({ version_number: versionNumber, restored_by: 'Administrateur' }),
      }, token);
      setRestoreMsg(`Version ${versionNumber} restaurée. Le livrable est maintenant en brouillon.`);
      onRestored?.();
      load();
    } finally { setRestoring(false); }
  }

  useEffect(() => {
    if (open && versions.length === 0) load();
  }, [open]);

  const s: React.CSSProperties = {
    background: 'rgba(15,30,54,.85)', border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 14, overflow: 'hidden',
  };

  return (
    <div style={s}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}
      >
        <GitBranch size={15} color="#8b5cf6" />
        <span style={{ fontWeight: 700, fontSize: '.88rem', flex: 1 }}>Historique des versions</span>
        <span style={{ fontSize: '.74rem', color: '#64748b', marginRight: 6 }}>{versions.length} snapshot{versions.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronUp size={13} color="#64748b" /> : <ChevronDown size={13} color="#64748b" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(148,163,184,.08)' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid rgba(148,163,184,.06)' }}>
            <button onClick={snapshot} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 12px', borderRadius: 7, border: 'none', background: 'rgba(139,92,246,.15)', color: '#a78bfa', cursor: 'pointer', fontSize: '.76rem', fontWeight: 700 }}>
              <GitBranch size={11} /> Créer un snapshot
            </button>
            <button onClick={load} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.76rem' }}>
              <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>

          {restoreMsg && (
            <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,.08)', color: '#86efac', fontSize: '.8rem', borderBottom: '1px solid rgba(148,163,184,.06)' }}>
              ✓ {restoreMsg}
            </div>
          )}

          {/* Version list */}
          {versions.length === 0 && !loading && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: '#64748b', fontSize: '.82rem' }}>
              Aucun snapshot. Créez-en un pour commencer l'historique.
            </div>
          )}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {versions.map((v, i) => {
              const isLatest = v.version === currentVersion;
              const prevV = versions[i + 1];
              return (
                <div key={v.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Version badge */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: isLatest ? 'rgba(250,204,21,.12)' : 'rgba(148,163,184,.08)',
                    border: `1px solid ${isLatest ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.7rem', fontWeight: 800, fontFamily: 'monospace',
                    color: isLatest ? '#facc15' : '#64748b',
                  }}>
                    v{v.version}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.83rem', marginBottom: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {v.title.length > 45 ? v.title.slice(0, 44) + '…' : v.title}
                      {isLatest && <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: '.65rem', fontWeight: 700, background: 'rgba(250,204,21,.1)', color: '#facc15' }}>current</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: '.73rem', color: '#64748b', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Clock size={10} /> {fmtDate(v.created_at)}
                      </span>
                      {v.created_by && <span>par {v.created_by}</span>}
                      {v.change_note && <span style={{ fontStyle: 'italic' }}>"{v.change_note}"</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {prevV && (
                      <button
                        onClick={() => showDiff(prevV.version, v.version)}
                        style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '.72rem' }}
                      >
                        diff
                      </button>
                    )}
                    {!isLatest && (
                      <button
                        onClick={() => restore(v.version)}
                        disabled={restoring}
                        style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 9px', borderRadius: 6, border: 'none', background: 'rgba(139,92,246,.12)', cursor: 'pointer', color: '#a78bfa', fontSize: '.72rem' }}
                      >
                        <RotateCcw size={10} /> restaurer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diff viewer */}
          {(diffLoading || diffData) && (
            <div style={{ borderTop: '1px solid rgba(148,163,184,.1)', padding: '12px 16px' }}>
              {diffLoading && <div style={{ color: '#64748b', fontSize: '.8rem' }}>Calcul du diff…</div>}
              {diffData && (
                <>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: '.76rem' }}>
                    <span style={{ color: '#64748b' }}>v{diffData.version_old} → v{diffData.version_new}</span>
                    <span style={{ color: '#86efac' }}>+{diffData.lines_added} ajouts</span>
                    <span style={{ color: '#fca5a5' }}>-{diffData.lines_removed} suppressions</span>
                    <button onClick={() => setDiffData(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '.72rem' }}>Fermer</button>
                  </div>
                  <div style={{ background: '#020617', borderRadius: 8, padding: '10px 12px', maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: '.74rem', lineHeight: 1.6 }}>
                    {diffData.diff.filter(l => l.type !== 'equal').slice(0, 60).map((l, i) => (
                      <div key={i} style={{
                        color: l.type === 'add' ? '#86efac' : '#fca5a5',
                        background: l.type === 'add' ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)',
                        padding: '1px 4px', borderRadius: 2,
                      }}>
                        {l.type === 'add' ? '+' : '-'} {l.line || ' '}
                      </div>
                    ))}
                    {diffData.diff.filter(l => l.type !== 'equal').length === 0 && (
                      <div style={{ color: '#64748b' }}>Aucune différence textuelle.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
