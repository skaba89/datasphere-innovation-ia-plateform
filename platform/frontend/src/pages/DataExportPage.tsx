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
    endpoint: '/audit-logs?skip=0&limit=1000',
    icon: ShieldCheck,
    filename: 'datasphere-journal-audit',
    normalize: payload => (payload as AuditLog[]).map(toRecord),
  },
];

function toRecord<T extends object>(item: T): Record<string, unknown> {
  return { ...item } as Record<string, unknown>;
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
      agents_actions_pending_approval: data.agents.actions_pending_approval,
      agents_completion_rate: data.agents.completion_rate,
      deliverables_total: data.deliverables.total,
      deliverables_draft: data.deliverables.draft,
      deliverables_in_review: data.deliverables.in_review,
      deliverables_approved: data.deliverables.approved,
      deliverables_approval_rate: data.deliverables.approval_rate,
      scheduler_running: data.scheduler.running,
      scheduler_jobs_count: data.scheduler.jobs_count,
      scheduler_last_execution: data.scheduler.last_execution,
      scheduler_executions_today: data.scheduler.executions_today,
      scheduler_errors_today: data.scheduler.errors_today,
      notifications_count: data.notifications.length,
    },
  ];
}

function csvEscape(value: unknown): string {
  const normalized = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  if (/[";\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(rows: Record<string, unknown>[]): string {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const header = columns.join(';');
  const body = rows.map(row => columns.map(column => csvEscape(row[column])).join(';')).join('\n');
  return `\uFEFF${[header, body].filter(Boolean).join('\n')}`;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildFilename(baseName: string, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName}-${date}.${format}`;
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

    downloadBlob(
      buildFilename(dataset.filename, 'csv'),
      toCsv(rows),
      'text/csv;charset=utf-8',
    );
  }

  function exportAll(format: ExportFormat) {
    const payload = Object.fromEntries(
      DATASETS.map(dataset => [dataset.key, data[dataset.key] ?? []]),
    );

    if (format === 'json') {
      downloadBlob(
        buildFilename('datasphere-export-complet', 'json'),
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
      );
      return;
    }

    const sections = DATASETS.map(dataset => {
      const rows = data[dataset.key] ?? [];
      return [`# ${dataset.label}`, toCsv(rows).replace(/^\uFEFF/, '')].join('\n');
    });

    downloadBlob(
      buildFilename('datasphere-export-complet', 'csv'),
      `\uFEFF${sections.join('\n\n')}`,
      'text/csv;charset=utf-8',
    );
  }

  return (
    <main className="app-shell">
      <section className="panel" style={{ marginBottom: 24 }}>
        <p className="eyebrow">Export des données</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>Exports Dashboard</h1>
            <p className="subtitle">
              Télécharge les données clés du dashboard en CSV compatible Excel ou en JSON pour les traitements techniques.
            </p>
            <p style={{ color: '#64748b', fontSize: '.86rem', marginTop: 12 }}>
              {lastUpdated
                ? `Dernière préparation : ${new Date(lastUpdated).toLocaleString('fr-FR')}`
                : 'Préparation des données exportables…'}
            </p>
          </div>
          <button
            type="button"
            onClick={loadExports}
            disabled={loading}
            className="icon-button"
            style={{ minHeight: 44 }}
          >
            <RefreshCw size={16} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Actualiser
          </button>
        </div>
      </section>

      {error && (
        <p className="error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </p>
      )}

      <section className="stats">
        <article>
          <strong>{DATASETS.length}</strong>
          <span>Jeux de données</span>
        </article>
        <article>
          <strong>{totalRows}</strong>
          <span>Lignes prêtes</span>
        </article>
        <article>
          <strong>{loading ? '…' : 'CSV'}</strong>
          <span>Format métier</span>
        </article>
        <article>
          <strong>JSON</strong>
          <span>Format technique</span>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <h2>Export global</h2>
        <p style={{ color: '#cbd5e1', lineHeight: 1.7, marginTop: 0 }}>
          Utilise ces boutons pour exporter en une fois toutes les données préparées pour le dashboard.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="icon-button" onClick={() => exportAll('csv')} disabled={loading || totalRows === 0}>
            <Download size={16} /> Export complet CSV
          </button>
          <button type="button" className="icon-button" onClick={() => exportAll('json')} disabled={loading || totalRows === 0}>
            <FileJson size={16} /> Export complet JSON
          </button>
        </div>
      </section>

      <section className="grid">
        {DATASETS.map(dataset => {
          const Icon = dataset.icon;
          const rows = data[dataset.key] ?? [];
          return (
            <article key={dataset.key} className="card" style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon size={24} />
                <div>
                  <h2 style={{ margin: 0 }}>{dataset.label}</h2>
                  <p style={{ marginTop: 4, fontSize: '.84rem' }}>{rows.length} ligne{rows.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <p>{dataset.description}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="icon-button" onClick={() => exportDataset(dataset, 'csv')} disabled={loading || rows.length === 0}>
                  <Download size={15} /> CSV
                </button>
                <button type="button" className="icon-button" onClick={() => exportDataset(dataset, 'json')} disabled={loading || rows.length === 0}>
                  <FileJson size={15} /> JSON
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .icon-button:disabled { opacity: .55; cursor: not-allowed; }
      `}</style>
    </main>
  );
}
