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



// ── CSV Import Panel ─────────────────────────────────────────────────────────
function CSVImportPanel({ token }: { token: string | null }) {
  const [type, setType] = useState<'organizations' | 'contacts'>('organizations');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{imported:number;errors:string[]} | null>(null);

  const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  async function downloadTemplate() {
    const resp = await fetch(`${API}/csv-import/template/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `template_${type}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file || !token) return;
    setImporting(true); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch(`${API}/csv-import/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await resp.json();
      setResult({ imported: data.imported ?? 0, errors: data.errors ?? [] });
    } catch (e) { setResult({ imported: 0, errors: [String(e)] }); }
    finally { setImporting(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['organizations', 'contacts'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            padding: '4px 10px', borderRadius: 7, border: `1px solid ${type===t?'rgba(250,204,21,.4)':'rgba(148,163,184,.15)'}`,
            background: type===t?'rgba(250,204,21,.08)':'none', color: type===t?'#facc15':'#64748b',
            cursor: 'pointer', fontSize: '.72rem', fontWeight: 600,
          }}>
            {t === 'organizations' ? 'Organisations' : 'Contacts'}
          </button>
        ))}
      </div>
      <button onClick={downloadTemplate} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.74rem', textAlign: 'left' as const }}>
        ⬇ Télécharger le template CSV
      </button>
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] ?? null)}
        style={{ fontSize: '.74rem', color: '#64748b' }} />
      <button onClick={handleImport} disabled={!file || importing}
        style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.78rem', opacity: !file?0.5:1 }}>
        {importing ? '⏳ Import…' : '📥 Importer'}
      </button>
      {result && (
        <div style={{ fontSize: '.74rem', padding: '8px 10px', borderRadius: 8, background: result.errors.length?'rgba(239,68,68,.06)':'rgba(34,197,94,.06)', color: result.errors.length?'#fca5a5':'#86efac', border: `1px solid ${result.errors.length?'rgba(239,68,68,.2)':'rgba(34,197,94,.2)'}` }}>
          {result.imported} ligne(s) importée(s)
          {result.errors.length > 0 && <div style={{ marginTop: 4 }}>⚠ {result.errors.slice(0,3).join(' | ')}</div>}
        </div>
      )}
    </div>
  );
}

// ── Weekly Report Panel ────────────────────────────────────────────────────────
function WeeklyReportPanel({ token }: { token: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function loadPreview() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<{subject:string;body_html:string;body_text:string}>('/reports/weekly/preview', {}, token);
      setPreview(data.body_text || data.subject || 'Rapport généré');
    } catch { setPreview('Erreur chargement aperçu.'); }
    finally { setLoading(false); }
  }

  async function sendNow() {
    if (!token) return;
    try {
      await apiRequest('/reports/weekly/send', { method: 'POST' }, token);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch { }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: '.74rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
        Rapport hebdomadaire automatique : AOs actifs, livrables, pipeline, performance agents.
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={loadPreview} disabled={loading}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.76rem', fontWeight: 600 }}>
          {loading ? '⏳ …' : '👁 Aperçu'}
        </button>
        <button onClick={sendNow}
          style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.76rem' }}>
          {sent ? '✅ Envoyé !' : '📨 Envoyer maintenant'}
        </button>
      </div>
      {preview && (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.72rem', color: '#475569', background: 'rgba(0,0,0,.2)', padding: '10px 12px', borderRadius: 8, maxHeight: 160, overflow: 'auto', margin: 0 }}>
          {preview.slice(0, 600)}
        </pre>
      )}
    </div>
  );
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
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

      {/* Quick CSV + Import CSV + Rapport hebdo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 8 }}>

        {/* Export CSV rapide */}
        <section className="panel" style={{ padding: '18px 20px' }}>
          <QuickCSVDownloads token={token} />
        </section>

        {/* Import CSV */}
        <section className="panel" style={{ padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '.82rem', fontWeight: 800, color: '#facc15' }}>
            📥 Import CSV
          </h3>
          <CSVImportPanel token={token} />
        </section>

        {/* Rapport hebdomadaire */}
        <section className="panel" style={{ padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '.82rem', fontWeight: 800, color: '#facc15' }}>
            📊 Rapport hebdomadaire
          </h3>
          <WeeklyReportPanel token={token} />
        </section>
      </div>

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
