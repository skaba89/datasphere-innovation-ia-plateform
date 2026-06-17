import React from 'react';
/**
 * AnalyticsPage — Intelligence analytique avancée
 * Recharts · Graphes temporels · Win rate · Pipeline · Heatmap
 */
import { useEffect, useState, useCallback } from 'react';
import EmptyState, { EMPTY_STATES } from '../components/EmptyState';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  // @ts-ignore
  Legend,
} from 'recharts';
// PieChart, RadarChart — remplacés par SVG natif (types instables recharts sur Node 24)

// ── SVG remplacements pour PieChart/RadarChart (types recharts instables Node 24) ──

interface PieSlice { name: string; value: number; color: string; fill?: string; }

function SvgPieChart({ data, width = 200, height = 160, innerRadius = 0, outerRadius = 70 }: {
  data: PieSlice[]; width?: number; height?: number; innerRadius?: number; outerRadius?: number;
}) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (!total) return null;
  const cx = width / 2, cy = height / 2;
  let angle = -Math.PI / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.filter(d => d.value > 0).map((d, i) => {
        const slice = (d.value / total) * Math.PI * 2;
        const x1 = cx + outerRadius * Math.cos(angle);
        const y1 = cy + outerRadius * Math.sin(angle);
        const x2 = cx + outerRadius * Math.cos(angle + slice);
        const y2 = cy + outerRadius * Math.sin(angle + slice);
        const xi1 = cx + innerRadius * Math.cos(angle);
        const yi1 = cy + innerRadius * Math.sin(angle);
        const xi2 = cx + innerRadius * Math.cos(angle + slice);
        const yi2 = cy + innerRadius * Math.sin(angle + slice);
        const large = slice > Math.PI ? 1 : 0;
        const path = innerRadius > 0
          ? `M ${xi1} ${yi1} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${xi1} ${yi1} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${x2} ${y2} Z`;
        angle += slice;
        return <path key={i} d={path} fill={d.color || d.fill || '#64748b'} opacity={0.85} stroke="#060d1a" strokeWidth={1} />;
      })}
    </svg>
  );
}

