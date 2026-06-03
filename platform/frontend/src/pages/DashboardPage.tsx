import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Bot, Building2, CheckCircle2,
  Clock, FileText, RefreshCw, Target, TrendingUp, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { PipelineAnalytics } from '../api/domainTypes';
import ActivityFeed from '../components/ActivityFeed';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k €`;
  return `${n.toFixed(0)} €`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color, trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: string;
}) {
  return (
    <div style={{
      background: 'rgba(15,30,54,0.85)',
      border: `1px solid ${color}20`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}12`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        {trend && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: trend.startsWith('+') ? '#22c55e' : '#64748b',
          }}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6, fontWeight: 600 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 3 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function StatusBar({
  label, count, total, color,
}: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.8rem' }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{count} <span style={{ color: '#64748b', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 6, background: 'rgba(148,163,184,0.1)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<{ total: number; tenders: number; opportunities: number; organizations: number } | null>(null);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [analytics, dashKpis, suggestions] = await Promise.all([
        apiRequest<PipelineAnalytics>('/analytics/pipeline', {}, token),
        apiRequest<any>('/analytics/dashboard', {}, token).catch(() => null),
        apiRequest<any>('/suggestions/count', {}, token).catch(() => null),
      ]);
      setData(analytics);
      if (dashKpis) setKpis(dashKpis);
      if (suggestions) setPendingSuggestions(suggestions);
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

  const card: React.CSSProperties = {
    background: 'rgba(15,30,54,0.85)',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 16,
    padding: '22px 24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'var(--font-head, Syne, sans-serif)',
    fontSize: '0.8rem', fontWeight: 800,
    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    color: '#64748b', marginBottom: 16,
  };

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#fca5a5' }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
        <div>{error}</div>
        <button onClick={load} style={{
          marginTop: 16, padding: '8px 20px', background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
          color: '#fca5a5', cursor: 'pointer', fontSize: '0.84rem',
        }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, display: 'grid', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-head, Syne, sans-serif)',
            fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: '#facc15', marginBottom: 8,
          }}>
            Console
          </div>
          <h1 style={{
            fontFamily: 'var(--font-head, Syne, sans-serif)',
            fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6,
          }}>
            Pipeline DataSphere
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.84rem' }}>
            {data ? `Mis à jour ${fmtDate(data.computed_at)}` : 'Chargement…'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'rgba(255,255,255,0.04)',
            color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem',
          }}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>

      {/* KPI Row */}
      {(data || kpis) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <KpiCard
            icon={TrendingUp} color="#facc15"
            label="Pipeline commercial"
            value={fmtCurrency(kpis?.crm?.pipeline_value_weighted ?? data?.opportunities?.pipeline_value ?? 0)}
            sub={`${kpis?.crm?.opportunities_active ?? data?.opportunities?.total ?? 0} actives · ${kpis?.crm?.opportunities_won ?? 0} gagnées`}
          />
          <KpiCard
            icon={Target} color="#3b82f6"
            label="Appels d'offres"
            value={kpis?.tenders?.total ?? data?.tenders?.total ?? 0}
            sub={`${kpis?.tenders?.go_decisions ?? data?.tenders?.go_count ?? 0} Go · ${kpis?.tenders?.upcoming_deadlines_14d ?? 0} deadlines <14j`}
          />
          <KpiCard
            icon={Bot} color="#8b5cf6"
            label="Actions agents"
            value={`${kpis?.agents?.execution_rate ?? data?.agents?.completion_rate ?? 0}%`}
            sub={`${kpis?.agents?.done_last_30d ?? data?.agents?.actions_done ?? 0} terminées / 30j`}
          />
          <KpiCard
            icon={FileText} color="#22c55e"
            label="Livrables approuvés"
            value={kpis?.deliverables?.approved ?? data?.deliverables?.approved ?? 0}
            sub={`${kpis?.deliverables?.approval_rate ?? data?.deliverables?.approval_rate ?? 0}% · ${kpis?.deliverables?.in_review ?? 0} en révision`}
          />
          <KpiCard
            icon={Zap}
            color={(kpis?.agents?.pending_approvals ?? data?.agents?.actions_pending_approval ?? 0) > 0 || (pendingSuggestions?.total ?? 0) > 0 ? '#f97316' : '#22c55e'}
            label="En attente validation"
            value={(kpis?.agents?.pending_approvals ?? data?.agents?.actions_pending_approval ?? 0) + (pendingSuggestions?.total ?? 0)}
            sub={`${pendingSuggestions?.tenders ?? 0} AO · ${pendingSuggestions?.opportunities ?? 0} opps · ${kpis?.notifications?.unread ?? 0} notifs`}
          />
        </div>
      )}

      {/* Suggestions IA banner */}
      {pendingSuggestions && pendingSuggestions.total > 0 && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bot size={16} color="#facc15" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: '.88rem', color: '#fde68a' }}>
              {pendingSuggestions.total} suggestion{pendingSuggestions.total > 1 ? 's' : ''} IA en attente de validation
            </span>
            <span style={{ color: '#64748b', fontSize: '.8rem', marginLeft: 10 }}>
              {pendingSuggestions.tenders} AO · {pendingSuggestions.opportunities} opportunités · {pendingSuggestions.organizations} organismes
            </span>
          </div>
          <a href="#" onClick={e => { e.preventDefault(); }} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(250,204,21,.12)', border: '1px solid rgba(250,204,21,.25)', color: '#facc15', fontSize: '.78rem', fontWeight: 700, textDecoration: 'none' }}>
            → Onglet Opérations
          </a>
        </div>
      )}

      {/* Middle row */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {/* Opportunities funnel */}
          <div style={card}>
            <div style={sectionTitle}>
              <Building2 size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Opportunités par statut
            </div>
            {Object.entries(data.opportunities.by_status).length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.84rem', textAlign: 'center', padding: '20px 0' }}>
                Aucune opportunité
              </div>
            ) : (
              Object.entries(data.opportunities.by_status)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <StatusBar
                    key={status} label={status} count={count}
                    total={data.opportunities.total}
                    color={status === 'Gagnée' ? '#22c55e' : status === 'Perdue' ? '#ef4444' : '#3b82f6'}
                  />
                ))
            )}
            <div style={{
              marginTop: 16, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.15)',
            }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>Valeur totale potentielle</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#facc15', fontFamily: 'monospace' }}>
                {fmtCurrency(data.opportunities.total_potential)}
              </div>
            </div>
          </div>

          {/* Tenders */}
          <div style={card}>
            <div style={sectionTitle}>
              <Target size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Appels d'offres
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Décision Go', value: data.tenders.go_count, color: '#22c55e' },
                { label: 'No-Go', value: data.tenders.no_go_count, color: '#ef4444' },
                { label: 'Score moyen', value: `${data.tenders.avg_go_score}/100`, color: '#facc15' },
                { label: 'Deadlines / 7j', value: data.tenders.deadlines_this_week, color: data.tenders.deadlines_this_week > 0 ? '#f97316' : '#64748b' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(148,163,184,0.08)',
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                </div>
              ))}
            </div>
            {data.tenders.deadlines_this_week > 0 && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                fontSize: '0.8rem', color: '#fb923c',
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <Clock size={13} />
                {data.tenders.deadlines_this_week} deadline{data.tenders.deadlines_this_week > 1 ? 's' : ''} dans les 7 prochains jours
              </div>
            )}
          </div>

          {/* Deliverables */}
          <div style={card}>
            <div style={sectionTitle}>
              <FileText size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Livrables
            </div>
            {[
              { label: 'Brouillons', count: data.deliverables.draft, color: '#facc15' },
              { label: 'En révision', count: data.deliverables.in_review, color: '#3b82f6' },
              { label: 'Approuvés', count: data.deliverables.approved, color: '#22c55e' },
            ].map(({ label, count, color }) => (
              <StatusBar
                key={label} label={label} count={count}
                total={data.deliverables.total} color={color}
              />
            ))}
            <div style={{
              marginTop: 16, display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <CheckCircle2 size={14} color="#86efac" />
              <span style={{ fontSize: '0.8rem', color: '#86efac', fontWeight: 600 }}>
                {data.deliverables.approval_rate}% taux d'approbation
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom row: Agents + Scheduler + Notifications */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Agents activity */}
          <div style={card}>
            <div style={sectionTitle}>
              <Bot size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Activité des agents
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Profils', value: data.agents.total_profiles, color: '#8b5cf6' },
                { label: 'Affectations', value: data.agents.total_assignments, color: '#3b82f6' },
                { label: 'Actions totales', value: data.agents.total_actions, color: '#94a3b8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  padding: '12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
            {[
              { label: 'Terminées', count: data.agents.actions_done, total: data.agents.total_actions, color: '#22c55e' },
              { label: 'En cours / prêtes', count: data.agents.actions_pending, total: data.agents.total_actions, color: '#3b82f6' },
              { label: 'Échecs', count: data.agents.actions_failed, total: data.agents.total_actions, color: '#ef4444' },
            ].map((s) => (
              <StatusBar key={s.label} {...s} />
            ))}
            {data.agents.actions_pending_approval > 0 && (
              <div style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                fontSize: '0.8rem', color: '#fb923c',
                display: 'flex', gap: 8,
              }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <strong>{data.agents.actions_pending_approval}</strong>&nbsp;action{data.agents.actions_pending_approval > 1 ? 's' : ''} en attente de validation humaine
              </div>
            )}
          </div>

          {/* Scheduler + Notifications */}
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Scheduler health */}
            <div style={{ ...card, padding: '18px 22px' }}>
              <div style={sectionTitle}>
                <Activity size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Scheduler
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: data.scheduler.running ? '#22c55e' : '#64748b',
                      boxShadow: data.scheduler.running ? '0 0 8px #22c55e' : 'none',
                    }} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: data.scheduler.running ? '#22c55e' : '#64748b' }}>
                      {data.scheduler.running ? 'Actif' : 'Inactif'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      · {data.scheduler.jobs_count} jobs
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Dernière exec : {fmtDate(data.scheduler.last_execution)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#facc15', fontFamily: 'monospace' }}>
                    {data.scheduler.executions_today}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>exécutions aujourd'hui</div>
                  {data.scheduler.errors_today > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 2 }}>
                      {data.scheduler.errors_today} erreur{data.scheduler.errors_today > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div style={{ ...card, padding: '18px 22px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={sectionTitle}>Alertes actives</div>
                {data.notifications.length > 0 && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
                  }}>
                    {data.notifications.length}
                  </span>
                )}
              </div>
              {data.notifications.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.84rem', padding: '10px 0' }}>
                  <CheckCircle2 size={24} color="#22c55e" style={{ margin: '0 auto 8px' }} />
                  Aucune alerte
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {data.notifications.slice(0, 4).map((n, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '8px 10px', borderRadius: 8,
                      background: n.priority === 'high' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${n.priority === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.08)'}`,
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                        background: n.priority === 'high' ? '#ef4444' : '#f97316',
                        boxShadow: n.priority === 'high' ? '0 0 6px #ef4444' : 'none',
                      }} />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3 }}>{n.title}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{n.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Activity feed */}
      {data && (
        <ActivityFeed compact days={7} limit={8} />
      )}
    </div>
  );
}
