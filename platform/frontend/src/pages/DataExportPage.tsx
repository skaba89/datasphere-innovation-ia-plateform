import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  FileJson,
  RefreshCw,
  ShieldCheck,
  Table2,
} from 'lucide-react';

import { apiRequest, tokenStorage } from '../api/client';
import type {
  AuditLog,
  Deliverable,
  Opportunity,
  Organization,
  PipelineAnalytics,
  Tender,
} from '../api/domainTypes';

type ExportFormat = 'csv' | 'json';
type DatasetKey = 'analytics' | 'organizations' | 'opportunities' | 'tenders' | 'deliverables' | 'auditLogs';

type ExportDataset = {
  key: DatasetKey;
  label: string;
  description: string;
  endpoint: string;
  icon: React.ElementType;
  filename: string;
  normalize: (payload: unknown) => Record<string, unknown>[];
};

type ExportState = Partial<Record<DatasetKey, Record<string, unknown>[]>>;

const DATASETS: ExportDataset[] = [
  {
    key: 'analytics',
    label: 'Dashboard analytics',
    description: 'KPIs consolidés du pipeline, AO, agents, livrables et notifications.',
    endpoint: '/analytics/pipeline',
    icon: Database,
    filename: 'datasphere-dashboard-analytics',
    normalize: payload => flattenAnalytics(payload as PipelineAnalytics),
  },
  {
    key: 'organizations',
    label: 'Organisations',
    description: 'Comptes, organismes, partenaires, pays, secteurs et métadonnées CRM.',
    endpoint: '/organizations',
    icon: Table2,
    filename: 'datasphere-organisations',
    normalize: payload => (payload as Organization[]).map(toRecord),
  },
  {
    key: 'opportunities',
    label: 'Opportunités',
    description: 'Pipeline commercial, priorités, statuts, probabilités et responsables.',
    endpoint: '/opportunities',
    icon: Table2,
    filename: 'datasphere-opportunites',
    normalize: payload => (payload as Opportunity[]).map(toRecord),
  },
  {
    key: 'tenders',
    label: "Appels d'offres",
    description: 'AO, acheteurs, scores Go / No-Go, décisions et échéances.',
    endpoint: '/tenders',
    icon: Table2,
    filename: 'datasphere-appels-offres',
    normalize: payload => (payload as Tender[]).map(toRecord),
  },
  {
    key: 'deliverables',
    label: 'Livrables',
    description: 'Bibliothèque des livrables, versions, statuts de revue et approbations.',
    endpoint: '/deliverables',
    icon: FileJson,
    filename: 'datasphere-livrables',
    normalize: payload => (payload as Deliverable[]).map(toRecord),
  },
  {
    key: 'auditLogs',
    label: "Journal d'audit",
    description: 'Derniers événements de sécurité et de traçabilité exportables.',
    endpoint: '/audit-logs?skip=0&limit=100',
    icon: ShieldCheck,
    filename: 'datasphere-journal-audit',
    normalize: payload => (payload as AuditLog[]).map(toRecord),
  },
];

function toRecord<T extends object>(item: T): Record<string, unknown> {
  return { ...item } as Record<string, unknown>;
}

function countPipelineNotifications(notifications: PipelineAnalytics['notifications']): number {
  return Array.isArray(notifications) ? notifications.length : 0;
}

