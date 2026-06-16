/**
 * AnalyticsPage — Intelligence analytique avancée
 * Recharts · Graphes temporels · Win rate · Pipeline · Heatmap
 */
import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  BarChart2, RefreshCw, TrendingUp, Target, Zap,
  Trophy, Activity, Calendar, ArrowUpRight,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { PipelineAnalytics } from '../api/domainTypes';

type Tab = 'overview' | 'pipeline' | 'performance' | 'activite';

const C = {
  gold:   '#facc15',
  blue:   '#3b82f6',
  green:  '#22c55e',
  purple: '#8b5cf6',
  red:    '#ef4444',
  amber:  '#f59e0b',
  cyan:   '#06b6d4',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0c1425', border: '1px solid rgba(148,163,184,.15)',
    borderRadius: 10, fontSize: '.78rem', color: '#f1f5f9',
    boxShadow: '0 8px 32px rgba(0,0,0,.5)',
  },
  labelStyle: { color: '#94a3b8', fontWeight: 700 },
};

const CHART_BG: React.CSSProperties = {
  background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)',
  borderRadius: 16, padding: '16px clamp(12px,2vw,22px)',
  backdropFilter: 'blur(24px)', overflowX: 'hidden', minWidth: 0,
};

function ChartTitle({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#e2e8f0' }}>{label}</div>
      {sub && <div style={{ fontSize: '.71rem', color: '#475569', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatChip({ label, value, color = C.gold, delta }: { label: string; value: string | number; color?: string; delta?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(148,163,184,.07)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-.05em', color: '#f1f5f9' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.73rem', color: '#475569' }}>{label}</span>
        {delta && (
          <span style={{ fontSize: '.68rem', fontWeight: 700, color: C.green, display: 'flex', alignItems: 'center', gap: 2 }}>
            <ArrowUpRight size={9} />{delta}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 10, padding: '10px 14px', fontSize: '.78rem' }}>
      <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────
function OverviewTab({ timeline, pipeline }: { timeline: any; pipeline: PipelineAnalytics | null }) {
  if (!timeline) return <div style={{ color: '#475569', padding: 32, textAlign: 'center' }}>Chargement…</div>;

  const months = timeline.months ?? [];
  const winRateData = months.map((m: any) => ({ month: m.month, taux: m.taux_succes }));

  const pieData = [
    { name: 'AOs détectés', value: timeline.totals?.ao_detectes ?? 0, color: C.blue },
    { name: 'Workflows',    value: timeline.totals?.wf_completes ?? 0, color: C.purple },
    { name: 'Livrables',   value: timeline.totals?.livrables ?? 0,    color: C.gold },
    { name: 'Gagnés',      value: timeline.totals?.gagnes ?? 0,       color: C.green },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <StatChip label="AOs 12 mois"  value={timeline.totals?.ao_detectes ?? 0}  color={C.blue} />
        <StatChip label="Workflows"    value={timeline.totals?.wf_completes ?? 0} color={C.purple} />
        <StatChip label="Livrables"    value={timeline.totals?.livrables ?? 0}    color={C.gold} />
        <StatChip label="Gagnés"       value={timeline.totals?.gagnes ?? 0}       color={C.green} />
        <StatChip label="Win rate moy" value={months.length ? `${Math.round(months.reduce((s:number,m:any)=>s+m.taux_succes,0)/Math.max(months.filter((m:any)=>m.ao_detectes>0).length,1))}%` : "0%"} color={C.amber} />
      </div>

      {/* Main timeline */}
      <div style={CHART_BG}>
        <ChartTitle label="Activité 12 mois" sub="AOs détectés · Workflows · Livrables · Gagnés" />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={months} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              {[['aoGrad',C.blue],['wfGrad',C.purple],['lvGrad',C.gold],['gnGrad',C.green]].map(([id,c])=>(
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={c} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '.72rem', paddingTop: 12 }} />
            <Area type="monotone" dataKey="ao_detectes"  name="AOs"        stroke={C.blue}   fill="url(#aoGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="wf_completes" name="Workflows"  stroke={C.purple} fill="url(#wfGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="livrables"    name="Livrables"  stroke={C.gold}   fill="url(#lvGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="gagnes"       name="Gagnés"     stroke={C.green}  fill="url(#gnGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Win rate + Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
        <div style={CHART_BG}>
          <ChartTitle label="Évolution taux de succès" sub="% AOs gagnés vs détectés par mois" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={winRateData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} unit="%" domain={[0,100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="taux" name="Win rate" stroke={C.amber} strokeWidth={2.5} dot={{ r: 3, fill: C.amber }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...CHART_BG, display: 'flex', flexDirection: 'column' }}>
          <ChartTitle label="Répartition activité" />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart width={200} height={160}>
              <Pie data={pieData.filter(d=>d.value>0)} cx={100} cy={80} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.85} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 4, marginTop: 4 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.68rem', color: '#64748b' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <span>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Pipeline ─────────────────────────────────────────────────────────────
function PipelineTab({ pipeline }: { pipeline: PipelineAnalytics | null }) {
  if (!pipeline) return null;
  const { tenders, opportunities, deliverables } = pipeline;

  const tenderStatusData = Object.entries(tenders.by_status ?? {}).map(([k, v]) => ({ name: k, value: v as number }));
  const delivStatusData  = Object.entries(deliverables.by_status ?? {}).map(([k, v]) => ({ name: k, value: v as number }));
  const decisionData = [
    { name: 'Go',    value: tenders.go_count ?? 0,    fill: C.green },
    { name: 'No-Go', value: tenders.no_go_count ?? 0, fill: C.red },
    { name: 'À décider', value: (tenders.total ?? 0) - (tenders.go_count ?? 0) - (tenders.no_go_count ?? 0), fill: C.amber },
  ].filter(d => d.value > 0);

  const opportunityData = Object.entries(opportunities.by_status ?? {}).map(([k, v]) => ({ name: k.replace(/_/g,' '), value: v as number }));

  const radarData = [
    { subject: 'AOs total',      A: tenders.total ?? 0 },
    { subject: 'Go décidés',     A: tenders.go_count ?? 0 },
    { subject: 'Score moyen',    A: Math.round(tenders.avg_go_score ?? 0) },
    { subject: 'Livrables',      A: deliverables.total ?? 0 },
    { subject: 'Approuvés',      A: deliverables.approved ?? 0 },
    { subject: 'Opportunités',   A: opportunities.total ?? 0 },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <StatChip label="Total AOs"     value={tenders.total ?? 0}        color={C.blue} />
        <StatChip label="Score moyen"   value={`${(tenders.avg_go_score ?? 0).toFixed(0)}/100`} color={C.gold} />
        <StatChip label="Taux approbation livrables" value={`${(deliverables.approval_rate ?? 0).toFixed(0)}%`} color={C.green} />
        <StatChip label="Pipeline €"    value={new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(opportunities.pipeline_value ?? 0)} color={C.purple} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={CHART_BG}>
          <ChartTitle label="Décisions Go/No-Go" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={decisionData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`} labelLine={false}>
                {decisionData.map((d, i) => <Cell key={i} fill={d.fill} opacity={0.85} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_BG}>
          <ChartTitle label="Statuts livrables" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={delivStatusData} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Livrables" fill={C.gold} radius={[0,4,4,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_BG}>
          <ChartTitle label="Radar performance" />
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <PolarGrid stroke="rgba(148,163,184,.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#475569' }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar name="Métriques" dataKey="A" stroke={C.blue} fill={C.blue} fillOpacity={0.15} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {opportunityData.length > 0 && (
        <div style={CHART_BG}>
          <ChartTitle label="Opportunités CRM par statut" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={opportunityData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Opportunités" fill={C.purple} radius={[4,4,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Tab: Performance ──────────────────────────────────────────────────────────
function PerformanceTab({ perf }: { perf: any }) {
  if (!perf) return <div style={{ color: '#475569', padding: 32 }}>Données indisponibles.</div>;

  const scoreDistrib = [
    { range: '0-20', count: perf.score_0_20 ?? 0 },
    { range: '21-40', count: perf.score_21_40 ?? 0 },
    { range: '41-60', count: perf.score_41_60 ?? 0 },
    { range: '61-80', count: perf.score_61_80 ?? 0 },
    { range: '81-100', count: perf.score_81_100 ?? 0 },
  ];

  const winByMonth = perf.win_by_month ?? [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <StatChip label="Score moyen Go" value={`${(perf.avg_go_score ?? 0).toFixed(0)}/100`} color={C.gold} />
        <StatChip label="Top score" value={`${perf.max_score ?? 0}/100`} color={C.green} />
        <StatChip label="Taux soumission" value={`${perf.submission_rate ?? 0}%`} color={C.blue} />
        <StatChip label="Délai moyen réponse" value={`${perf.avg_response_days ?? 0}j`} color={C.purple} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
        <div style={CHART_BG}>
          <ChartTitle label="Distribution des scores Go/No-Go" sub="Nombre d'AOs par tranche de score" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistrib} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="AOs" radius={[4,4,0,0]} opacity={0.85}>
                {scoreDistrib.map((entry, i) => (
                  <Cell key={i} fill={i >= 3 ? C.green : i >= 2 ? C.amber : C.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_BG}>
          <ChartTitle label="AOs gagnés par mois" />
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={winByMonth} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="winGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="gagnes" name="Gagnés" stroke={C.green} fill="url(#winGrad)" strokeWidth={2} dot={{ r: 3, fill: C.green }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Activité ─────────────────────────────────────────────────────────────
function ActiviteTab({ timeline, pipeline }: { timeline: any; pipeline: PipelineAnalytics | null }) {
  if (!timeline || !pipeline) return null;

  const months = timeline.months ?? [];
  const { agents, scheduler } = pipeline;

  const agentData = [
    { name: 'Terminées',  value: agents.actions_done ?? 0, fill: C.green },
    { name: 'En attente', value: agents.actions_pending ?? 0, fill: C.amber },
    { name: 'Échouées',   value: agents.actions_failed ?? 0, fill: C.red },
  ];

  const completionRate = agents.completion_rate ?? 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <StatChip label="Actions totales" value={agents.total_actions ?? 0} color={C.blue} />
        <StatChip label="Taux complétion" value={`${completionRate.toFixed(0)}%`} color={C.green} />
        <StatChip label="En attente approbation" value={agents.actions_pending_approval ?? 0} color={C.amber} />
        <StatChip label="Scheduler jobs" value={scheduler.jobs_count ?? 0} color={C.cyan} />
        <StatChip label="Exécutions aujourd'hui" value={scheduler.executions_today ?? 0} color={C.purple} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) clamp(240px, 28vw, 300px)', gap: 16 }}>
        <div style={CHART_BG}>
          <ChartTitle label="Flux mensuel d'activité" sub="Évolution croisée des métriques" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={months} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '.72rem' }} />
              <Bar dataKey="ao_detectes"  name="AOs"       fill={C.blue}   radius={[3,3,0,0]} opacity={0.8} />
              <Bar dataKey="wf_completes" name="Workflows" fill={C.purple} radius={[3,3,0,0]} opacity={0.8} />
              <Bar dataKey="livrables"    name="Livrables" fill={C.gold}   radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_BG}>
          <ChartTitle label="Agents IA — état des actions" />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <PieChart width={200} height={150}>
              <Pie data={agentData.filter(d=>d.value>0)} cx={100} cy={75} outerRadius={55} innerRadius={30} paddingAngle={3} dataKey="value">
                {agentData.map((d, i) => <Cell key={i} fill={d.fill} opacity={0.85} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </div>
          {agentData.map(d => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(148,163,184,.04)', fontSize: '.76rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.fill }} />
                <span style={{ color: '#64748b' }}>{d.name}</span>
              </div>
              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{d.value}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: `${C.green}08`, border: `1px solid ${C.green}20`, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: C.green }}>{completionRate.toFixed(0)}%</div>
            <div style={{ fontSize: '.69rem', color: '#64748b' }}>taux de complétion</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const token = tokenStorage.get();
  const [tab, setTab]           = useState<Tab>('overview');
  const [timeline, setTimeline] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineAnalytics | null>(null);
  const [perf, setPerf]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [tl, pl, pf] = await Promise.all([
        apiRequest<any>('/analytics/timeline', {}, token),
        apiRequest<PipelineAnalytics>('/analytics/pipeline', {}, token),
        apiRequest<any>('/analytics/performance-v2', {}, token).catch(() => null),
      ]);
      setTimeline(tl); setPipeline(pl); setPerf(pf);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const tabBtn = (t: Tab, label: string, Icon: React.ElementType) => (
    <button onClick={() => setTab(t)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
      borderRadius: 9, border: `1px solid ${tab===t?'rgba(250,204,21,.25)':'rgba(148,163,184,.1)'}`,
      background: tab===t?'rgba(250,204,21,.07)':'none',
      color: tab===t?'#facc15':'#64748b', cursor: 'pointer',
      fontSize: '.82rem', fontWeight: tab===t?700:500, transition: 'all .15s',
    }}>
      <Icon size={13}/> {label}
    </button>
  );

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px)', maxWidth: 1200, display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>Intelligence</div>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, letterSpacing: '-.04em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={24} color="#facc15"/> Analytics avancées
          </h1>
          <p style={{ color: '#64748b', fontSize: '.84rem', margin: '6px 0 0' }}>Graphes temporels · Pipeline · Performance · Agents</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem' }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'analytSpin .7s linear infinite' : 'none' }}/>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabBtn('overview',    'Vue 12 mois',   Activity)}
        {tabBtn('pipeline',    'Pipeline',       Target)}
        {tabBtn('performance', 'Performance',    Trophy)}
        {tabBtn('activite',    'Agents & Ops',   Zap)}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[...Array(3)].map((_,i) => (
            <div key={i} style={{ height: 220, borderRadius: 16, background: 'linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%', animation: 'analytShimmer 1.4s ease-in-out infinite' }}/>
          ))}
        </div>
      ) : (
        <>
          {tab === 'overview'    && <OverviewTab timeline={timeline} pipeline={pipeline} />}
          {tab === 'pipeline'    && <PipelineTab pipeline={pipeline} />}
          {tab === 'performance' && <PerformanceTab perf={perf} />}
          {tab === 'activite'    && <ActiviteTab timeline={timeline} pipeline={pipeline} />}
        </>
      )}

      <style>{`
        @keyframes analytSpin    { to { transform: rotate(360deg); } }
        @keyframes analytShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>
    </div>
  );
}
