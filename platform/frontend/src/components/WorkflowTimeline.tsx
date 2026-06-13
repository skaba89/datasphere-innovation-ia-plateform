/**
 * WorkflowTimeline — Visualisation verticale des 8 étapes du workflow
 *
 * Affichage compact "ligne de temps" avec :
 *   - Icônes colorées par statut (pending/running/done/awaiting/rejected)
 *   - Durée d'exécution estimée
 *   - Résumé de l'étape au survol
 *   - Indicateur "en cours" animé
 *   - Boutons d'action directement sur l'étape (approuver/rejeter)
 */

import { useState } from 'react';
import {
  CheckCircle2, Circle, Clock, Loader2, Play,
  ThumbsDown, ThumbsUp, XCircle, AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface WorkflowStep {
  id:               number;
  step_key:         string;
  step_label:       string;
  order_index:      number;
  status:           string;
  requires_approval: boolean;
  result_summary?:  string;
  approved_by?:     string;
  approved_at?:     string;
  rejection_reason?: string;
  description?:     string;
}

interface WorkflowInstance {
  tender_id:    number;
  status:       string;
  status_label: string;
  progress_pct: number;
  steps_done:   number;
  steps_total:  number;
  steps:        WorkflowStep[];
  awaiting_step?: WorkflowStep;
}

interface Props {
  workflow:     WorkflowInstance;
  token:        string | null;
  onUpdate:     () => void;
  compact?:     boolean;   // Condensed mode for sidebar
}

const STEP_ICONS: Record<string, string> = {
  analyze:          '🔍',
  go_no_go:         '⚖️',
  requirements:     '📋',
  compliance:       '✅',
  staffing:         '👥',
  proposal_outline: '📐',
  generate_draft:   '✍️',
  final_review:     '🏆',
};

function StepIcon({ status, step_key }: { status: string; step_key: string }) {
  const emoji = STEP_ICONS[step_key] || '⚙️';

  if (status === 'running') return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,.15)', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Loader2 size={14} color="#3b82f6" style={{ animation: 'spin .8s linear infinite' }} />
    </div>
  );

  if (status === 'done' || status === 'approved') return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,.12)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <CheckCircle2 size={15} color="#22c55e" />
    </div>
  );

  if (status === 'awaiting') return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(250,204,21,.1)', border: '2px solid #facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse 2s infinite' }}>
      <Clock size={14} color="#facc15" />
    </div>
  );

  if (status === 'rejected') return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,.1)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <XCircle size={15} color="#ef4444" />
    </div>
  );

  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(148,163,184,.06)', border: '1.5px solid rgba(148,163,184,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
      {emoji}
    </div>
  );
}

function statusColor(status: string): string {
  return { done: '#22c55e', approved: '#22c55e', awaiting: '#facc15', running: '#3b82f6', rejected: '#ef4444' }[status] || '#475569';
}

function statusLabel(status: string): string {
  return {
    pending: 'En attente', running: 'En cours…', done: 'Terminé',
    approved: 'Approuvé', awaiting: 'Validation requise', rejected: 'Rejeté',
    skipped: 'Ignoré',
  }[status] || status;
}

