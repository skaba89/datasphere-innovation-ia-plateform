import { useEffect, useState } from 'react';
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
import PendingApprovalsPanel from '../components/PendingApprovalsPanel';
import SchedulerPanel from '../components/SchedulerPanel';

type Tab = 'approvals' | 'scheduler' | 'gantt' | 'exports' | 'activity' | 'health';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  const [quickStatus, setQuickStatus] = useState<SchedulerStatus | null>(null);
  const token = tokenStorage.get();

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
  }, [token]);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: active ? 700 : 500, fontSize: '0.88rem',
    background: active ? 'rgba(250,204,21,0.12)' : 'none',
    color: active ? '#facc15' : '#94a3b8',
    borderBottom: active ? '2px solid #facc15' : '2px solid transparent',
    transition: 'all 0.18s', whiteSpace: 'nowrap', flex: '0 0 auto',
  });

  return (
    <main className="app-shell operations-page">
      <section className="panel">
        <p className="eyebrow">Opérations</p>
        <h1>Pipeline autonome</h1>
        <p className="subtitle">
          Les agents opèrent en autonomie selon les règles de gouvernance définies. Approuvez les actions sensibles et surveillez le scheduler en temps réel.
        </p>
      </section>

      <section className="operations-stats-grid" aria-label="Indicateurs opérations">
        <OperationStat icon={<Activity size={16} color="#facc15" />} color="#facc15" label="Scheduler" value={quickStatus == null ? '—' : quickStatus.running ? 'Actif' : 'En pause'} valueColor={quickStatus?.running ? '#22c55e' : '#94a3b8'} />
        <OperationStat icon={<Zap size={16} color="#93c5fd" />} color="#3b82f6" label="Jobs actifs" value={quickStatus?.jobs.length ?? '—'} valueColor="#93c5fd" mono />
        <OperationStat icon={<ShieldCheck size={16} color={(quickStatus?.pending_approvals_count ?? 0) > 0 ? '#fb923c' : '#86efac'} />} color={(quickStatus?.pending_approvals_count ?? 0) > 0 ? '#f97316' : '#22c55e'} label="En attente de validation" value={quickStatus?.pending_approvals_count ?? '—'} valueColor={(quickStatus?.pending_approvals_count ?? 0) > 0 ? '#fb923c' : '#86efac'} mono />
        <OperationStat icon={<Bot size={16} color="#a78bfa" />} color="#8b5cf6" label="Moteur LLM" value="simulation" valueColor="#a78bfa" />
      </section>

      <section className="operations-notice">
        <ShieldCheck size={16} color="#86efac" />
        <div>
          <strong>Règle fondamentale de gouvernance :</strong> Les agents exécutent automatiquement uniquement les actions marquées <code>auto_ready</code> ou <code>approved</code>. Toute action marquée <code className="warning-code">requires_human_approval</code> est bloquée jusqu'à validation explicite dans le panneau ci-dessous.
        </div>
      </section>

      <section className="panel operations-workspace">
        <div className="operations-tabs">
          <button style={tabBtn(tab === 'approvals')} onClick={() => setTab('approvals')} type="button">
            <Inbox size={15} /> Approbations en attente
            {(quickStatus?.pending_approvals_count ?? 0) > 0 && <span className="operations-badge">{quickStatus?.pending_approvals_count}</span>}
          </button>
          <button style={tabBtn(tab === 'scheduler')} onClick={() => setTab('scheduler')} type="button"><Clock size={15} /> Scheduler &amp; jobs</button>
          <button style={tabBtn(tab === 'gantt')} onClick={() => setTab('gantt')} type="button"><Activity size={15} /> Gantt missions</button>
          <button style={tabBtn(tab === 'exports')} onClick={() => setTab('exports')} type="button"><Download size={15} /> Exports Excel</button>
          <button style={tabBtn(tab === 'activity')} onClick={() => setTab('activity')} type="button"><Clock size={15} /> Activité</button>
          <button style={tabBtn(tab === 'health')} onClick={() => setTab('health')} type="button"><Activity size={15} /> Santé</button>
        </div>

        <div className="operations-panel-body">
          {tab === 'approvals' && <PendingApprovalsPanel />}
          {tab === 'scheduler' && <SchedulerPanel />}
          {tab === 'gantt' && <GanttChart />}
          {tab === 'exports' && <ExportsPanel />}
          {tab === 'activity' && <ActivityFeed days={14} limit={40} />}
          {tab === 'health' && <HealthMonitorPanel />}
        </div>
      </section>
    </main>
  );
}

function OperationStat({ icon, color, label, value, valueColor, mono = false }: { icon: React.ReactNode; color: string; label: string; value: React.ReactNode; valueColor: string; mono?: boolean }) {
  return (
    <article className="operations-stat-card" style={{ borderColor: `${color}25` }}>
      <div className="operations-stat-icon" style={{ background: `${color}15`, borderColor: `${color}25` }}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong style={{ color: valueColor, fontFamily: mono ? 'monospace' : undefined }}>{value}</strong>
      </div>
    </article>
  );
}

function ExportsPanel() {
  const exports = [
    { key: 'pipeline', label: 'Pipeline commercial', desc: 'Toutes les opportunités avec valeur, probabilité, pipeline pondéré et prochaine action.', url: `${API}/export/excel/pipeline`, color: '#facc15' },
    { key: 'tenders', label: "Appels d'offres", desc: "Tous les AO avec scores Go/No-Go, statuts, deadlines et nombre d'exigences.", url: `${API}/export/excel/tenders`, color: '#3b82f6' },
    { key: 'actions', label: 'Actions agents', desc: 'Rapport complet des actions : statut, approbations, exécutions, résultats.', url: `${API}/export/excel/actions`, color: '#8b5cf6' },
    { key: 'deliverables', label: 'Livrables', desc: 'Tous les livrables : statut, version, reviewer, approbateur, résumé.', url: `${API}/export/excel/deliverables`, color: '#22c55e' },
    { key: 'full-report', label: 'Rapport complet (multi-onglets)', desc: '4 onglets en un seul fichier : Pipeline + AO + Actions + Livrables.', url: `${API}/export/excel/full-report`, color: '#f97316', featured: true },
  ];

  return (
    <div className="operations-exports">
      <div className="operations-export-header">
        <strong>Exports Excel</strong>
        <p>Téléchargez vos données en .xlsx avec mise en forme professionnelle, en-têtes colorés et largeurs automatiques.</p>
      </div>
      <div className="operations-export-list">
        {exports.map((exp) => (
          <article key={exp.key} className="operations-export-card" style={{ background: exp.featured ? `${exp.color}08` : undefined, borderColor: exp.featured ? `${exp.color}30` : undefined }}>
            <div className="operations-export-icon" style={{ background: `${exp.color}15`, borderColor: `${exp.color}25` }}>📊</div>
            <div className="operations-export-copy">
              <strong style={{ color: exp.featured ? exp.color : undefined }}>
                {exp.label}
                {exp.featured && <span style={{ background: `${exp.color}20`, color: exp.color }}>RECOMMANDÉ</span>}
              </strong>
              <p>{exp.desc}</p>
            </div>
            <a href={exp.url} download style={{ background: exp.featured ? exp.color : undefined, color: exp.featured ? '#0f172a' : undefined }}>
              <Download size={13} /> .xlsx
            </a>
          </article>
        ))}
      </div>
      <div className="operations-export-tip">💡 Les exports utilisent votre session active. Ouvrez directement dans Excel, Numbers ou LibreOffice Calc.</div>
    </div>
  );
}
