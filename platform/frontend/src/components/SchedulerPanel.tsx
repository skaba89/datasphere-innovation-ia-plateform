import { useI18n } from '../i18n/index';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Pause,
  Play,
  RefreshCw,
  Zap,
} from 'lucide-react';

import { apiRequest, tokenStorage } from '../api/client';
import type { JobInfo, SchedulerLog, SchedulerStatus } from '../api/domainTypes';

// ────────────────────────────────────────────────────────────────────────────

const JOB_LABELS: Record<string, { label: string; desc: string }> = {
  auto_execute: {
    label: 'Exécution automatique',
    desc: 'Exécute les actions auto_ready et approuvées sans intervention humaine.',
  },
  auto_plan: {
    label: 'Auto-planification',
    desc: 'Planifie automatiquement les affectations en statut "planned" sans actions.',
  },
  auto_draft: {
    label: 'Génération de livrables',
    desc: 'Génère un brouillon dès que l\'analyse de contexte est complète.',
  },
  daily_report: {
    label: 'Rapport journalier',
    desc: 'Journalise les statistiques du pipeline chaque matin à 07h00.',
  },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// ────────────────────────────────────────────────────────────────────────────

export default function SchedulerPanel() {
  const { t } = useI18n();
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [logs, setLogs] = useState<SchedulerLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [triggerStates, setTriggerStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const token = tokenStorage.get();

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const s = await apiRequest<SchedulerStatus>('/scheduler/status', {}, token);
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const l = await apiRequest<SchedulerLog[]>('/scheduler/logs?limit=30', {}, token);
      setLogs(l);
    } catch {
      // ignore
    }
  }

  async function triggerJob(jobId: string) {
    setTriggerStates((p) => ({ ...p, [jobId]: true }));
    try {
      await apiRequest(`/scheduler/jobs/${jobId}/trigger`, { method: 'POST' }, token);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Déclenchement échoué');
    } finally {
      setTimeout(() => setTriggerStates((p) => ({ ...p, [jobId]: false })), 1500);
    }
  }

  async function pauseResume() {
    if (!status) return;
    const path = status.running ? '/scheduler/pause' : '/scheduler/resume';
    try {
      await apiRequest(path, { method: 'POST' }, token);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pause/reprise');
    }
  }

  useEffect(() => {
    loadStatus();
    loadLogs();
    const interval = setInterval(() => { loadStatus(); loadLogs(); }, 15_000);
    return () => clearInterval(interval);
  }, []);

  // ── styles ──────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(15,30,54,0.85)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  };
  const hdr: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '18px 22px',
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(255,255,255,0.02)',
  };
  const badge = (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: '0.72rem',
    fontWeight: 700,
    background: `${color}20`,
    border: `1px solid ${color}40`,
    color,
  });

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header card */}
      <div style={card}>
        <div style={hdr}>
          <Activity size={18} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>Scheduler autonome</span>
          {status && (
            <span style={badge(status.running ? '#22c55e' : '#94a3b8')}>
              {status.running ? <Play size={10} /> : <Pause size={10} />}
              {status.running ? 'Actif' : 'En pause'}
            </span>
          )}
          <button
            onClick={pauseResume}
            disabled={!status}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
              background: status?.running ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: status?.running ? '#fca5a5' : '#86efac',
              fontSize: '0.8rem', fontWeight: 600,
            }}
          >
            {status?.running ? <Pause size={13} /> : <Play size={13} />}
            {status?.running ? 'Pause' : 'Reprendre'}
          </button>
          <button
            onClick={loadStatus}
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

        {error && (
          <div style={{ padding: '12px 22px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: '0.84rem', display: 'flex', gap: 8 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Stats row */}
        {status && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1, borderBottom: '1px solid rgba(148,163,184,0.1)',
          }}>
            {[
              { label: t('common.status'), value: status.jobs.length, color: '#facc15' },
              { label: 'Approbations en attente', value: status.pending_approvals_count, color: status.pending_approvals_count > 0 ? '#f97316' : '#22c55e' },
              { label: 'Fuseau horaire', value: status.timezone, color: '#94a3b8' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '16px 22px', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Jobs list */}
        {status && status.jobs.length > 0 && (
          <div style={{ padding: '16px 22px', display: 'grid', gap: 12 }}>
            {status.jobs.map((job) => {
              const meta = JOB_LABELS[job.id] ?? { label: job.name, desc: '' };
              const isFiring = triggerStates[job.id];
              return (
                <div key={job.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(148,163,184,0.1)',
                  borderRadius: 12,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Zap size={15} color="#facc15" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 3 }}>
                      {meta.label}
                      <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748b' }}>
                        {job.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 5 }}>{meta.desc}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Clock size={11} color="#64748b" />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Prochaine : {fmtDate(job.next_run_time)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerJob(job.id)}
                    disabled={isFiring}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: isFiring ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                      color: isFiring ? '#86efac' : '#93c5fd',
                      fontSize: '0.78rem', fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    {isFiring ? <CheckCircle2 size={12} /> : <Zap size={12} />}
                    {isFiring ? 'Lancé' : 'Déclencher'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {status && status.jobs.length === 0 && (
          <div style={{ padding: '24px 22px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
            Scheduler inactif — aucun job enregistré.{' '}
            <code style={{ color: '#fde68a', fontSize: '0.8rem' }}>SCHEDULER_ENABLED=true</code>{' '}
            dans le .env pour activer.
          </div>
        )}
      </div>

      {/* Logs card */}
      <div style={card}>
        <button
          onClick={() => { setLogsOpen((o) => !o); if (!logsOpen) loadLogs(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 22px', background: 'none', border: 'none', cursor: 'pointer',
            color: '#f1f5f9', textAlign: 'left',
          }}
        >
          <Clock size={16} color="#94a3b8" />
          <span style={{ fontWeight: 700, flex: 1 }}>Historique d'exécution</span>
          <span style={{ fontSize: '0.78rem', color: '#64748b', marginRight: 8 }}>{logs.length} enregistrements</span>
          {logsOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </button>

        {logsOpen && (
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', maxHeight: 400, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                Aucun log — les jobs n'ont pas encore tourné.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Job', 'Statut', 'Items', 'Durée', 'Heure'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#fde68a', fontSize: '0.75rem' }}>{log.job_id}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                          background: log.status === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: log.status === 'success' ? '#86efac' : '#fca5a5',
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{log.items_processed}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontFamily: 'monospace' }}>{fmtMs(log.duration_ms)}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(log.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
