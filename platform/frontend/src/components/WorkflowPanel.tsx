/**
 * WorkflowPanel — Workflow automatisé avec validation humaine
 *
 * Affiche les 8 étapes du workflow pour un AO :
 *   - Étapes auto (fond sombre) : l'agent travaille seul
 *   - Étapes avec validation (bordure or) : attente humaine
 *
 * Actions :
 *   - "Lancer le workflow" → déclenche les agents en cascade
 *   - "Valider ✓" → approuve une étape, la suivante se lance automatiquement
 *   - "Rejeter ✗" → pause workflow avec raison
 *   - "Réinitialiser" → remet à zéro
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Clock, Loader, Play, RefreshCw, ThumbsDown, ThumbsUp, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface WorkflowStep {
  id:               number;
  step_key:         string;
  step_label:       string;
  order_index:      number;
  status:           string;
  status_label:     string;
  requires_approval: boolean;
  result_summary?:  string;
  approved_by?:     string;
  approved_at?:     string;
  rejection_reason?: string;
  artifact_type?:   string;
  artifact_id?:     number;
  description?:     string;
}

interface WorkflowInstance {
  tender_id:      number;
  status:         string;
  status_label:   string;
  progress_pct:   number;
  steps_done:     number;
  steps_total:    number;
  started_by?:    string;
  error_message?: string;
  awaiting_step?: WorkflowStep;
  steps:          WorkflowStep[];
}

interface Props {
  tenderId: number;
  tenderTitle?: string;
  token: string | null;
}

const gold = '#facc15';

const STATUS_COLOR: Record<string, string> = {
  pending:  '#475569',
  running:  '#93c5fd',
  awaiting: '#fde68a',
  done:     '#86efac',
  approved: '#86efac',
  rejected: '#fca5a5',
  failed:   '#fca5a5',
};

const STATUS_BG: Record<string, string> = {
  awaiting: 'rgba(250,204,21,.06)',
  done:     'rgba(34,197,94,.05)',
  rejected: 'rgba(239,68,68,.05)',
  failed:   'rgba(239,68,68,.05)',
};

export default function WorkflowPanel({ tenderId, tenderTitle, token }: Props) {
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<WorkflowInstance>(`/workflow/${tenderId}`, {}, token);
      setWorkflow(data);
      // Auto-poll while running
      if (data.status === 'running') {
        setTimeout(load, 2000);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tenderId, token]);

  useEffect(() => { load(); }, [load]);

  // Poll every 3s while running
  useEffect(() => {
    if (workflow?.status !== 'running') return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [workflow?.status, load]);

  async function handleStart(forceReset = false) {
    setStarting(true); setError(null);
    try {
      const data = await apiRequest<WorkflowInstance>(`/workflow/${tenderId}/start`, {
        method: 'POST',
        body: JSON.stringify({ force_reset: forceReset }),
      }, token);
      setWorkflow(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setStarting(false); }
  }

  async function handleUnstuck() {
    setError(null);
    try {
      const r = await apiRequest<{ message: string }>(`/workflow/${tenderId}/reset-stuck`, { method: 'POST' }, token);
      setError(r.message); // show as info
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleApprove(stepId: number) {
    setApproving(stepId); setError(null);
    try {
      await apiRequest(`/workflow/steps/${stepId}/approve`, { method: 'POST' }, token);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setApproving(null); }
  }

  async function handleReject(stepId: number) {
    if (!rejectReason.trim() || rejectReason.length < 5) {
      setError('Veuillez indiquer une raison (min. 5 caractères).');
      return;
    }
    setApproving(stepId); setError(null);
    try {
      await apiRequest(`/workflow/steps/${stepId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      }, token);
      setRejecting(null); setRejectReason('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setApproving(null); }
  }

  const isRunning    = workflow?.status === 'running';
  const isAwaiting   = workflow?.status === 'awaiting_approval';
  const isCompleted  = workflow?.status === 'completed';
  const isPaused     = workflow?.status === 'paused';
  const hasStarted   = workflow && workflow.status !== 'idle';

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32, color: '#475569' }}>
      <Loader size={18} style={{ animation: 'ds-spin .7s linear infinite' }} />
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: 'clamp(14px,3vw,24px)', maxWidth: 740 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <Zap size={18} color={gold} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1rem', margin: 0, letterSpacing: '-.02em' }}>
            Workflow automatisé
          </h3>
          {tenderTitle && <div style={{ fontSize: '.74rem', color: '#475569', marginTop: 2 }}>{tenderTitle}</div>}
        </div>

        {/* Actions header */}
        <div style={{ display: 'flex', gap: 6 }}>
          {isRunning && (
            <button
              onClick={handleUnstuck}
              title="Débloquer les étapes bloquées depuis +2 min"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(251,191,36,.3)', background: 'rgba(251,191,36,.06)', color: '#fde68a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '.74rem' }}
            >
              <AlertTriangle size={12} /> Débloquer
            </button>
          )}
          {hasStarted && (
            <button
              onClick={() => handleStart(true)}
              disabled={starting || isRunning}
              title="Remettre à zéro et relancer"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '.74rem' }}
            >
              <RefreshCw size={12} /> Relancer
            </button>
          )}
          {(!hasStarted || isPaused || isCompleted) && (
            <button
              onClick={() => handleStart(false)}
              disabled={starting}
              style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: gold, color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {starting ? <Loader size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> : <Play size={13} />}
              {starting ? 'Démarrage…' : isCompleted ? 'Relancer' : isPaused ? 'Reprendre' : 'Lancer le workflow'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {hasStarted && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: '#64748b', marginBottom: 6 }}>
            <span style={{ color: isCompleted ? '#86efac' : isAwaiting ? gold : '#93c5fd' }}>
              {workflow?.status_label}
              {isRunning && <Loader size={11} style={{ marginLeft: 6, animation: 'ds-spin .7s linear infinite', verticalAlign: 'middle' }} />}
            </span>
            <span>{workflow?.steps_done}/{workflow?.steps_total} étapes</span>
          </div>
          <div style={{ height: 6, background: 'rgba(148,163,184,.12)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${workflow?.progress_pct ?? 0}%`,
              background: isCompleted ? '#22c55e' : isAwaiting ? gold : '#3b82f6',
              transition: 'width .5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {(error || workflow?.error_message) && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#fca5a5', fontSize: '.8rem', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {error || workflow?.error_message}
        </div>
      )}

      {/* Steps */}
      <div style={{ display: 'grid', gap: 8 }}>
        {workflow?.steps.map((step, idx) => {
          const isAw  = step.status === 'awaiting';
          const isDone = ['done', 'approved'].includes(step.status);
          const isCur = step.status === 'running';
          const isExp = expanded === step.id;
          const isRej = step.status === 'rejected';
          const isFail= step.status === 'failed';

          return (
            <div
              key={step.id ?? idx}
              style={{
                borderRadius: 12,
                border: `1px solid ${isAw ? 'rgba(250,204,21,.3)' : isDone ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.1)'}`,
                background: STATUS_BG[step.status] || 'rgba(12,20,37,.85)',
                overflow: 'hidden',
                transition: 'border-color .2s',
              }}
            >
              {/* Step header */}
              <div
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: step.result_summary ? 'pointer' : 'default' }}
                onClick={() => step.result_summary && setExpanded(isExp ? null : step.id)}
              >
                {/* Status icon */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${STATUS_COLOR[step.status] || '#475569'}18`, border: `1.5px solid ${STATUS_COLOR[step.status] || '#475569'}40` }}>
                  {isCur  ? <Loader size={12} color="#93c5fd" style={{ animation: 'ds-spin .7s linear infinite' }} /> :
                   isDone ? <CheckCircle size={13} color="#86efac" /> :
                   isAw   ? <Clock size={13} color={gold} /> :
                   isRej || isFail ? <AlertTriangle size={13} color="#fca5a5" /> :
                   <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#475569' }}>{idx + 1}</span>}
                </div>

                {/* Label + badge */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.86rem', fontWeight: isDone || isAw ? 700 : 500, color: isAw ? gold : isDone ? '#86efac' : '#94a3b8' }}>
                      {step.step_label}
                    </span>
                    {step.requires_approval && (
                      <span style={{ fontSize: '.66rem', padding: '1px 7px', borderRadius: 99, background: 'rgba(250,204,21,.1)', color: '#fde68a', border: '1px solid rgba(250,204,21,.2)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Validation requise
                      </span>
                    )}
                    {step.approved_by && isDone && (
                      <span style={{ fontSize: '.66rem', color: '#475569' }}>par {step.approved_by}</span>
                    )}
                  </div>
                  {isCur && <div style={{ fontSize: '.72rem', color: '#93c5fd', marginTop: 2 }}>Traitement en cours…</div>}
                </div>

                {/* Status label */}
                <span style={{ fontSize: '.72rem', color: STATUS_COLOR[step.status] || '#475569', flexShrink: 0 }}>
                  {step.status_label}
                </span>

                {step.result_summary && (
                  isExp ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />
                )}
              </div>

              {/* Expanded result */}
              {isExp && step.result_summary && (
                <div style={{ padding: '0 16px 14px 54px' }}>
                  <div style={{ fontSize: '.8rem', color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,.2)', padding: '10px 14px', borderRadius: 8 }}>
                    {step.result_summary}
                  </div>
                </div>
              )}

              {/* Awaiting approval — action buttons */}
              {isAw && (
                <div style={{ padding: '0 16px 14px 54px', display: 'grid', gap: 10 }}>
                  {step.result_summary && !isExp && (
                    <div style={{ fontSize: '.8rem', color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,.2)', padding: '10px 14px', borderRadius: 8 }}>
                      {step.result_summary}
                    </div>
                  )}

                  {rejecting === step.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <textarea
                        value={rejectReason}
                        onChange={e => { setRejectReason(e.target.value); setError(null); }}
                        placeholder="Raison du rejet (min. 5 caractères)…"
                        rows={2}
                        style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(239,68,68,.3)', borderRadius: 9, color: '#f1f5f9', fontSize: '.82rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleReject(step.id)}
                          disabled={approving === step.id}
                          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.15)', color: '#fca5a5', cursor: 'pointer', fontWeight: 700, fontSize: '.8rem' }}
                        >
                          Confirmer le rejet
                        </button>
                        <button
                          onClick={() => { setRejecting(null); setRejectReason(''); }}
                          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem' }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleApprove(step.id)}
                        disabled={approving === step.id}
                        style={{ flex: 1, minWidth: 120, padding: '10px 16px', borderRadius: 9, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                      >
                        {approving === step.id
                          ? <Loader size={13} style={{ animation: 'ds-spin .7s linear infinite' }} />
                          : <ThumbsUp size={14} />}
                        Valider — suite automatique
                      </button>
                      <button
                        onClick={() => setRejecting(step.id)}
                        style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)', color: '#fca5a5', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ThumbsDown size={13} /> Rejeter
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Rejected */}
              {isRej && step.rejection_reason && (
                <div style={{ padding: '0 16px 12px 54px', fontSize: '.78rem', color: '#fca5a5' }}>
                  Raison : {step.rejection_reason}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
