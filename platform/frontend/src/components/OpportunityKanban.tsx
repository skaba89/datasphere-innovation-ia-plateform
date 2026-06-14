/**
 * OpportunityKanban — Pipeline commercial visuel
 *
 * Kanban avec colonnes par stade commercial.
 * Drag & drop pour déplacer une opportunité entre les stades.
 * Mise à jour automatique via PATCH /opportunities/{id}
 */

import { useEffect, useRef, useState } from 'react';
import {
  Building2, ChevronRight, Euro, Loader2, Plus, RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface Opportunity {
  id:              number;
  title:           string;
  status:          string;
  potential_value: number | null;
  organization_id: number;
  source:          string | null;
  probability:     number | null;
  organization?:   { name: string };
}

const STAGES = [
  { key: 'Prospect identifié',        color: '#64748b', bg: 'rgba(100,116,139,.08)', label: 'Prospects' },
  { key: 'Analyse en cours',           color: '#3b82f6', bg: 'rgba(59,130,246,.08)',  label: 'En analyse' },
  { key: 'GO — En cours de réponse',   color: '#facc15', bg: 'rgba(250,204,21,.08)',  label: 'GO ✍️' },
  { key: 'Réponse soumise',            color: '#8b5cf6', bg: 'rgba(139,92,246,.08)', label: 'Soumis' },
  { key: 'Mission gagnée',             color: '#22c55e', bg: 'rgba(34,197,94,.08)',   label: 'Gagné 🏆' },
  { key: 'NO GO — Écarté',             color: '#ef4444', bg: 'rgba(239,68,68,.08)',   label: 'NO GO' },
];

function formatValue(v: number | null) {
  if (!v) return null;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k€`;
  return `${v}€`;
}

export default function OpportunityKanban({ token }: { token: string | null }) {
  const [opps,     setOpps]     = useState<Opportunity[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [dragging, setDragging] = useState<Opportunity | null>(null);
  const [over,     setOver]     = useState<string | null>(null);
  const [moving,   setMoving]   = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const raw = await apiRequest<unknown>('/opportunities?limit=100', {}, token);
      setOpps(Array.isArray(raw) ? raw as Opportunity[] : []);
    } catch { setOpps([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function moveOpp(opp: Opportunity, newStatus: string) {
    if (opp.status === newStatus) return;
    setMoving(opp.id);
    try {
      await apiRequest(`/opportunities/${opp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }, token);
      setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, status: newStatus } : o));
    } finally { setMoving(null); }
  }

  // Totals per stage
  function stageTotal(stage: string) {
    const stageOpps = opps.filter(o => o.status === stage);
    const total = stageOpps.reduce((s, o) => s + (o.potential_value || 0), 0);
    return { count: stageOpps.length, total };
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <Loader2 size={22} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
    </div>
  );

  if (opps.length === 0) return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <Building2 size={32} color="#334155" style={{ margin: '0 auto 10px', display: 'block' }} />
      <p style={{ color: '#94a3b8', fontWeight: 700, margin: '0 0 6px' }}>Aucune opportunité</p>
      <p style={{ color: '#64748b', fontSize: '.8rem', margin: 0 }}>
        Lance un "Sync CRM complet" dans l'onglet Automatisation IA pour générer les opportunités depuis les AOs.
      </p>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <span style={{ fontSize: '.82rem', color: '#64748b' }}>
            {opps.length} opportunités ·{' '}
            <span style={{ color: '#22c55e', fontWeight: 700 }}>
              {formatValue(opps.filter(o => o.status === 'Mission gagnée').reduce((s, o) => s + (o.potential_value || 0), 0))} gagnés
            </span>
          </span>
        </div>
        <button onClick={load} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.76rem' }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {/* Drag tip */}
      <p style={{ margin: 0, fontSize: '.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronRight size={12} /> Glisse une carte d'une colonne à l'autre pour changer le stade
      </p>

      {/* Kanban board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${STAGES.length}, minmax(180px, 1fr))`,
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 8,
      }}>
        {STAGES.map(stage => {
          const stageOpps = opps.filter(o => o.status === stage.key);
          const { count, total } = stageTotal(stage.key);
          const isOver = over === stage.key;

          return (
            <div
              key={stage.key}
              onDragOver={e => { e.preventDefault(); setOver(stage.key); }}
              onDragLeave={() => setOver(null)}
              onDrop={async e => {
                e.preventDefault();
                setOver(null);
                if (dragging) await moveOpp(dragging, stage.key);
              }}
              style={{
                borderRadius: 12,
                border: `1px solid ${isOver ? stage.color + '60' : stage.color + '20'}`,
                background: isOver ? stage.bg.replace('.08', '.14') : stage.bg,
                transition: 'all .15s',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Column header */}
              <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${stage.color}15` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 800, fontSize: '.76rem', color: stage.color }}>{stage.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.68rem', fontWeight: 700, color: '#475569' }}>{count}</span>
                </div>
                {total > 0 && (
                  <div style={{ fontSize: '.65rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Euro size={9} /> {formatValue(total)}
                  </div>
                )}
              </div>

              {/* Cards */}
              <div style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stageOpps.map(opp => (
                  <div
                    key={opp.id}
                    draggable
                    onDragStart={() => setDragging(opp)}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(15,23,42,.7)',
                      border: `1px solid ${dragging?.id === opp.id ? stage.color + '50' : 'rgba(148,163,184,.1)'}`,
                      cursor: 'grab',
                      opacity: dragging?.id === opp.id ? .5 : 1,
                      transition: 'opacity .15s',
                    }}
                  >
                    {moving === opp.id && (
                      <Loader2 size={11} style={{ animation: 'spin .7s linear infinite', marginBottom: 3, color: stage.color }} />
                    )}
                    <p style={{ margin: 0, fontSize: '.74rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>
                      {opp.title.replace('AO — ', '').slice(0, 50)}{opp.title.length > 53 ? '…' : ''}
                    </p>
                    {opp.organization?.name && (
                      <p style={{ margin: '3px 0 0', fontSize: '.65rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Building2 size={9} /> {opp.organization.name.slice(0, 25)}
                      </p>
                    )}
                    {opp.potential_value && (
                      <p style={{ margin: '3px 0 0', fontSize: '.65rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Euro size={9} /> {formatValue(opp.potential_value)}
                      </p>
                    )}
                    {opp.source === 'boamp_auto' && (
                      <span style={{ display: 'inline-block', marginTop: 4, fontSize: '.58rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.15)', color: '#facc15', fontWeight: 700 }}>
                        AUTO
                      </span>
                    )}
                  </div>
                ))}

                {/* Drop zone indicator */}
                {isOver && dragging && dragging.status !== stage.key && (
                  <div style={{ padding: '10px', borderRadius: 8, border: `2px dashed ${stage.color}40`, textAlign: 'center', fontSize: '.72rem', color: stage.color + '80' }}>
                    Déposer ici
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
