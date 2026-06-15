/**
 * IntelligencePage — Tableau de bord Intelligence d'Affaires
 *
 * Ce que les grands cabinets font avec 10 analystes,
 * DataSphere le fait en temps réel avec l'IA.
 *
 * Sections :
 *   - Score santé pipeline (0-100)
 *   - Prévision revenus 6 mois
 *   - Funnel de conversion
 *   - Top 3 recommandations IA
 *   - Génération proposition commerciale
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BarChart3, Brain, CheckCircle,
  ChevronRight, Download, Loader2, RefreshCw, Target, TrendingUp, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import GoNoGoRadarChart from '../components/GoNoGoRadarChart';
import GanttChart from '../components/GanttChart';

interface ForecastMonth { month: string; pessimistic: number; base: number; optimistic: number }
interface IntelligenceData {
  forecast: {
    confirmed_revenue_eur: number;
    weighted_pipeline_eur: number;
    total_pipeline_eur: number;
    win_rate_pct: number;
    monthly_forecast: ForecastMonth[];
    active_opportunities: number;
  };
  pipeline: {
    score: number; status: string; advice: string;
    tenders_total: number; tenders_go: number; opps_active: number;
  };
  win_rate: {
    total: number; won: number; lost: number; in_progress: number;
    win_rate_overall: number; win_rate_decided: number;
    conversion_funnel: Array<{stage: string; count: number; rate: number | null}>;
  };
}

interface Recommendation {
  priority: number; action: string; rationale: string; impact: string; timeline: string;
}

function kFormat(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n/1_000).toFixed(0)}k€`;
  return `${n}€`;
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#facc15' : score >= 40 ? '#f97316' : '#ef4444';
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(148,163,184,.1)" strokeWidth="12" />
        <circle cx="60" cy="60" r="50" fill="none" stroke={color}
          strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${pct * 3.14} 314`}
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{score}</span>
        <span style={{ fontSize: '.62rem', color: '#64748b', fontWeight: 700 }}>/100</span>
      </div>
    </div>
  );
}

function ForecastBar({ month, pessimistic, base, optimistic, max }: ForecastMonth & { max: number }) {
  const pctBase = (base / max) * 100;
  const pctOpt  = (optimistic / max) * 100;
  const pctPess = (pessimistic / max) * 100;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: '100%', height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
        <div style={{ width: '60%', height: `${pctOpt}%`, background: 'rgba(250,204,21,.15)', border: '1px solid rgba(250,204,21,.2)', borderRadius: '3px 3px 0 0' }} title={`Optimiste: ${kFormat(optimistic)}`} />
        <div style={{ position: 'absolute', bottom: 0, left: '20%', width: '60%', height: `${pctBase}%`, background: 'rgba(250,204,21,.5)', borderRadius: '3px 3px 0 0' }} title={`Base: ${kFormat(base)}`} />
        <div style={{ position: 'absolute', bottom: 0, left: '20%', width: '60%', height: `${pctPess}%`, background: '#facc15', borderRadius: '3px 3px 0 0' }} title={`Pessimiste: ${kFormat(pessimistic)}`} />
      </div>
      <span style={{ fontSize: '.63rem', color: '#64748b', fontWeight: 700 }}>{month}</span>
      <span style={{ fontSize: '.65rem', color: '#facc15' }}>{kFormat(base)}</span>
    </div>
  );
}

export default function IntelligencePage() {
  const token = tokenStorage.get();
  const [data,    setData]    = useState<IntelligenceData | null>(null);
  const [recs,    setRecs]    = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tenderId,   setTenderId]   = useState('');
  const [proposalResult, setProposalResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await apiRequest<IntelligenceData>('/intelligence/dashboard', {}, token);
      setData(d);
    } catch { setData(null); }
    finally { setLoading(false); }
  }

  async function loadRecs() {
    setLoadingRecs(true);
    try {
      const r = await apiRequest<Recommendation[]>('/intelligence/recommendations', {}, token);
      setRecs(Array.isArray(r) ? r : []);
    } finally { setLoadingRecs(false); }
  }

  async function generateProposal() {
    const id = parseInt(tenderId);
    if (!id) return;
    setGenerating(true); setProposalResult(null);
    try {
      const r = await apiRequest<{markdown?: string; proposal?: object; tender_title?: string}>(
        `/proposals/generate/${id}/export/md`, { method: 'POST' }, token
      );
      setProposalResult(r?.markdown || JSON.stringify(r?.proposal, null, 2));
    } catch { setProposalResult('Erreur lors de la génération. Vérifiez que l\'AO existe et que le LLM est configuré.'); }
    finally { setGenerating(false); }
  }

  useEffect(() => { load(); loadRecs(); }, [token]);

  if (loading) return (
    <main className="app-shell">
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Loader2 size={24} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
        <p style={{ color: '#64748b', fontSize: '.82rem' }}>Analyse du pipeline en cours…</p>
      </div>
    </main>
  );

  const f = data?.forecast;
  const p = data?.pipeline;
  const wr = data?.win_rate;
  const maxForecast = Math.max(...(f?.monthly_forecast.map(m => m.optimistic) ?? [1]));

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Brain size={12} /> INTELLIGENCE D'AFFAIRES
            </p>
            <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Tableau de bord IA</h1>
            <p style={{ margin: '3px 0 0', fontSize: '.76rem', color: '#64748b' }}>
              Ce que McKinsey fait avec 10 analystes — DataSphere le fait en temps réel
            </p>
          </div>
          <button onClick={() => { load(); loadRecs(); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem' }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
      </section>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { label: 'Revenue confirmé', value: kFormat(f?.confirmed_revenue_eur ?? 0), icon: <CheckCircle size={16} color="#22c55e" />, color: '#22c55e' },
          { label: 'Pipeline pondéré', value: kFormat(f?.weighted_pipeline_eur ?? 0), icon: <BarChart3 size={16} color="#3b82f6" />, color: '#3b82f6' },
          { label: 'Taux de win',      value: `${f?.win_rate_pct ?? 0}%`,             icon: <Target size={16} color="#facc15" />, color: '#facc15' },
          { label: 'Opps actives',     value: String(f?.active_opportunities ?? 0),   icon: <TrendingUp size={16} color="#8b5cf6" />, color: '#8b5cf6' },
          { label: 'AOs en GO',        value: String(p?.tenders_go ?? 0),              icon: <Zap size={16} color="#f97316" />, color: '#f97316' },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', borderRadius: 10, background: `${k.color}06`, border: `1px solid ${k.color}18` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {k.icon}
              <span style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 700 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Pipeline health */}
        <section className="panel">
          <h3 style={{ margin: '0 0 14px', fontSize: '.85rem', fontWeight: 800, color: '#94a3b8' }}>
            SANTÉ DU PIPELINE
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {p && <HealthGauge score={p.score} />}
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                {p?.status}
              </div>
              <p style={{ margin: 0, fontSize: '.76rem', color: '#64748b', lineHeight: 1.5, maxWidth: 240 }}>
                {p?.advice}
              </p>
            </div>
          </div>
        </section>

        {/* Win rate funnel */}
        <section className="panel">
          <h3 style={{ margin: '0 0 14px', fontSize: '.85rem', fontWeight: 800, color: '#94a3b8' }}>
            FUNNEL DE CONVERSION
          </h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {wr?.conversion_funnel.map((stage, i) => (
              <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '.72rem', color: '#64748b', width: 100, flexShrink: 0 }}>{stage.stage}</span>
                <div style={{ flex: 1, height: 8, background: 'rgba(148,163,184,.1)', borderRadius: 99 }}>
                  <div style={{ height: '100%', borderRadius: 99, background: ['#3b82f6','#facc15','#8b5cf6','#22c55e'][i], width: `${Math.min(100, (stage.count / Math.max(wr.total, 1)) * 100)}%` }} />
                </div>
                <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#94a3b8', width: 30, textAlign: 'right' }}>{stage.count}</span>
                {stage.rate !== null && <span style={{ fontSize: '.65rem', color: '#475569' }}>{stage.rate}%</span>}
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid rgba(148,163,184,.08)', fontSize: '.76rem', color: '#64748b' }}>
              Taux de win global : <strong style={{ color: '#22c55e' }}>{wr?.win_rate_decided}%</strong> (sur {(wr?.won ?? 0) + (wr?.lost ?? 0)} décisions)
            </div>
          </div>
        </section>
      </div>

      {/* Revenue forecast */}
      <section className="panel">
        <h3 style={{ margin: '0 0 14px', fontSize: '.85rem', fontWeight: 800, color: '#94a3b8' }}>
          PRÉVISION REVENUS — 6 MOIS
        </h3>
        <div style={{ display: 'flex', gap: 8, height: 120, alignItems: 'flex-end' }}>
          {f?.monthly_forecast.map(m => (
            <ForecastBar key={m.month} {...m} max={maxForecast} />
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: '.7rem', color: '#475569' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#facc15', borderRadius: 2 }} /> Base</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(250,204,21,.4)', borderRadius: 2 }} /> Optimiste</span>
          <span style={{ marginLeft: 'auto', color: '#64748b' }}>Pipeline total : <strong style={{ color: '#facc15' }}>{kFormat(f?.total_pipeline_eur ?? 0)}</strong></span>
        </div>
      </section>

      {/* Strategic recommendations */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '.85rem', fontWeight: 800, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Brain size={14} /> TOP 3 RECOMMANDATIONS STRATÉGIQUES IA
          </h3>
          <button onClick={loadRecs} disabled={loadingRecs} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.72rem' }}>
            {loadingRecs ? <Loader2 size={11} style={{ animation: 'spin .7s linear infinite' }} /> : <RefreshCw size={11} />}
            Régénérer
          </button>
        </div>
        {recs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: '.78rem' }}>
            <Brain size={20} color="#334155" style={{ margin: '0 auto 8px', display: 'block' }} />
            {loadingRecs ? 'Analyse en cours avec l\'IA…' : 'Cliquez sur Régénérer pour obtenir des recommandations'}
          </div>
        ) : recs.map(r => (
          <div key={r.priority} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,.05)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: ['rgba(239,68,68,.08)','rgba(250,204,21,.08)','rgba(59,130,246,.08)'][r.priority-1], border: `1px solid ${['rgba(239,68,68,.2)','rgba(250,204,21,.2)','rgba(59,130,246,.2)'][r.priority-1]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '.8rem', color: ['#ef4444','#facc15','#3b82f6'][r.priority-1], flexShrink: 0 }}>
              {r.priority}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '.82rem', color: '#f1f5f9', marginBottom: 3 }}>{r.action}</div>
              <div style={{ fontSize: '.74rem', color: '#64748b', marginBottom: 4 }}>{r.rationale}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.65rem', padding: '1px 7px', borderRadius: 4, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.15)', color: '#22c55e' }}>📈 {r.impact}</span>
                <span style={{ fontSize: '.65rem', padding: '1px 7px', borderRadius: 4, background: 'rgba(148,163,184,.05)', border: '1px solid rgba(148,163,184,.1)', color: '#64748b' }}>⏱️ {r.timeline}</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Proposal generator */}
      <section className="panel">
        <h3 style={{ margin: '0 0 10px', fontSize: '.85rem', fontWeight: 800, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} color="#facc15" /> GÉNÉRATION PROPOSITION COMMERCIALE EN 1 CLIC
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: '.78rem', color: '#64748b' }}>
          Génère une proposition de 15 pages adaptée à l'AO — ce que les grands cabinets font en 2 semaines, en 60 secondes.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="number"
            value={tenderId}
            onChange={e => setTenderId(e.target.value)}
            placeholder="ID de l'AO (ex: 1, 2, 3...)"
            style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.2)', background: 'rgba(15,23,42,.6)', color: '#e2e8f0', fontSize: '.82rem', outline: 'none' }}
          />
          <button onClick={generateProposal} disabled={generating || !tenderId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.08)', color: '#facc15', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem' }}>
            {generating ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> : <Zap size={14} />}
            {generating ? 'Génération…' : 'Générer la proposition'}
          </button>
        </div>
        {proposalResult && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={14} color="#22c55e" />
              <span style={{ fontSize: '.78rem', color: '#22c55e', fontWeight: 700 }}>Proposition générée</span>
              <button
                onClick={() => navigator.clipboard?.writeText(proposalResult)}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.72rem' }}>
                <Download size={11} /> Copier
              </button>
            </div>
            <pre style={{ margin: 0, padding: '12px 14px', borderRadius: 8, background: 'rgba(15,23,42,.8)', border: '1px solid rgba(148,163,184,.08)', fontSize: '.72rem', color: '#94a3b8', overflowX: 'auto', maxHeight: 400, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {proposalResult.slice(0, 3000)}{proposalResult.length > 3000 ? '\n\n[... truncated - copy for full content]' : ''}
            </pre>
          </div>
        )}
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Go/No-Go Radar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Radar Go/No-Go</span>
          </div>
          <GoNoGoRadarChart />
        </section>
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Planning Gantt</span>
          </div>
          <GanttChart />
        </section>
      </div>
    </main>
  );
}
