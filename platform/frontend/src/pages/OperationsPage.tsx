import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Clock,
  Inbox,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import { apiRequest, tokenStorage } from '../api/client';
import type { SchedulerStatus } from '../api/domainTypes';
import PendingApprovalsPanel from '../components/PendingApprovalsPanel';
import SchedulerPanel from '../components/SchedulerPanel';

// ────────────────────────────────────────────────────────────────────────────

type Tab = 'scheduler' | 'approvals';

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  const [quickStatus, setQuickStatus] = useState<SchedulerStatus | null>(null);
  const token = tokenStorage.get();

  // Fetch quick stats for the header badges
  useEffect(() => {
    apiRequest<SchedulerStatus>('/scheduler/status', {}, token)
      .then(setQuickStatus)
      .catch(() => null);
    const interval = setInterval(() => {
      apiRequest<SchedulerStatus>('/scheduler/status', {}, token)
        .then(setQuickStatus)
        .catch(() => null);
    }, 20_000);
    return () => clearInterval(interval);
  }, []);

  // ── styles ──────────────────────────────────────────────────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: active ? 700 : 500, fontSize: '0.88rem',
    background: active ? 'rgba(250,204,21,0.12)' : 'none',
    color: active ? '#facc15' : '#94a3b8',
    borderBottom: active ? '2px solid #facc15' : '2px solid transparent',
    transition: 'all 0.18s',
  });

  const statCard = (color: string): React.CSSProperties => ({
    background: 'rgba(15,30,54,0.85)',
    border: `1px solid ${color}25`,
    borderRadius: 14,
    padding: '18px 22px',
    flex: 1,
  });

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: '32px 40px',
      maxWidth: 960,
      minHeight: '100vh',
      background: 'transparent',
      display: 'grid',
      gap: 28,
      alignContent: 'start',
    }}>
      {/* Page header */}
      <div>
        <div style={{
          fontFamily: 'var(--font-head, Syne, sans-serif)',
          fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: '#facc15', marginBottom: 10,
        }}>
          Opérations
        </div>
        <h1 style={{
          fontFamily: 'var(--font-head, Syne, sans-serif)',
          fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10,
        }}>
          Pipeline autonome
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: 560, lineHeight: 1.7 }}>
          Les agents opèrent en autonomie selon les règles de gouvernance définies.
          Approuvez les actions sensibles et surveillez le scheduler en temps réel.
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={statCard('#facc15')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(250,204,21,0.1)',
              border: '1px solid rgba(250,204,21,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={16} color="#facc15" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Scheduler
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: quickStatus?.running ? '#22c55e' : '#94a3b8' }}>
                {quickStatus == null ? '—' : quickStatus.running ? 'Actif' : 'En pause'}
              </div>
            </div>
          </div>
        </div>

        <div style={statCard('#3b82f6')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} color="#93c5fd" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Jobs actifs
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', fontFamily: 'monospace', color: '#93c5fd' }}>
                {quickStatus?.jobs.length ?? '—'}
              </div>
            </div>
          </div>
        </div>

        <div style={statCard(quickStatus?.pending_approvals_count ?? 0 > 0 ? '#f97316' : '#22c55e')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: (quickStatus?.pending_approvals_count ?? 0) > 0 ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${(quickStatus?.pending_approvals_count ?? 0) > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={16} color={(quickStatus?.pending_approvals_count ?? 0) > 0 ? '#fb923c' : '#86efac'} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                En attente de validation
              </div>
              <div style={{
                fontWeight: 800, fontSize: '1.4rem', fontFamily: 'monospace',
                color: (quickStatus?.pending_approvals_count ?? 0) > 0 ? '#fb923c' : '#86efac',
              }}>
                {quickStatus?.pending_approvals_count ?? '—'}
              </div>
            </div>
          </div>
        </div>

        <div style={statCard('#8b5cf6')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={16} color="#a78bfa" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Moteur LLM
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#a78bfa' }}>
                simulation
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Governance notice */}
      <div style={{
        padding: '14px 20px',
        background: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 12,
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <ShieldCheck size={16} color="#86efac" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.84rem', color: '#86efac', lineHeight: 1.6 }}>
          <strong>Règle fondamentale de gouvernance :</strong> Les agents exécutent automatiquement
          uniquement les actions marquées <code style={{ background: 'rgba(34,197,94,0.12)', padding: '1px 5px', borderRadius: 4 }}>auto_ready</code> ou{' '}
          <code style={{ background: 'rgba(34,197,94,0.12)', padding: '1px 5px', borderRadius: 4 }}>approved</code>.
          Toute action marquée <code style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', padding: '1px 5px', borderRadius: 4 }}>requires_human_approval</code> est bloquée
          jusqu'à validation explicite dans le panneau ci-dessous.
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div style={{
          display: 'flex', gap: 4,
          borderBottom: '1px solid rgba(148,163,184,0.1)',
          marginBottom: 24,
        }}>
          <button style={tabBtn(tab === 'approvals')} onClick={() => setTab('approvals')}>
            <Inbox size={15} />
            Approbations en attente
            {(quickStatus?.pending_approvals_count ?? 0) > 0 && (
              <span style={{
                padding: '2px 7px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800,
                background: 'rgba(249,115,22,0.2)', color: '#fb923c',
              }}>
                {quickStatus?.pending_approvals_count}
              </span>
            )}
          </button>
          <button style={tabBtn(tab === 'scheduler')} onClick={() => setTab('scheduler')}>
            <Clock size={15} />
            Scheduler &amp; jobs
          </button>
        </div>

        {tab === 'approvals' && <PendingApprovalsPanel />}
        {tab === 'scheduler' && <SchedulerPanel />}
      </div>
    </div>
  );
}