function SvgRadarChart({ data, width = 260, height = 200 }: {
  data: { subject: string; A: number }[]; width?: number; height?: number;
}) {
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 2 - 24;
  const n = data.length;
  if (!n) return null;
  const maxVal = Math.max(...data.map(d => d.A), 1);
  const pts = data.map((d, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const ratio = d.A / maxVal;
    return { x: cx + r * ratio * Math.cos(a), y: cy + r * ratio * Math.sin(a), lx: cx + (r + 14) * Math.cos(a), ly: cy + (r + 14) * Math.sin(a), label: d.subject };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const gridLevels = [0.25, 0.5, 0.75, 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {gridLevels.map(level => {
        const gpts = data.map((_, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          return `${cx + r * level * Math.cos(a)},${cy + r * level * Math.sin(a)}`;
        }).join(' ');
        return <polygon key={level} points={gpts} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth={1} />;
      })}
      {data.map((_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(148,163,184,.08)" strokeWidth={1} />;
      })}
      <polygon points={polyline} fill={`${C.blue}18`} stroke={C.blue} strokeWidth={1.5} />
      {pts.map((p, i) => (
        <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#475569">{p.label}</text>
      ))}
    </svg>
  );
}

import {
  BarChart2, RefreshCw, TrendingUp, Target, Zap,
  Trophy, Activity, Calendar, ArrowUpRight,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import { useI18n } from '../i18n/index';
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
  const { lang } = useI18n();
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
  const { lang } = useI18n();
  const { t } = useI18n();
  if (!timeline) return <div style={{ color: '#475569', padding: 32, textAlign: 'center' }}>Chargement…</div>;

  const months = timeline.months ?? [];
  const winRateData = months.map((m: any) => ({ month: m.month, taux: m.taux_succes }));

  const pieData = [
    { name: 'AOs détectés', value: timeline.totals?.ao_detectes ?? 0, color: C.blue },
    { name: t('analytics.workflows'),    value: timeline.totals?.wf_completes ?? 0, color: C.purple },
    { name: 'Livrables',   value: timeline.totals?.livrables ?? 0,    color: C.gold },
    { name: t('analytics.won'),      value: timeline.totals?.gagnes ?? 0,       color: C.green },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <StatChip label={lang === "en" ? "Tenders 12 months" : "AOs 12 mois"}  value={timeline.totals?.ao_detectes ?? 0}  color={C.blue} />
        <StatChip label="Workflows"    value={timeline.totals?.wf_completes ?? 0} color={C.purple} />
        <StatChip label="Livrables"    value={timeline.totals?.livrables ?? 0}    color={C.gold} />
        <StatChip label="Gagnés"       value={timeline.totals?.gagnes ?? 0}       color={C.green} />
        <StatChip label="Win rate moy" value={months.length ? `${Math.round(months.reduce((s:number,m:any)=>s+m.taux_succes,0)/Math.max(months.filter((m:any)=>m.ao_detectes>0).length,1))}%` : "0%"} color={C.amber} />
      </div>

      {/* Main timeline */}
      <div style={CHART_BG}>
        <ChartTitle label={lang === "en" ? "Activity 12 months" : "Activité 12 mois"} sub="AOs détectés · Workflows · Livrables · Gagnés" />
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
            <SvgPieChart data={pieData.filter(d=>d.value>0)} width={200} height={160} innerRadius={45} outerRadius={70} />
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
  const { lang } = useI18n();
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
        <StatChip label={lang === "en" ? "Average score" : "Score moyen"}   value={`${(tenders.avg_go_score ?? 0).toFixed(0)}/100`} color={C.gold} />
        <StatChip label="Taux approbation livrables" value={`${(deliverables.approval_rate ?? 0).toFixed(0)}%`} color={C.green} />
        <StatChip label="Pipeline €"    value={new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(opportunities.pipeline_value ?? 0)} color={C.purple} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={CHART_BG}>
          <ChartTitle label={lang === "en" ? "Go/No-Go decisions" : "Décisions Go/No-Go"} />
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <SvgPieChart data={decisionData.map(d => ({ ...d, color: d.fill }))} width={200} height={200} outerRadius={70} />
          </div>
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
            <SvgRadarChart data={radarData} width={200} height={200} />
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
  const { lang } = useI18n();
  const { t } = useI18n();
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
          <ChartTitle label={lang === "en" ? "Go/No-Go score distribution" : "Distribution des scores Go/No-Go"} sub="Nombre d'AOs par tranche de score" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistrib} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="AOs" radius={[4,4,0,0]} opacity={0.85} fill={C.blue} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_BG}>
          <ChartTitle label={lang === "en" ? "Won tenders per month" : "AOs gagnés par mois"} />
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
  const { lang } = useI18n();
  const { t } = useI18n();
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
        <StatChip label={lang === "en" ? "Total actions" : "Actions totales"} value={agents.total_actions ?? 0} color={C.blue} />
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
          <ChartTitle label={lang === "en" ? "AI Agents — action status" : "Agents IA — état des actions"} />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <SvgPieChart data={agentData.filter(d=>d.value>0).map(d => ({ ...d, color: d.fill }))} width={200} height={150} innerRadius={30} outerRadius={55} />
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
  const { t, lang } = useI18n();
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
        {tabBtn('overview',    t('analytics.tab_overview'),   Activity)}
        {tabBtn('pipeline',    t('analytics.tab_pipeline'),       Target)}
        {tabBtn('performance', t('analytics.tab_perf'),    Trophy)}
        {tabBtn('activite',    t('analytics.tab_agents'),   Zap)}
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


// ── ForecastTab — Prévision pipeline 90 jours ─────────────────────────────
function ForecastTab({ token }: { token: string | null }) {
  const { lang } = useI18n();
  const { t } = useI18n();
  const [data, setData]     = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [horizon, setHorizon] = React.useState(90);
  const { apiRequest: _req } = { apiRequest: (path: string, opts: any, tok: any) =>
    fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}${path}`, {
      ...opts, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }
    }).then(r => r.json())
  };

  React.useEffect(() => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/analytics/pipeline-forecast?horizon=${horizon}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [horizon, token]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>{lang === 'en' ? 'Computing forecast…' : 'Calcul prévision…'}</div>;
  if (!data) return null;

  const maxVal = Math.max(...(data.weekly_timeline || []).map((w: any) => w.weighted_value), 1);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        {[
          { label: 'Pipeline total', value: `${(data.total_pipeline / 1000).toFixed(0)}k€`, color: C.blue },
          { label: 'Forecast pondéré', value: `${(data.weighted_forecast / 1000).toFixed(0)}k€`, color: C.green },
          { label: 'Probabilité moy.', value: `${data.avg_probability}%`, color: C.amber },
          { label: 'AOs à traiter', value: data.total_tenders_due, color: C.purple },
          { label: 'Opportunités', value: data.total_opportunities, color: C.gold },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...CHART_BG, padding: '14px 18px' }}>
            <div style={{ fontSize: '.72rem', color: '#475569', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Horizon selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[30, 60, 90].map(h => (
          <button key={h} onClick={() => setHorizon(h)} style={{
            padding: '6px 14px', borderRadius: 8, border: `1px solid ${horizon===h ? C.gold + '50' : 'rgba(148,163,184,.12)'}`,
            background: horizon===h ? C.gold + '12' : 'none', color: horizon===h ? C.gold : '#64748b',
            cursor: 'pointer', fontWeight: horizon===h ? 800 : 500, fontSize: '.8rem',
          }}>{h}j</button>
        ))}
      </div>

      {/* Timeline bar chart */}
      <div style={CHART_BG}>
        <ChartTitle label={`Prévision revenu pondéré — ${horizon} jours`} />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.weekly_timeline || []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#475569' }} label={{ value: 'Semaine', position: 'insideBottom', fontSize: 9, fill: '#334155' }} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k€`} />
            <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString('fr-FR')}€`, 'Forecast pondéré']}
                     contentStyle={{ background: '#0a1226', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, fontSize: '.78rem' }} />
            <Bar dataKey="weighted_value" fill={C.green} radius={[4,4,0,0]} opacity={0.85} name="Forecast" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Répartition statuts */}
      {data.status_breakdown && Object.keys(data.status_breakdown).length > 0 && (
        <div style={CHART_BG}>
          <ChartTitle label={lang === "en" ? "Pipeline breakdown by status" : "Répartition pipeline par statut"} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            {Object.entries(data.status_breakdown as Record<string, {count:number;value:number}>).map(([status, info]) => {
              const totalVal = Object.values(data.status_breakdown as Record<string, {value:number}>).reduce((s, v) => s + v.value, 0);
              const pct = totalVal > 0 ? Math.round(info.value / totalVal * 100) : 0;
              const colors: Record<string, string> = {
                'Prospect identifie': C.blue, 'Proposition envoyée': C.amber,
                'Négociation': C.purple, 'Gagné': C.green, 'Perdu': '#ef4444',
              };
              const color = colors[status] || '#64748b';
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 100, fontSize: '.72rem', color: '#94a3b8', flexShrink: 0 }}>{status}</div>
                  <div style={{ flex: 1, height: 8, background: 'rgba(148,163,184,.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .6s ease' }} />
                  </div>
                  <div style={{ fontSize: '.72rem', color, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{pct}%</div>
                  <div style={{ fontSize: '.7rem', color: '#475569', minWidth: 80, textAlign: 'right' }}>
                    {info.value >= 1000 ? `${(info.value/1000).toFixed(0)}k€` : `${info.value}€`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AOs imminents */}
      {(data.weekly_timeline || []).slice(0,2).map((week: any) =>
        week.tender_titles?.length > 0 && (
          <div key={week.week} style={{ ...CHART_BG, padding: '12px 16px' }}>
            <div style={{ fontSize: '.72rem', color: '#64748b', marginBottom: 6 }}>
              Semaine {week.week} — {week.tenders_deadline} AO(s) à deadline
            </div>
            {week.tender_titles.map((t: string, i: number) => (
              <div key={i} style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 3 }}>• {t}</div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
