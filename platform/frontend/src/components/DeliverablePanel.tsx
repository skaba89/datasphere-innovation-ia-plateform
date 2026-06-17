import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { API_BASE } from '../api/config';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  Eye,
  FileDown,
  FilePlus2,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';

import { apiRequest, tokenStorage } from '../api/client';
import type { Deliverable, Opportunity, Tender } from '../api/domainTypes';
import DeliverableVersionsPanel from './DeliverableVersionsPanel';
import EmailPreviewModal from './EmailPreviewModal';
import FileAttachments from './FileAttachments';

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
  rejected: 'Rejeté',
  archived: 'Archivé',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  in_review: '#facc15',
  approved: '#22c55e',
  rejected: '#ef4444',
  archived: '#64748b',
};

type Props = {
  token: string;
  role?: string;
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
  // Email preview modal
  const [emailPreviewId, setEmailPreviewId] = useState<number | null>(null);
  const [genScopeId, setGenScopeId] = useState('');
  const [genAudience, setGenAudience] = useState('Direction');

  // Review/approve inline
  const [reviewName, setReviewName] = useState('');
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

      const created = await apiRequest<Deliverable>('/deliverables/generate-draft', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);
      setDeliverables((items) => [created, ...items]);
      setMessage(`Brouillon "${created.title}" généré avec succès.`);
      setShowGenerateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur génération brouillon');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, action: 'review' | 'approve', name: string) {
    setLoading(true);
    setError(null);
    try {
      const endpoint = action === 'review' ? `/deliverables/${id}/review` : `/deliverables/${id}/approve`;
      const payload = action === 'review' ? { reviewed_by: name } : { approved_by: name };
      const updated = await apiRequest<Deliverable>(endpoint, { method: 'POST', body: JSON.stringify(payload) }, token);
      setDeliverables((items) => items.map((d) => (d.id === id ? updated : d)));
      setMessage(action === 'review' ? 'Livrable soumis en révision.' : 'Livrable approuvé.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur workflow');
    } finally {
      setLoading(false);
    }
  }

  const [confirmDelId, setConfirmDelId] = useState<number | null>(null);

  async function deleteDeliverable(id: number) {
    setConfirmDelId(id);
  }

  async function doDeleteDeliverable(id: number) {    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/deliverables/${id}`, { method: 'DELETE' }, token);
      setDeliverables((items) => items.filter((d) => d.id !== id));
      setMessage('Livrable supprimé.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression');
    } finally {
      setLoading(false);
    }
  }

  function downloadHref(id: number, fmt: 'markdown' | 'html' | 'pdf') {
    return `${API_BASE}/deliverables/${id}/export/${fmt}?token=${encodeURIComponent(tokenStorage.get() ?? '')}`;
  }

  return (
    <div className="panel">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">{lang === 'en' ? 'Deliverables' : 'Livrables'}</p>
          <h2>{lang === 'en' ? 'Deliverables library' : 'Bibliothèque de livrables'}</h2>
          <p className="compact-subtitle">Génération, review, approbation et export documentaire.</p>
        </div>
        <button className="team-primary-button" onClick={() => setShowGenerateForm((v) => !v)} disabled={loading} type="button">
          <WandSparkles size={14} /> Générer un brouillon
        </button>
      </div>

      {message && <div className="team-alert success"><CheckCircle2 size={16} /> {message}</div>}
      {error && <div className="team-alert error">{error}</div>}

      {showGenerateForm && (
        <form className="compact-form" onSubmit={handleGenerateDraft}>
          <label>Type
            <select value={genType} onChange={(e) => setGenType(e.target.value)}>
              {Object.entries(DELIVERABLE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Périmètre
            <select value={genScopeKind} onChange={(e) => setGenScopeKind(e.target.value as 'opportunity' | 'tender')}>
              <option value="opportunity">{lang === 'en' ? 'Opportunity' : 'Opportunité'}</option>
              <option value="tender">{lang === 'en' ? 'Tender' : 'Appel d'offres'}</option>
            </select>
          </label>
          <label>{genScopeKind === 'opportunity' ? 'Opportunité' : 'Appel d offres'}
            <select value={genScopeId} onChange={(e) => setGenScopeId(e.target.value)}>
              <option value="">{lang === 'en' ? 'Select…' : 'Sélectionner…'}</option>
              {(genScopeKind === 'opportunity' ? opportunities : tenders).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label>Audience
            <input value={genAudience} onChange={(e) => setGenAudience(e.target.value)} />
          </label>
          <button type="submit" disabled={loading}>{lang === 'en' ? 'Generate' : 'Générer'}</button>
        </form>
      )}

      <div className="workspace-stack">
        {deliverables.map((deliverable) => (
          <article key={deliverable.id} className="row-card">
            <div className="tender-selected-header">
              <div>
                <strong>{deliverable.title}</strong>
                <p className="tender-meta">
                  {DELIVERABLE_TYPES[deliverable.deliverable_type] ?? deliverable.deliverable_type} · v{deliverable.version} · {deliverable.audience ?? 'Audience non précisée'}
                </p>
              </div>
              <span style={{ color: STATUS_COLORS[deliverable.status] ?? '#94a3b8', fontWeight: 800 }}>
                {STATUS_LABELS[deliverable.status] ?? deliverable.status}
              </span>
            </div>
            <div className="automation-actions">
              <button className="icon-button" onClick={() => setExpandedId((current) => current === deliverable.id ? null : deliverable.id)} title="Voir le détail" type="button">
                <Eye size={13} /> {expandedId === deliverable.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <a className="tender-report-link" href={downloadHref(deliverable.id, 'markdown')} download><Download size={13} /> .md</a>
              <a className="tender-report-link" href={downloadHref(deliverable.id, 'html')} download><FileDown size={13} /> HTML</a>
              <a className="tender-report-link" href={downloadHref(deliverable.id, 'pdf')} download><FileDown size={13} /> PDF</a>
              <button className="icon-button" onClick={() => setEmailPreviewId(deliverable.id)} type="button"><Mail size={13} /> Email</button>
              <button className="icon-button" onClick={() => updateStatus(deliverable.id, 'review', reviewName || 'Reviewer')} disabled={loading || deliverable.status !== 'draft'} type="button"><ClipboardCheck size={13} /> Soumettre en révision</button>
              <button className="icon-button" onClick={() => updateStatus(deliverable.id, 'approve', approveName || 'Approver')} disabled={loading || deliverable.status === 'approved'} type="button"><Sparkles size={13} /> Approuver</button>
              <button className="icon-button" onClick={() => deleteDeliverable(deliverable.id)} disabled={loading} type="button"><Trash2 size={13} /> Supprimer</button>
            </div>

            {expandedId === deliverable.id && (
              <div className="workspace-stack">
                <div className="compact-form">
                  <label>Reviewer
                    <input value={reviewName} onChange={(e) => setReviewName(e.target.value)} placeholder={lang === "en" ? "Reviewer name" : "Nom reviewer"} />
                  </label>
                  <label>Approver
                    <input value={approveName} onChange={(e) => setApproveName(e.target.value)} placeholder={lang === "en" ? "Approver name" : "Nom approbateur"} />
                  </label>
                </div>
                <pre>{deliverable.content_markdown}</pre>
                <DeliverableVersionsPanel deliverableId={deliverable.id} currentVersion={deliverable.version} onRestored={refresh} />
                <FileAttachments resourceType="deliverable" resourceId={deliverable.id} />
              </div>
            )}
          </article>
        ))}
        {deliverables.length === 0 && !error && <p className="dashboard-empty-state"><FilePlus2 size={18} /> Aucun livrable pour le moment.</p>}
      </div>
      {emailPreviewId && (
        <EmailPreviewModal
          deliverableId={emailPreviewId}
          deliverableTitle={deliverables.find((item) => item.id === emailPreviewId)?.title ?? 'Livrable'}
          onClose={() => setEmailPreviewId(null)}
        />
      )}
      {loading && <p className="dashboard-empty-state"><RefreshCw size={16} /> Traitement en cours…</p>}
    </div>
  );
}

export default DeliverablePanel;
