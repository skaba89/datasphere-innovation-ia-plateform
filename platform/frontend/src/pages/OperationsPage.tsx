import { useEffect, useState } from 'react';
import { API_BASE } from '../api/config';
import {
  Activity,
  Bot,
  Clock,
  Download,
  Inbox,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import { apiRequest, tokenStorage } from '../api/client';
import type { SchedulerStatus } from '../api/domainTypes';
import ActivityFeed from '../components/ActivityFeed';
import GanttChart from '../components/GanttChart';
import HealthMonitorPanel from '../components/HealthMonitorPanel';
import LLMProvidersPanel from '../components/LLMProvidersPanel';
import PendingApprovalsPanel from '../components/PendingApprovalsPanel';
import SchedulerPanel from '../components/SchedulerPanel';
import SuggestionsValidationPanel from '../components/SuggestionsValidationPanel';

// ────────────────────────────────────────────────────────────────────────────

type Tab = 'suggestions' | 'approvals' | 'scheduler' | 'gantt' | 'exports' | 'activity' | 'health' | 'providers';

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('suggestions');
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
          <button style={tabBtn(tab === 'suggestions')} onClick={() => setTab('suggestions')}>
            <Bot size={15} />
            Suggestions IA
          </button>
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
          <button style={tabBtn(tab === 'gantt')} onClick={() => setTab('gantt')}>
            <Activity size={15} />
            Gantt missions
          </button>
          <button style={tabBtn(tab === 'exports')} onClick={() => setTab('exports')}>
            <Download size={15} />
            Exports Excel
          </button>
          <button style={tabBtn(tab === 'activity')} onClick={() => setTab('activity')}>
            <Clock size={15} />
            Activité
          </button>
          <button style={tabBtn(tab === 'health')} onClick={() => setTab('health')}>
            <Activity size={15} />
            Santé
          </button>
          <button style={tabBtn(tab === 'providers')} onClick={() => setTab('providers')}>
            <Zap size={15} />
            Providers IA
          </button>
        </div>

        {tab === 'suggestions' && <SuggestionsValidationPanel />}
        {tab === 'approvals' && <PendingApprovalsPanel />}
        {tab === 'scheduler' && <SchedulerPanel />}
        {tab === 'gantt' && <GanttChart />}
        {tab === 'exports' && <ExportsPanel />}
        {tab === 'activity' && <ActivityFeed days={14} limit={40} />}
        {tab === 'health' && <HealthMonitorPanel />}
        {tab === 'providers' && <LLMProvidersPanel />}
      </div>
    </div>
  );
}

// ── Exports panel ─────────────────────────────────────────────────────────────


function ExportsPanel() {
  const exports = [
    {
      key: 'pipeline',
      label: 'Pipeline commercial',
      desc: 'Toutes les opportunités avec valeur, probabilité, pipeline pondéré et prochaine action.',
      url: `${API_BASE}/export/excel/pipeline`,
      color: '#facc15',
    },
    {
      key: 'tenders',
      label: 'Appels d\'offres',
      desc: 'Tous les AO avec scores Go/No-Go, statuts, deadlines et nombre d\'exigences.',
      url: `${API_BASE}/export/excel/tenders`,
      color: '#3b82f6',
    },
    {
      key: 'actions',
      label: 'Actions agents',
      desc: 'Rapport complet des actions : statut, approbations, exécutions, résultats.',
      url: `${API_BASE}/export/excel/actions`,
      color: '#8b5cf6',
    },
    {
      key: 'deliverables',
      label: 'Livrables',
      desc: 'Tous les livrables : statut, version, reviewer, approbateur, résumé.',
      url: `${API_BASE}/export/excel/deliverables`,
      color: '#22c55e',
    },
    {
      key: 'full-report',
      label: 'Rapport complet (multi-onglets)',
      desc: '4 onglets en un seul fichier : Pipeline + AO + Actions + Livrables.',
      url: `${API_BASE}/export/excel/full-report`,
      color: '#f97316',
      featured: true,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>Exports Excel</div>
        <p style={{ color: '#64748b', fontSize: '0.84rem' }}>
          Téléchargez vos données en .xlsx avec mise en forme professionnelle, en-têtes colorés et largeurs automatiques.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {exports.map((exp) => (
          <div key={exp.key} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '18px 20px',
            background: exp.featured ? `${exp.color}08` : 'rgba(15,30,54,0.85)',
            border: `1px solid ${exp.featured ? exp.color + '30' : 'rgba(148,163,184,0.12)'}`,
            borderRadius: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: `${exp.color}15`, border: `1px solid ${exp.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
            }}>
              📊
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4, color: exp.featured ? exp.color : '#f1f5f9' }}>
                {exp.label}
                {exp.featured && (
                  <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 99, background: `${exp.color}20`, color: exp.color, fontSize: '0.7rem', fontWeight: 800 }}>
                    RECOMMANDÉ
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{exp.desc}</div>
            </div>
            <a
              href={exp.url}
              download
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 10, border: 'none',
                background: exp.featured ? exp.color : 'rgba(255,255,255,0.07)',
                color: exp.featured ? '#0f172a' : '#94a3b8',
                fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <Download size={13} /> .xlsx
            </a>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, fontSize: '0.82rem', color: '#86efac' }}>
        💡 Les exports utilisent votre session active. Ouvrez directement dans Excel, Numbers ou LibreOffice Calc.
      </div>
    </div>
  );
}
