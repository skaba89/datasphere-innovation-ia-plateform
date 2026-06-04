import { useEffect, useState } from 'react';
import type { CSSProperties, ElementType } from 'react';
import {
  Activity, AlertTriangle, Bot, Building2, CheckCircle2,
  Clock, FileText, RefreshCw, Target, TrendingUp, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { PipelineAnalytics } from '../api/domainTypes';
import ActivityFeed from '../components/ActivityFeed';

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k €`;
  return `${n.toFixed(0)} €`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: string;
}) {
  return (
    <article className="dashboard-kpi-card" style={{ borderColor: `${color}30` }}>
      <div className="dashboard-kpi-topline">
        <div className="dashboard-kpi-icon" style={{ background: `${color}12`, borderColor: `${color}25` }}>
          <Icon size={18} color={color} />
        </div>
        {trend && (
          <span className="dashboard-kpi-trend" style={{ color: trend.startsWith('+') ? '#22c55e' : '#64748b' }}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="dashboard-kpi-value" style={{ color }}>
          {value}
        </div>
        <div className="dashboard-kpi-label">{label}</div>
        {sub && <div className="dashboard-kpi-subtitle">{sub}</div>}
      </div>
    </article>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="dashboard-status-row">
      <div className="dashboard-status-labels">
        <span>{label}</span>
        <strong style={{ color }}>{count} <em>({pct}%)</em></strong>
      </div>
      <div className="dashboard-progress-track">
        <div className="dashboard-progress-value" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const analytics = await apiRequest<PipelineAnalytics>('/analytics/pipeline', {}, token);
      setData(analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const card: CSSProperties = {
    background: 'rgba(15,30,54,0.85)',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 16,
    padding: 'clamp(16px, 3vw, 22px)',
    minWidth: 0,
  };

  const sectionTitle: CSSProperties = {
    fontFamily: 'var(--font-head, Syne, sans-serif)',
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 16,
  };

  if (error) {
    return (
      <div className="dashboard-error-state">
        <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
        <div>{error}</div>
        <button onClick={load} className="dashboard-secondary-button" type="button">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-eyebrow">Console</div>
          <h1>Pipeline DataSphere</h1>
          <p>{data ? `Mis à jour ${fmtDate(data.computed_at)}` : 'Chargement…'}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="dashboard-refresh-button"
          type="button"
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Actualiser
        </button>
      </header>

      {data && (
        <section className="dashboard-kpi-grid" aria-label="Indicateurs principaux">
          <KpiCard
            icon={TrendingUp}
            color="#facc15"
            label="Pipeline commercial"
            value={fmtCurrency(data.opportunities.pipeline_value)}
            sub={`${data.opportunities.total} opps · moy. ${data.opportunities.avg_probability}%`}
          />
          <KpiCard
            icon={Target}
            color="#3b82f6"
            label="Appels d'offres"
            value={data.tenders.total}
            sub={`${data.tenders.go_count} Go · score moy. ${data.tenders.avg_go_score}/100`}
          />
          <KpiCard
            icon={Bot}
            color="#8b5cf6"
            label="Actions agents"
            value={`${data.agents.completion_rate}%`}
            sub={`${data.agents.actions_done} terminées / ${data.agents.total_actions}`}
          />
          <KpiCard
            icon={FileText}
            color="#22c55e"
            label="Livrables approuvés"
            value={data.deliverables.approved}
            sub={`${data.deliverables.approval_rate}% taux d'approbation`}
          />
          <KpiCard
            icon={Zap}
            color={data.agents.actions_pending_approval > 0 ? '#f97316' : '#22c55e'}
            label="En attente validation"
            value={data.agents.actions_pending_approval}
            sub={data.agents.actions_pending_approval > 0 ? 'Révision requise' : 'Pipeline fluide'}
          />
        </section>
      )}

      {data && (
        <section className="dashboard-card-grid dashboard-card-grid-three">
          <article style={card}>
            <div style={sectionTitle}>
              <Building2 size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Opportunités par statut
            </div>
            {Object.entries(data.opportunities.by_status).length === 0 ? (
              <div className="dashboard-empty-state">Aucune opportunité</div>
            ) : (
              Object.entries(data.opportunities.by_status)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <StatusBar
                    key={status}
                    label={status}
                    count={count}
                    total={data.opportunities.total}
                    color={status === 'Gagnée' ? '#22c55e' : status === 'Perdue' ? '#ef4444' : '#3b82f6'}
                  />
                ))
            )}
            <div className="dashboard-highlight-box">
              <div>Valeur totale potentielle</div>
              <strong>{fmtCurrency(data.opportunities.total_potential)}</strong>
            </div>
          </article>

          <article style={card}>
            <div style={sectionTitle}>
              <Target size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Appels d'offres
            </div>
            <div className="dashboard-mini-grid">
              {[
                { label: 'Décision Go', value: data.tenders.go_count, color: '#22c55e' },
                { label: 'No-Go', value: data.tenders.no_go_count, color: '#ef4444' },
                { label: 'Score moyen', value: `${data.tenders.avg_go_score}/100`, color: '#facc15' },
                { label: 'Deadlines / 7j', value: data.tenders.deadlines_this_week, color: data.tenders.deadlines_this_week > 0 ? '#f97316' : '#64748b' },
              ].map(({ label, value, color }) => (
                <div key={label} className="dashboard-mini-card">
                  <span>{label}</span>
                  <strong style={{ color }}>{value}</strong>
                </div>
              ))}
            </div>
            {data.tenders.deadlines_this_week > 0 && (
              <div className="dashboard-warning-box">
                <Clock size={13} />
                {data.tenders.deadlines_this_week} deadline{data.tenders.deadlines_this_week > 1 ? 's' : ''} dans les 7 prochains jours
              </div>
            )}
          </article>

          <article style={card}>
            <div style={sectionTitle}>
              <FileText size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Livrables
            </div>
            {[
              { label: 'Brouillons', count: data.deliverables.draft, color: '#facc15' },
              { label: 'En révision', count: data.deliverables.in_review, color: '#3b82f6' },
              { label: 'Approuvés', count: data.deliverables.approved, color: '#22c55e' },
            ].map(({ label, count, color }) => (
              <StatusBar key={label} label={label} count={count} total={data.deliverables.total} color={color} />
            ))}
            <div className="dashboard-success-box">
              <CheckCircle2 size={14} color="#86efac" />
              <span>{data.deliverables.approval_rate}% taux d'approbation</span>
            </div>
          </article>
        </section>
      )}

      {data && (
        <section className="dashboard-card-grid dashboard-card-grid-two">
          <article style={card}>
            <div style={sectionTitle}>
              <Bot size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Activité des agents
            </div>
            <div className="dashboard-mini-grid dashboard-mini-grid-three">
              {[
                { label: 'Profils', value: data.agents.total_profiles, color: '#8b5cf6' },
                { label: 'Affectations', value: data.agents.total_assignments, color: '#3b82f6' },
                { label: 'Actions totales', value: data.agents.total_actions, color: '#94a3b8' },
              ].map(({ label, value, color }) => (
                <div key={label} className="dashboard-mini-card dashboard-mini-card-centered">
                  <strong style={{ color }}>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {[
              { label: 'Terminées', count: data.agents.actions_done, total: data.agents.total_actions, color: '#22c55e' },
              { label: 'En cours / prêtes', count: data.agents.actions_pending, total: data.agents.total_actions, color: '#3b82f6' },
              { label: 'Échecs', count: data.agents.actions_failed, total: data.agents.total_actions, color: '#ef4444' },
            ].map((s) => <StatusBar key={s.label} {...s} />)}
            {data.agents.actions_pending_approval > 0 && (
              <div className="dashboard-warning-box">
                <AlertTriangle size={13} />
                <strong>{data.agents.actions_pending_approval}</strong>&nbsp;action{data.agents.actions_pending_approval > 1 ? 's' : ''} en attente de validation humaine
              </div>
            )}
          </article>

          <div className="dashboard-stack">
            <article style={{ ...card, padding: 'clamp(16px, 3vw, 18px)' }}>
              <div style={sectionTitle}>
                <Activity size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Scheduler
              </div>
              <div className="dashboard-scheduler-row">
                <div>
                  <div className="dashboard-scheduler-status">
                    <span className={data.scheduler.running ? 'is-running' : ''} />
                    <strong>{data.scheduler.running ? 'Actif' : 'Inactif'}</strong>
                    <em>· {data.scheduler.jobs_count} jobs</em>
                  </div>
                  <p>Dernière exec : {fmtDate(data.scheduler.last_execution)}</p>
                </div>
                <div className="dashboard-scheduler-count">
                  <strong>{data.scheduler.executions_today}</strong>
                  <span>exécutions aujourd'hui</span>
                  {data.scheduler.errors_today > 0 && (
                    <em>{data.scheduler.errors_today} erreur{data.scheduler.errors_today > 1 ? 's' : ''}</em>
                  )}
                </div>
              </div>
            </article>

            <article style={{ ...card, padding: 'clamp(16px, 3vw, 18px)' }}>
              <div className="dashboard-alert-title">
                <div style={sectionTitle}>Alertes actives</div>
                {data.notifications.length > 0 && <span>{data.notifications.length}</span>}
              </div>
              {data.notifications.length === 0 ? (
                <div className="dashboard-empty-state">
                  <CheckCircle2 size={24} color="#22c55e" />
                  Aucune alerte
                </div>
              ) : (
                <div className="dashboard-alert-list">
                  {data.notifications.slice(0, 4).map((n, i) => (
                    <div key={i} className={n.priority === 'high' ? 'dashboard-alert-item is-high' : 'dashboard-alert-item'}>
                      <span />
                      <div>
                        <strong>{n.title}</strong>
                        <p>{n.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {data && <ActivityFeed compact days={7} limit={8} />}
    </div>
  );
}
