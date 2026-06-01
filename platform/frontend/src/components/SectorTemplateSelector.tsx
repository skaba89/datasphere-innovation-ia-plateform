import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { Deliverable, SectorTemplate } from '../api/domainTypes';

const SECTOR_ICONS: Record<string, string> = {
  telecom:   '📡',
  finance:   '💰',
  public:    '🏛️',
  energy:    '⚡',
  it_digital:'💻',
};

const TYPE_LABELS: Record<string, string> = {
  memoire_technique:  'Mémoire technique',
  note_cadrage:       'Note de cadrage',
  offre_commerciale:  'Offre commerciale',
  plan_action:        "Plan d'action",
  rapport_conformite: 'Rapport de conformité',
};

interface Props {
  opportunityId?: number;
  tenderId?: number;
  assignmentId?: number;
  onCreated?: (d: Deliverable) => void;
}

export default function SectorTemplateSelector({ opportunityId, tenderId, assignmentId, onCreated }: Props) {
  const [templates, setTemplates] = useState<SectorTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function ensureInstalled() {
    setInstalling(true);
    try {
      await apiRequest('/sector-templates/install', { method: 'POST' }, token);
      const tpls = await apiRequest<SectorTemplate[]>('/sector-templates', {}, token);
      setTemplates(tpls);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement templates');
    } finally {
      setInstalling(false); }
  }

  useEffect(() => {
    if (open && !loaded) ensureInstalled();
  }, [open]);

  async function applyTemplate(tpl: SectorTemplate) {
    setApplying(tpl.id); setError(null);
    try {
      const d = await apiRequest<Deliverable>('/sector-templates/apply', {
        method: 'POST',
        body: JSON.stringify({
          sector_key: tpl.sector_key,
          deliverable_type: tpl.deliverable_type,
          opportunity_id: opportunityId ?? null,
          tender_id: tenderId ?? null,
          assignment_id: assignmentId ?? null,
          language: 'fr',
        }),
      }, token);
      setDone(tpl.id);
      setTimeout(() => setDone(null), 2000);
      onCreated?.(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur application template');
    } finally { setApplying(null); }
  }

  // Group by sector
  const bySector = templates.reduce<Record<string, SectorTemplate[]>>((acc, t) => {
    if (!acc[t.sector_key]) acc[t.sector_key] = [];
    acc[t.sector_key].push(t);
    return acc;
  }, {});

  return (
    <div style={{
      background: 'rgba(15,30,54,0.85)',
      border: '1px solid rgba(148,163,184,0.12)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}
      >
        <BookOpen size={16} color="#3b82f6" />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>
          Bibliothèque de templates sectoriels
        </span>
        {templates.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: 6 }}>
            {templates.length} templates
          </span>
        )}
        {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          {installing && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem', display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Chargement des templates…
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '0.84rem' }}>
              {error}
            </div>
          )}

          {loaded && Object.entries(bySector).map(([sector, tpls]) => (
            <div key={sector}>
              {/* Sector header */}
              <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{SECTOR_ICONS[sector] ?? '📄'}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {tpls[0]?.sector_label}
                </span>
              </div>

              <div style={{ padding: '8px 20px 12px', display: 'grid', gap: 8 }}>
                {tpls.map((tpl) => {
                  const isApplying = applying === tpl.id;
                  const isDone = done === tpl.id;
                  return (
                    <div key={tpl.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(148,163,184,0.08)',
                      borderRadius: 10,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: 'rgba(59,130,246,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Package size={14} color="#93c5fd" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: 3 }}>
                          {TYPE_LABELS[tpl.deliverable_type] ?? tpl.deliverable_type}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
                          {tpl.description}
                        </div>
                      </div>
                      <button
                        onClick={() => applyTemplate(tpl)}
                        disabled={isApplying || isDone}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isDone ? 'rgba(34,197,94,0.15)' : isApplying ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.9)',
                          color: isDone ? '#86efac' : isApplying ? '#93c5fd' : '#fff',
                          fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isDone ? <CheckCircle2 size={12} /> : isApplying ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <BookOpen size={12} />}
                        {isDone ? 'Créé !' : isApplying ? '…' : 'Utiliser'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