function flattenAnalytics(data: PipelineAnalytics): Record<string, unknown>[] {
  if (!data) return [];
  return [
    {
      computed_at: data.computed_at,
      opportunities_total: data.opportunities.total,
      opportunities_high_priority: data.opportunities.high_priority,
      opportunities_won: data.opportunities.won,
      opportunities_lost: data.opportunities.lost,
      opportunities_pipeline_value: data.opportunities.pipeline_value,
      opportunities_total_potential: data.opportunities.total_potential,
      opportunities_avg_probability: data.opportunities.avg_probability,
      tenders_total: data.tenders.total,
      tenders_go_count: data.tenders.go_count,
      tenders_no_go_count: data.tenders.no_go_count,
      tenders_avg_go_score: data.tenders.avg_go_score,
      tenders_deadlines_this_week: data.tenders.deadlines_this_week,
      agents_total_profiles: data.agents.total_profiles,
      agents_total_assignments: data.agents.total_assignments,
      agents_total_actions: data.agents.total_actions,
      agents_actions_done: data.agents.actions_done,
      agents_actions_pending: data.agents.actions_pending,
      agents_actions_failed: data.agents.actions_failed,
      deliverables_total: data.deliverables.total,
      deliverables_approved: data.deliverables.approved,
      deliverables_in_review: data.deliverables.in_review,
      notifications_count: countPipelineNotifications(data.notifications),
    },
  ];
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const lines = [
    headers.join(';'),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(';')),
  ];
  return lines.join('\n');
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildFilename(baseName: string, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName}-${date}.${format}`;
}



// ── Server-side CSV Quick Downloads ──────────────────────────────────────────
function QuickCSVDownloads({ token }: { token: string | null }) {
  const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const downloads = [
    { label: "📋 Appels d'offres",   path: '/export/excel/tenders/csv',       file: 'appels_offres.csv' },
    { label: '📝 Livrables',          path: '/export/excel/deliverables/csv',  file: 'livrables.csv'    },
    { label: '🏢 Organisations',      path: '/export/excel/contacts/csv',       file: 'contacts.csv'     },
    { label: '🎯 Opportunités',       path: '/export/excel/opportunities/csv',  file: 'opportunites.csv' },
    { label: '🔍 Logs audit',         path: '/audit-logs/export/csv',          file: 'audit_logs.csv'   },
  ];

  async function download(path: string, filename: string) {
    try {
      const resp = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert(`Erreur export: ${e}`);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '.82rem', fontWeight: 800, color: '#facc15' }}>
        ⚡ Export rapide CSV (serveur)
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {downloads.map(d => (
          <button key={d.path} onClick={() => download(d.path, d.file)}
            style={{
              padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)',
              background: 'rgba(255,255,255,.03)', color: '#94a3b8', cursor: 'pointer',
              fontSize: '.78rem', fontWeight: 600, textAlign: 'left' as const,
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(250,204,21,.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148,163,184,.12)')}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DataExportPage() {
  const token = tokenStorage.get();
  const [data, setData] = useState<ExportState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const totalRows = useMemo(
    () => Object.values(data).reduce((sum, rows) => sum + (rows?.length ?? 0), 0),
    [data],
  );

  async function loadExports() {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        DATASETS.map(async dataset => {
          const payload = await apiRequest<unknown>(dataset.endpoint, {}, token);
          return [dataset.key, dataset.normalize(payload)] as const;
        }),
      );
      setData(Object.fromEntries(results) as ExportState);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des données exportables.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExports();
  }, []);

  function exportDataset(dataset: ExportDataset, format: ExportFormat) {
    const rows = data[dataset.key] ?? [];
    if (format === 'json') {
      downloadBlob(
        buildFilename(dataset.filename, 'json'),
        JSON.stringify(rows, null, 2),
        'application/json;charset=utf-8',
      );
      return;
    }
    downloadBlob(buildFilename(dataset.filename, 'csv'), toCsv(rows), 'text/csv;charset=utf-8');
  }

  function exportAll(format: ExportFormat) {
    if (format === 'json') {
      downloadBlob(
        buildFilename('datasphere-export-complet', 'json'),
        JSON.stringify(data, null, 2),
        'application/json;charset=utf-8',
      );
      return;
    }

    const content = DATASETS.map(dataset => {
      const rows = data[dataset.key] ?? [];
      return `# ${dataset.label}\n${toCsv(rows)}`;
    }).join('\n\n');
    downloadBlob(buildFilename('datasphere-export-complet', 'csv'), content, 'text/csv;charset=utf-8');
  }

  if (!token) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p className="eyebrow">Exports</p>
          <h1>Exports de données</h1>
          <p>Connecte-toi pour exporter les données de la plateforme.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell data-export-page">
      <section className="panel page-hero">
        <p className="eyebrow">Gouvernance data</p>
        <h1>Exports de données</h1>
        <p className="subtitle">
          Télécharge les principales données de la plateforme en CSV ou JSON pour audit,
          sauvegarde, reporting ou reprise externe.
        </p>
        <div className="hero-actions">
          <button className="team-primary-button" type="button" onClick={loadExports} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
          <button className="team-secondary-button" type="button" onClick={() => exportAll('csv')} disabled={totalRows === 0}>
            <Download size={15} /> Export complet CSV
          </button>
          <button className="team-secondary-button" type="button" onClick={() => exportAll('json')} disabled={totalRows === 0}>
            <FileJson size={15} /> Export complet JSON
          </button>
        </div>
      </section>

      {error && <div className="team-alert error"><AlertTriangle size={16} /> {error}</div>}
      {lastUpdated && <p className="compact-subtitle">Dernière actualisation : {new Date(lastUpdated).toLocaleString('fr-FR')}</p>}

      <section className="data-export-grid">
        {DATASETS.map(dataset => {
          const Icon = dataset.icon;
          const rows = data[dataset.key] ?? [];
          return (
            <article className="panel data-export-card" key={dataset.key}>
              <div className="data-export-card-header">
                <span className="data-export-icon"><Icon size={18} /></span>
                <div>
                  <h2>{dataset.label}</h2>
                  <p>{dataset.description}</p>
                </div>
              </div>
              <div className="data-export-meta">
                <strong>{rows.length}</strong>
                <span>lignes chargées</span>
              </div>
              <div className="automation-actions">
                <button type="button" className="icon-button" onClick={() => exportDataset(dataset, 'csv')} disabled={rows.length === 0}>
                  <Download size={13} /> CSV
                </button>
                <button type="button" className="icon-button" onClick={() => exportDataset(dataset, 'json')} disabled={rows.length === 0}>
                  <FileJson size={13} /> JSON
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