export default function WorkflowTimeline({ workflow, token, onUpdate, compact = false }: Props) {
  const [expanding,    setExpanding]    = useState<string | null>(null);
  const [approving,    setApproving]    = useState<number | null>(null);
  const [rejecting,    setRejecting]    = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject,   setShowReject]   = useState<number | null>(null);

  async function approve(stepId: number) {
    setApproving(stepId);
    try {
      await apiRequest(`/tenders/${workflow.tender_id}/workflow/steps/${stepId}/approve`,
        { method: 'POST' }, token);
      onUpdate();
    } catch {
      alert('Erreur lors de l\'approbation');
    } finally {
      setApproving(null);
    }
  }

  async function reject(stepId: number) {
    setRejecting(stepId);
    try {
      await apiRequest(`/tenders/${workflow.tender_id}/workflow/steps/${stepId}/reject`,
        { method: 'POST', body: JSON.stringify({ reason: rejectReason || 'Non conforme' }) }, token);
      onUpdate();
      setShowReject(null);
      setRejectReason('');
    } catch {
      alert('Erreur lors du rejet');
    } finally {
      setRejecting(null);
    }
  }

  const steps = [...(workflow.steps || [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <div style={{ padding: compact ? '8px 0' : '4px 0' }}>
      {/* Progress bar */}
      {!compact && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '.75rem', color: '#64748b' }}>
            <span>Progression</span>
            <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{workflow.steps_done}/{workflow.steps_total} étapes — {workflow.progress_pct}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(148,163,184,.1)', borderRadius: 99 }}>
            <div style={{
              height: '100%', borderRadius: 99, transition: 'width .5s ease',
              width: `${workflow.progress_pct}%`,
              background: workflow.status === 'completed'
                ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                : 'linear-gradient(90deg,#3b82f6,#6366f1)',
            }} />
          </div>
        </div>
      )}

      {/* Steps timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        {!compact && (
          <div style={{
            position: 'absolute', left: 15, top: 16, bottom: 16,
            width: 2, background: 'rgba(148,163,184,.1)', zIndex: 0,
          }} />
        )}

        {steps.map((step, idx) => {
          const isExpanded  = expanding === step.step_key;
          const isActive    = step.status === 'running' || step.status === 'awaiting';
          const isLast      = idx === steps.length - 1;

          return (
            <div key={step.id} style={{ position: 'relative', zIndex: 1, marginBottom: compact ? 6 : 12 }}>
              <div
                onClick={() => setExpanding(isExpanded ? null : step.step_key)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: compact ? 8 : 12,
                  padding: compact ? '6px 8px' : '10px 12px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(250,204,21,.03)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(250,204,21,.12)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <StepIcon status={step.status} step_key={step.step_key} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontWeight: isActive ? 800 : step.status === 'done' || step.status === 'approved' ? 600 : 400,
                      fontSize: compact ? '.78rem' : '.85rem',
                      color: isActive ? '#f1f5f9' : step.status === 'done' || step.status === 'approved' ? '#94a3b8' : '#64748b',
                    }}>
                      {compact ? (STEP_ICONS[step.step_key] || '') + ' ' : ''}{step.step_label}
                    </span>
                    {step.requires_approval && step.status === 'awaiting' && (
                      <span style={{ fontSize: '.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'rgba(250,204,21,.15)', color: '#facc15' }}>
                        VALIDATION
                      </span>
                    )}
                  </div>
                  {!compact && (
                    <span style={{ fontSize: '.7rem', color: statusColor(step.status), fontWeight: 600 }}>
                      {statusLabel(step.status)}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && !compact && (
                <div style={{ marginLeft: 44, marginTop: 4, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)' }}>
                  {step.result_summary && (
                    <p style={{ fontSize: '.78rem', color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.6 }}>
                      {step.result_summary.slice(0, 400)}{step.result_summary.length > 400 ? '…' : ''}
                    </p>
                  )}
                  {step.approved_by && (
                    <p style={{ fontSize: '.7rem', color: '#64748b', margin: 0 }}>
                      Approuvé par <strong>{step.approved_by}</strong>
                      {step.approved_at && ` le ${new Date(step.approved_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  )}
                  {step.rejection_reason && (
                    <p style={{ fontSize: '.72rem', color: '#fca5a5', margin: 0 }}>
                      Rejeté : {step.rejection_reason}
                    </p>
                  )}

                  {/* Approval buttons on awaiting steps */}
                  {step.status === 'awaiting' && step.requires_approval && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); approve(step.id); }}
                        disabled={approving === step.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.08)', color: '#86efac', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
                        {approving === step.id ? <Loader2 size={12} style={{ animation: 'spin .7s linear infinite' }} /> : <ThumbsUp size={12} />}
                        Valider ✓
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowReject(showReject === step.id ? null : step.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.06)', color: '#fca5a5', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
                        <ThumbsDown size={12} /> Rejeter ✗
                      </button>
                      {showReject === step.id && (
                        <div style={{ width: '100%', display: 'flex', gap: 6 }}>
                          <input
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Raison du rejet…"
                            style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(148,163,184,.15)', background: 'rgba(255,255,255,.04)', color: '#e2e8f0', fontSize: '.75rem' }}
                            onClick={e => e.stopPropagation()}
                          />
                          <button onClick={(e) => { e.stopPropagation(); reject(step.id); }} disabled={rejecting === step.id}
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '.72rem' }}>
                            Confirmer
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
