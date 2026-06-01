import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  FilePlus2,
  RefreshCw,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';

import { apiRequest } from '../api/client';
import type { Deliverable, Opportunity, Tender } from '../api/domainTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DELIVERABLE_TYPES: Record<string, string> = {
  note_cadrage: 'Note de cadrage',
  memoire_technique: 'Mémoire technique',
  plan_action: "Plan d'action",
  synthese_contexte: 'Synthèse de contexte',
  rapport_conformite: 'Rapport de conformité',
  offre_commerciale: 'Offre commerciale',
  bilan_mission: 'Bilan de mission',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_review: 'En révision',
  approved: 'Approuvé',
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft: { background: 'rgba(234, 179, 8, 0.15)', color: '#fde047', border: '1px solid rgba(234,179,8,0.3)' },
  in_review: { background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' },
  approved: { background: 'rgba(34, 197, 94, 0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  token: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeliverablePanel({ token }: Props) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Draft generation form
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [genType, setGenType] = useState('note_cadrage');
  const [genScopeKind, setGenScopeKind] = useState<'opportunity' | 'tender'>('opportunity');
  const [genScopeId, setGenScopeId] = useState('');
  const [genAudience, setGenAudience] = useState('Direction');

  // Review/approve inline
  const [reviewName, setReviewName] = useState('Sekouna');
  const [approveName, setApproveName] = useState('Cheickna KABA');

  async function refresh() {
    setError(null);
    const [allDeliverables, allOpps, allTenders] = await Promise.all([
      apiRequest<Deliverable[]>('/deliverables', {}, token),
      apiRequest<Opportunity[]>('/opportunities', {}, token),
      apiRequest<Tender[]>('/tenders', {}, token),
    ]);
    setDeliverables(allDeliverables);
    setOpportunities(allOpps);
    setTenders(allTenders);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, [token]);

  async function handleGenerateDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!genScopeId) {
      setError('Sélectionne une opportunité ou un appel d offres.');
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        deliverable_type: genType,
        language: 'fr',
        audience: genAudience,
        generated_by: 'agent',
      };
      if (genScopeKind === 'opportunity') payload.opportunity_id = Number(genScopeId);
      else payload.tender_id = Number(genScopeId);

      const created = await apiRequest<Deliverable>(
        '/deliverables/generate-draft',
        { method: 'POST', body: JSON.stringify(payload) },
        token,
      );
      setMessage(`Brouillon "${created.title}" généré avec succès (v${created.version}).`);
      setShowGenerateForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id: number) {
    if (!reviewName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest<Deliverable>(
        `/deliverables/${id}/review`,
        { method: 'POST', body: JSON.stringify({ reviewer_name: reviewName }) },
        token,
      );
      setMessage(`Livrable ${id} soumis en révision par ${reviewName}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la révision.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: number) {
    if (!approveName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest<Deliverable>(
        `/deliverables/${id}/approve`,
        { method: 'POST', body: JSON.stringify({ approver_name: approveName }) },
        token,
      );
      setMessage(`Livrable ${id} approuvé par ${approveName}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l approbation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    setLoading(true);
    setError(null);
    try {
      await apiRequest<void>(`/deliverables/${id}`, { method: 'DELETE' }, token);
      setMessage(`Livrable #${id} supprimé.`);
      if (expandedId === id) setExpandedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally {
      setLoading(false);
    }
  }

  const scopeOptions = genScopeKind === 'opportunity'
    ? opportunities.map((o) => ({ id: o.id, label: o.title }))
    : tenders.map((t) => ({ id: t.id, label: t.title }));

  const draftCount = deliverables.filter((d) => d.status === 'draft').length;
  const reviewCount = deliverables.filter((d) => d.status === 'in_review').length;
  const approvedCount = deliverables.filter((d) => d.status === 'approved').length;

  return (
    <section className="panel workspace-stack" style={{ marginTop: 24 }}>
      {/* Header */}
      <div>
        <p className="eyebrow">Livrables gouvernés</p>
        <h2>Bibliothèque de livrables</h2>
        <p className="subtitle compact-subtitle">
          Génère des brouillons structurés par type, soumets-les en révision et approuve-les
          avant toute transmission client.
        </p>
      </div>

      {/* KPIs */}
      <div className="stats">
        <article>
          <strong>{draftCount}</strong>
          <span>Brouillons</span>
        </article>
        <article>
          <strong>{reviewCount}</strong>
          <span>En révision</span>
        </article>
        <article>
          <strong>{approvedCount}</strong>
          <span>Approuvés</span>
        </article>
      </div>

      {/* Actions */}
      <div className="automation-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => { setShowGenerateForm((v) => !v); setMessage(null); setError(null); }}
          disabled={loading}
        >
          <WandSparkles size={18} /> Générer un brouillon
        </button>
        <button
          type="button"
          onClick={() => refresh().catch((err: Error) => setError(err.message))}
          disabled={loading}
        >
          <RefreshCw size={18} /> Actualiser
        </button>
      </div>

      {/* Generate form */}
      {showGenerateForm && (
        <div className="panel" style={{ marginTop: 0 }}>
          <p className="eyebrow">Nouveau brouillon</p>
          <h3 style={{ margin: '0 0 16px' }}>Paramètres de génération</h3>
          <form className="form compact-form" onSubmit={handleGenerateDraft}>
            <label>
              Type de livrable
              <select value={genType} onChange={(e) => setGenType(e.target.value)}>
                {Object.entries(DELIVERABLE_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Contexte
              <select value={genScopeKind} onChange={(e) => setGenScopeKind(e.target.value as 'opportunity' | 'tender')}>
                <option value="opportunity">Opportunité CRM</option>
                <option value="tender">Appel d offres</option>
              </select>
            </label>
            <label>
              {genScopeKind === 'opportunity' ? 'Opportunité' : 'Appel d offres'}
              <select value={genScopeId} onChange={(e) => setGenScopeId(e.target.value)} required>
                <option value="">-- Sélectionner --</option>
                {scopeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>
              Audience cible
              <input
                value={genAudience}
                onChange={(e) => setGenAudience(e.target.value)}
                placeholder="ex. Direction, DSI, Comité de pilotage…"
              />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={loading}>
                <Sparkles size={16} /> Générer
              </button>
              <button
                type="button"
                onClick={() => setShowGenerateForm(false)}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {/* Deliverable list */}
      <div className="table">
        {deliverables.length === 0 && (
          <p style={{ color: '#94a3b8' }}>
            Aucun livrable pour le moment. Utilise «&nbsp;Générer un brouillon&nbsp;» pour démarrer.
          </p>
        )}
        {deliverables.map((d) => {
          const isExpanded = expandedId === d.id;
          const statusStyle = STATUS_STYLES[d.status] ?? STATUS_STYLES.draft;
          const typeLabel = DELIVERABLE_TYPES[d.deliverable_type] ?? d.deliverable_type;

          return (
            <article key={d.id} className="row-card" style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
              {/* Row header */}
              <div
                style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
              >
                <FilePlus2 size={20} style={{ color: '#facc15', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>{d.title}</strong>
                  <span style={{ fontSize: '0.82rem' }}>
                    {typeLabel} · v{d.version}
                    {d.audience && ` · ${d.audience}`}
                  </span>
                </div>
                <span style={{ ...statusStyle, padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                  {STATUS_LABELS[d.status] ?? d.status}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px 8px' }}
                  title={isExpanded ? 'Réduire' : 'Voir le détail'}
                >
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(148,163,184,0.18)', padding: '18px' }}>
                  {/* Markdown preview */}
                  <div style={{ marginBottom: 18 }}>
                    <p className="eyebrow" style={{ marginBottom: 8 }}>Contenu</p>
                    <pre style={{
                      background: 'rgba(2,6,23,0.72)',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      fontSize: '0.82rem',
                      color: '#cbd5e1',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 320,
                      overflow: 'auto',
                    }}>
                      {d.content_markdown}
                    </pre>
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 18, fontSize: '0.82rem', color: '#94a3b8' }}>
                    {d.generated_by && <span>Généré par : <strong style={{ color: '#f8fafc' }}>{d.generated_by}</strong></span>}
                    {d.reviewed_by && <span>Révisé par : <strong style={{ color: '#93c5fd' }}>{d.reviewed_by}</strong></span>}
                    {d.approved_by && <span>Approuvé par : <strong style={{ color: '#86efac' }}>{d.approved_by}</strong></span>}
                  </div>

                  {/* Workflow actions */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {d.status === 'draft' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={reviewName}
                          onChange={(e) => setReviewName(e.target.value)}
                          placeholder="Reviewer"
                          style={{ minHeight: 36, width: 180, borderRadius: 12, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(2,6,23,0.72)', color: '#f8fafc', padding: '0 12px', fontSize: '0.85rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleReview(d.id)}
                          disabled={loading}
                          style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 999, padding: '6px 16px', fontWeight: 700 }}
                        >
                          <Eye size={15} /> Soumettre en révision
                        </button>
                      </div>
                    )}
                    {d.status === 'in_review' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={approveName}
                          onChange={(e) => setApproveName(e.target.value)}
                          placeholder="Approbateur"
                          style={{ minHeight: 36, width: 180, borderRadius: 12, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(2,6,23,0.72)', color: '#f8fafc', padding: '0 12px', fontSize: '0.85rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleApprove(d.id)}
                          disabled={loading}
                          style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 999, padding: '6px 16px', fontWeight: 700 }}
                        >
                          <CheckCircle2 size={15} /> Approuver
                        </button>
                      </div>
                    )}
                    {d.status === 'approved' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#86efac', fontSize: '0.88rem' }}>
                        <ClipboardCheck size={18} />
                        <span>Livrable approuvé — prêt pour transmission client.</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      disabled={loading}
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 999, padding: '6px 16px', fontWeight: 700, marginLeft: 'auto' }}
                    >
                      <Trash2 size={15} /> Supprimer
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
