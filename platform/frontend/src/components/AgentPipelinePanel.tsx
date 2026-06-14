/**
 * AgentPipelinePanel — Pipeline agent bout en bout
 *
 * 3 modes :
 *   🖐️ Manuel      — L'utilisateur déclenche chaque étape
 *   👁️ Supervisé   — Auto + pause aux points critiques (GoNoGo, revue finale)
 *   🤖 Autonome    — Tout automatique, aucune validation requise
 *
 * Étapes du pipeline :
 *   🔍 Analyse contexte → 📋 Revue exigences → ⚖️ GoNoGo ← HUMAIN
 *   → 📐 Plan livrables → ✍️ Proposition → ✅ Conformité
 *   → 👁️ Revue finale ← HUMAIN → 👥 Staffing
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle, ChevronRight,
  Loader2, Play, RefreshCw, ThumbsDown, ThumbsUp,
  User, XCircle, Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';

type ActionStatus = 'suggested' | 'auto_ready' | 'awaiting' | 'executing' | 'done' | 'failed' | 'skipped';
type RunMode = 'manual' | 'supervised' | 'autonomous';

interface PipelineAction {
  id:                      number;
  action_type:             string;
  title:                   string;
  status:                  ActionStatus;
  requires_human_approval: boolean;
  result_summary:          string | null;
  next_step:               string | null;
  approved_by:             string | null;
  executed_at:             string | null;
}

interface PipelineStatus {
  assignment_id:   number;
  objective:       string;
  progress_pct:    number;
  total_steps:     number;
  done:            number;
  awaiting:        number;
  executing:       number;
  auto_ready:      number;
  remaining:       number;
  failed:          number;
  is_complete:     boolean;
  needs_approval:  boolean;
  actions:         PipelineAction[];
}

const STATUS_CONFIG: Record<ActionStatus, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  suggested:   { color: '#475569', bg: 'rgba(71,85,105,.08)',   label: 'En attente',       icon: <ChevronRight size={13} /> },
  auto_ready:  { color: '#3b82f6', bg: 'rgba(59,130,246,.08)', label: 'Prêt à exécuter',  icon: <Play size={13} /> },
  awaiting:    { color: '#facc15', bg: 'rgba(250,204,21,.08)', label: '⏳ Validation requise', icon: <User size={13} /> },
  executing:   { color: '#8b5cf6', bg: 'rgba(139,92,246,.08)', label: 'En cours…',         icon: <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> },
  done:        { color: '#22c55e', bg: 'rgba(34,197,94,.06)',  label: 'Terminé ✓',        icon: <CheckCircle size={13} /> },
  failed:      { color: '#ef4444', bg: 'rgba(239,68,68,.08)',  label: 'Échoué',            icon: <XCircle size={13} /> },
  skipped:     { color: '#334155', bg: 'rgba(51,65,85,.06)',   label: 'Ignoré',            icon: <XCircle size={12} /> },
};

const MODE_CONFIG: Record<RunMode, { label: string; desc: string; icon: string; color: string }> = {
  manual:      { label: 'Manuel',    desc: 'Vous déclenchez chaque étape',                    icon: '🖐️', color: '#3b82f6' },
  supervised:  { label: 'Supervisé', desc: 'Auto + pause aux points critiques (GoNoGo, revue)', icon: '👁️', color: '#facc15' },
  autonomous:  { label: 'Autonome',  desc: 'L\'agent s\'exécute seul, sans interruption',       icon: '🤖', color: '#22c55e' },
};

interface Props {
  tenderId:   number;
  tenderTitle?: string;
  token:      string | null;
  onComplete?: () => void;
}

export default function AgentPipelinePanel({ tenderId, tenderTitle, token, onComplete }: Props) {
  const [mode,        setMode]        = useState<RunMode>('supervised');
  const [assignId,    setAssignId]    = useState<number | null>(null);
  const [pipeline,    setPipeline]    = useState<PipelineStatus | null>(null);
  const [starting,    setStarting]    = useState(false);
  const [running,     setRunning]     = useState(false);
  const [approving,   setApproving]   = useState<number | null>(null);
  const [rejecting,   setRejecting]   = useState<number | null>(null);
  const [comment,     setComment]     = useState('');
  const [showComment, setShowComment] = useState<number | null>(null);
  const [expandedId,  setExpandedId]  = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPipeline = useCallback(async (id: number) => {
    try {
      const data = await apiRequest<PipelineStatus>(`/agents/pipeline/${id}/status`, {}, token);
      setPipeline(data);
      if (data?.is_complete) {
        stopPolling();
        onComplete?.();
      }
    } catch { /* silent */ }
  }, [token]);

  function startPolling(id: number) {
    stopPolling();
    pollRef.current = setInterval(() => loadPipeline(id), 3000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => () => stopPolling(), []);

  async function startPipeline() {
    setStarting(true);
    try {
      const res = await apiRequest<{ success: boolean; assignment_id: number; agent: { name: string } }>(
        `/agents/pipeline/start/${tenderId}?mode=${mode}`, { method: 'POST' }, token
      );
      if (res?.success && res.assignment_id) {
        setAssignId(res.assignment_id);
        await loadPipeline(res.assignment_id);
        if (mode !== 'manual') startPolling(res.assignment_id);
      }
    } finally { setStarting(false); }
  }

  async function runNext() {
    if (!assignId) return;
    setRunning(true);
    try {
      await apiRequest(`/agents/pipeline/${assignId}/run-next`, { method: 'POST' }, token);
      await loadPipeline(assignId);
    } finally { setRunning(false); }
  }

  async function approve(actionId: number) {
    setApproving(actionId);
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      await apiRequest(`/agents/pipeline/action/${actionId}/approve?auto_continue=${mode !== 'manual'}`, { method: 'POST', body }, token);
      setShowComment(null); setComment('');
      if (assignId) {
        await loadPipeline(assignId);
        if (mode !== 'manual') startPolling(assignId);
      }
    } finally { setApproving(null); }
  }

  async function reject(actionId: number) {
    const reason = comment || 'Rejeté par l\'utilisateur';
    setRejecting(actionId);
    try {
      await apiRequest(`/agents/pipeline/action/${actionId}/reject?reason=${encodeURIComponent(reason)}`, { method: 'POST' }, token);
      setShowComment(null); setComment('');
      if (assignId) await loadPipeline(assignId);
    } finally { setRejecting(null); }
  }

  const awaitingActions = pipeline?.actions.filter(a => a.status === 'awaiting') ?? [];
  const readyActions    = pipeline?.actions.filter(a => a.status === 'auto_ready') ?? [];

  // ── Not started ──────────────────────────────────────────────────────────
  if (!assignId) return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(250,204,21,.04)', border: '1px solid rgba(250,204,21,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Bot size={16} color="#facc15" />
          <span style={{ fontWeight: 800, fontSize: '.88rem', color: '#facc15' }}>
            Pipeline IA — {tenderTitle?.slice(0, 50) || `AO #${tenderId}`}
          </span>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '.78rem', color: '#64748b' }}>
          8 étapes automatisées : analyse → GoNoGo → proposition → conformité → revue finale
        </p>

        {/* Mode selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {(Object.entries(MODE_CONFIG) as [RunMode, typeof MODE_CONFIG.manual][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setMode(key)}
              style={{ padding: '10px 8px', borderRadius: 9, cursor: 'pointer', textAlign: 'center',
                border: `1.5px solid ${mode === key ? cfg.color + '50' : 'rgba(148,163,184,.12)'}`,
                background: mode === key ? cfg.color + '08' : 'transparent',
              }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{cfg.icon}</div>
              <div style={{ fontSize: '.76rem', fontWeight: 800, color: mode === key ? cfg.color : '#64748b' }}>{cfg.label}</div>
              <div style={{ fontSize: '.65rem', color: '#475569', lineHeight: 1.3, marginTop: 2 }}>{cfg.desc}</div>
            </button>
          ))}
        </div>

        <button onClick={startPipeline} disabled={starting} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.1)', color: '#facc15', cursor: 'pointer', fontWeight: 800, fontSize: '.9rem' }}>
          {starting ? <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> : <Zap size={16} />}
          {starting ? 'Démarrage du pipeline…' : `Démarrer en mode ${MODE_CONFIG[mode].icon} ${MODE_CONFIG[mode].label}`}
        </button>
      </div>

      {/* Pipeline preview */}
      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.07)' }}>
        <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#475569', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Les 8 étapes du pipeline
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { emoji: '🔍', label: 'Analyse du contexte',         human: false },
            { emoji: '📋', label: 'Revue des exigences AO',      human: false },
            { emoji: '⚖️', label: 'Recommandation Go/No-Go',     human: true  },
            { emoji: '📐', label: 'Plan des livrables',          human: false },
            { emoji: '✍️', label: 'Proposition commerciale',     human: false },
            { emoji: '✅', label: 'Matrice de conformité',       human: false },
            { emoji: '👁️', label: 'Revue finale humaine',        human: true  },
            { emoji: '👥', label: 'Plan de staffing',            human: false },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.76rem' }}>
              <span style={{ width: 20, textAlign: 'center' }}>{step.emoji}</span>
              <span style={{ color: '#94a3b8', flex: 1 }}>{step.label}</span>
              {step.human && <span style={{ fontSize: '.62rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.15)', color: '#facc15', fontWeight: 700 }}>👤 Validation</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Pipeline running ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Progress header */}
      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(15,23,42,.7)', border: '1px solid rgba(148,163,184,.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={14} color="#facc15" />
            <span style={{ fontWeight: 800, fontSize: '.82rem', color: '#f1f5f9' }}>
              {MODE_CONFIG[mode].icon} Mode {MODE_CONFIG[mode].label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {mode === 'manual' && readyActions.length > 0 && (
              <button onClick={runNext} disabled={running} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)', color: '#93c5fd', cursor: 'pointer', fontWeight: 700, fontSize: '.75rem' }}>
                {running ? <Loader2 size={11} style={{ animation: 'spin .7s linear infinite' }} /> : <Play size={11} />}
                Exécuter l'étape suivante
              </button>
            )}
            <button onClick={() => assignId && loadPipeline(assignId)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(148,163,184,.1)', borderRadius: 99 }}>
            <div style={{ height: '100%', borderRadius: 99, background: pipeline?.is_complete ? '#22c55e' : '#facc15', width: `${pipeline?.progress_pct ?? 0}%`, transition: 'width .5s ease' }} />
          </div>
          <span style={{ fontSize: '.72rem', fontWeight: 800, color: pipeline?.is_complete ? '#22c55e' : '#facc15', flexShrink: 0 }}>
            {pipeline?.done}/{pipeline?.total_steps}
          </span>
        </div>

        {pipeline?.is_complete && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 7, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', fontSize: '.76rem', color: '#22c55e', fontWeight: 700, textAlign: 'center' }}>
            ✅ Pipeline terminé avec succès
          </div>
        )}
      </div>

      {/* Pending approvals — highlighted */}
      {awaitingActions.map(action => (
        <div key={action.id} style={{ padding: '14px 16px', borderRadius: 12, border: '2px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.04)', animation: 'pulse 2s infinite' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(250,204,21,.12)', border: '1px solid rgba(250,204,21,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '.88rem', color: '#facc15', marginBottom: 4 }}>
                Validation requise : {action.title}
              </div>
              {action.result_summary && (
                <div style={{ fontSize: '.76rem', color: '#94a3b8', marginBottom: 10, lineHeight: 1.6, background: 'rgba(15,23,42,.5)', padding: '8px 10px', borderRadius: 7 }}>
                  <strong style={{ color: '#64748b', fontSize: '.65rem', display: 'block', marginBottom: 4 }}>RÉSULTAT DE L'AGENT :</strong>
                  {action.result_summary.slice(0, 400)}{action.result_summary.length > 400 ? '…' : ''}
                </div>
              )}

              {showComment === action.id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire optionnel pour l'agent…" rows={2}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.18)', background: 'rgba(15,23,42,.6)', color: '#e2e8f0', fontSize: '.78rem', resize: 'none', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => approve(action.id)} disabled={approving === action.id}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.08)', color: '#22c55e', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem' }}>
                      {approving === action.id ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <ThumbsUp size={14} />}
                      Valider et continuer
                    </button>
                    <button onClick={() => reject(action.id)} disabled={rejecting === action.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.06)', color: '#fca5a5', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem' }}>
                      {rejecting === action.id ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <ThumbsDown size={13} />}
                      Rejeter
                    </button>
                    <button onClick={() => setShowComment(null)} style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.1)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.82rem' }}>✕</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setShowComment(action.id); setComment(''); approve(action.id); }}
                    disabled={approving === action.id}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.08)', color: '#22c55e', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem' }}>
                    {approving === action.id ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <ThumbsUp size={14} />}
                    ✅ Approuver et continuer
                  </button>
                  <button onClick={() => { setShowComment(action.id); setComment('Rejeté — à retravailler'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)', background: 'rgba(239,68,68,.04)', color: '#fca5a5', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem' }}>
                    <ThumbsDown size={13} /> Rejeter
                  </button>
                  <button onClick={() => setShowComment(action.id)}
                    style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.1)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.75rem' }}>
                    💬
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* All pipeline steps */}
      <div style={{ display: 'grid', gap: 5 }}>
        {pipeline?.actions.map((action, i) => {
          const cfg = STATUS_CONFIG[action.status] || STATUS_CONFIG.suggested;
          const isExpanded = expandedId === action.id;

          return (
            <div key={action.id} style={{ borderRadius: 9, border: `1px solid ${action.status === 'done' ? 'rgba(34,197,94,.15)' : action.status === 'awaiting' ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.07)'}`, background: action.status === 'done' ? 'rgba(34,197,94,.02)' : 'rgba(255,255,255,.01)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: action.result_summary ? 'pointer' : 'default' }}
                onClick={() => action.result_summary && setExpandedId(isExpanded ? null : action.id)}>

                {/* Step number */}
                <div style={{ width: 22, height: 22, borderRadius: 6, background: cfg.bg, border: `1px solid ${cfg.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cfg.color }}>
                  {action.status === 'executing' ? <Loader2 size={12} style={{ animation: 'spin .7s linear infinite' }} /> : (i + 1)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.8rem', color: action.status === 'done' ? '#94a3b8' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {action.title}
                    {action.requires_human_approval && <span style={{ fontSize: '.6rem', color: '#facc15', fontWeight: 800 }}>👤</span>}
                  </div>
                </div>

                {/* Status badge */}
                <span style={{ fontSize: '.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>

              {/* Expanded result */}
              {isExpanded && action.result_summary && (
                <div style={{ borderTop: '1px solid rgba(148,163,184,.06)', padding: '10px 12px', fontSize: '.75rem', color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  <div style={{ fontSize: '.62rem', color: '#475569', marginBottom: 5, fontWeight: 800 }}>RÉSULTAT DE L'AGENT :</div>
                  {action.result_summary}
                  {action.next_step && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.12)', color: '#93c5fd', fontSize: '.7rem' }}>
                      <strong>Prochaine étape :</strong> {action.next_step}
                    </div>
                  )}
                  {action.approved_by && (
                    <div style={{ marginTop: 6, fontSize: '.65rem', color: '#475569' }}>
                      ✓ Validé par {action.approved_by.replace('REJECTED by ', '❌ Rejeté par ')}
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
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(250,204,21,.2); } 50% { box-shadow: 0 0 0 6px rgba(250,204,21,.0); } }
      `}</style>
    </div>
  );
}
