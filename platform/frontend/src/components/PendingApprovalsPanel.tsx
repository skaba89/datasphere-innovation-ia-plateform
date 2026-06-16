import { useI18n } from '../i18n/index';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { apiRequest, tokenStorage } from '../api/client';
import type { AgentAction } from '../api/domainTypes';

// ────────────────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, string> = {
  context_analysis: 'Analyse de contexte',
  deliverable_plan: 'Plan de livrable',
  tender_requirements_review: "Revue des exigences AO",
  human_review: 'Révision humaine',
  compliance_check: 'Vérification de conformité',
  document_generation: 'Génération de document',
  quality_review: 'Revue qualité',
  client_validation: 'Validation client',
};

const PRIORITY_COLORS: Record<string, string> = {
  Haute: '#ef4444',
  Normale: '#3b82f6',
  Basse: '#64748b',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeSince(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const min = Math.floor(delta / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `il y a ${d}j`;
  if (h > 0) return `il y a ${h}h`;
  if (min > 0) return `il y a ${min} min`;
  return 'à l\'instant';
}

// ────────────────────────────────────────────────────────────────────────────

export default function PendingApprovalsPanel() {
  const { t } = useI18n();
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [approving, setApproving] = useState<Record<number, boolean>>({});
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [reviewerName, setReviewerName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AgentAction[]>('/agent-actions/pending-approvals', {}, token);
      setActions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(actionId: number) {
    const reviewer = reviewerName.trim() || 'Reviewer';
    setApproving((p) => ({ ...p, [actionId]: true }));
    try {
      await apiRequest(
        `/agent-actions/${actionId}/approve?actor_name=${encodeURIComponent(reviewer)}`,
        { method: 'POST' },
        token,
      );
      setApproved((p) => ({ ...p, [actionId]: true }));
      setTimeout(() => {
        setActions((prev) => prev.filter((a) => a.id !== actionId));
        setApproved((p) => { const np = { ...p }; delete np[actionId]; return np; });
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur d\'approbation');
    } finally {
      setApproving((p) => ({ ...p, [actionId]: false }));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, []);

  // ── styles ──────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(15,30,54,0.85)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 22px',
        borderBottom: '1px solid rgba(148,163,184,0.12)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <Inbox size={18} color="#f97316" />
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>
          Approbations en attente
        </span>
        {actions.length > 0 && (
          <span style={{
            padding: '3px 10px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 800,
            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)',
            color: '#fb923c',
          }}>
            {actions.length} action{actions.length > 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 99, border: '1px solid rgba(148,163,184,0.2)',
            background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>

      {/* Reviewer name input */}
      <div style={{
        padding: '12px 22px',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
        background: 'rgba(255,255,255,0.01)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <UserCheck size={14} color="#94a3b8" />
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Approbateur :</span>
        <input
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          placeholder="Votre nom"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: '0.84rem',
            outline: 'none', maxWidth: 280,
          }}
        />
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Ce nom sera tracé sur chaque approbation.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 22px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '0.84rem', display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Governance notice */}
      <div style={{
        padding: '10px 22px',
        background: 'rgba(34,197,94,0.06)',
        borderBottom: '1px solid rgba(34,197,94,0.12)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <ShieldCheck size={14} color="#86efac" />
        <span style={{ fontSize: '0.78rem', color: '#86efac' }}>
          <strong>Règle de gouvernance :</strong> Ces actions ont été marquées{' '}
          <code style={{ background: 'rgba(34,197,94,0.12)', padding: '1px 5px', borderRadius: 4 }}>requires_human_approval</code>.
          Le scheduler ne les exécutera jamais sans votre approbation explicite.
        </span>
      </div>

      {/* Empty state */}
      {actions.length === 0 && !loading && (
        <div style={{ padding: '40px 22px', textAlign: 'center' }}>
          <CheckCircle2 size={40} color="#22c55e" style={{ margin: '0 auto 14px' }} />
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucune approbation en attente</div>
          <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
            Toutes les actions sensibles ont été traitées. Le pipeline tourne de manière autonome.
          </div>
        </div>
      )}

      {/* Actions list */}
      {actions.length > 0 && (
        <div style={{ padding: '16px 22px', display: 'grid', gap: 12 }}>
          {actions.map((action) => {
            const isExpanded = expanded[action.id];
            const isApproving = approving[action.id];
            const isApproved = approved[action.id];
            const priorityColor = PRIORITY_COLORS[action.priority] ?? '#64748b';

            return (
              <div key={action.id} style={{
                border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 12,
                overflow: 'hidden',
                background: isApproved ? 'rgba(34,197,94,0.06)' : 'rgba(249,115,22,0.04)',
                transition: 'all 0.3s',
              }}>
                {/* Action header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 16px', cursor: 'pointer',
                  }}
                  onClick={() => setExpanded((p) => ({ ...p, [action.id]: !p[action.id] }))}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isApproved ? '#22c55e' : '#f97316',
                    marginTop: 6, flexShrink: 0,
                    boxShadow: `0 0 8px ${isApproved ? '#22c55e' : '#f97316'}`,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700,
                        background: `${priorityColor}15`, border: `1px solid ${priorityColor}30`,
                        color: priorityColor,
                      }}>
                        {action.priority}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b' }}>
                        #{action.id} · assignment #{action.assignment_id}
                      </span>
                    </div>
                    {action.title && (
                      <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: 4 }}>
                        {action.title}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Clock size={11} color="#64748b" />
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        Créée {timeSince(action.created_at)} — {fmtDate(action.created_at)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Approve button */}
                    {!isApproved ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(action.id); }}
                        disabled={isApproving}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isApproving ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.9)',
                          color: isApproving ? '#86efac' : '#0f172a',
                          fontSize: '0.8rem', fontWeight: 700,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isApproving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={12} />}
                        {isApproving ? 'En cours…' : t('common.approve')}
                      </button>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#86efac', fontSize: '0.8rem', fontWeight: 700 }}>
                        <CheckCircle2 size={14} />
                        Approuvé
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    padding: '14px 16px',
                    borderTop: '1px solid rgba(148,163,184,0.08)',
                    background: 'rgba(0,0,0,0.15)',
                    display: 'grid', gap: 10,
                  }}>
                    {action.description && (
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Description</div>
                        <div style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.6 }}>{action.description}</div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Type d\'action', value: action.action_type },
                        { label: 'Statut', value: action.status },
                        { label: 'Priorité', value: action.priority },
                        { label: 'Assignment', value: `#${action.assignment_id}` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: '0.84rem', color: '#f1f5f9', fontFamily: 'monospace' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(250,204,21,0.05)',
                      border: '1px solid rgba(250,204,21,0.15)',
                      fontSize: '0.8rem', color: '#fde68a',
                    }}>
                      <strong>Rappel :</strong> Approuver autorisera le scheduler à exécuter cette action
                      lors de son prochain cycle (dans {' '}
                      <code style={{ background: 'rgba(250,204,21,0.1)', padding: '1px 4px', borderRadius: 3 }}>
                        SCHEDULER_AUTO_EXECUTE_INTERVAL_MINUTES
                      </code> minutes).
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
