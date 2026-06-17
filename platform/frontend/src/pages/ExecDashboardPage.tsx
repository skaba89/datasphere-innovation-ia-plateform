/**
 * ExecDashboardPage — Dashboard Direction / KPI Exécutif
 *
 * Vue épurée pour DSI/DG/Direction sans détail technique.
 * Imprimable, partageable, actualisée en temps réel.
 * 6 KPIs + 3 graphiques simples + top AOs en cours.
 */
import { useEffect, useState } from 'react';
import { TrendingUp, Target, FileText, DollarSign, Award, Clock, RefreshCw, Printer } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import { useI18n } from '../i18n';
import EmptyState from '../components/EmptyState';

type ExecData = {
  pipeline_value: number;
  weighted_forecast: number;
  win_rate: number;
  avg_score: number;
  tenders_active: number;
  deliverables_approved: number;
  opportunities_total: number;
  tenders_deadline_week: number;
  top_tenders: Array<{ id: number; title: string; score: number; deadline: string; buyer: string }>;
  monthly_trend: Array<{ month: string; tenders: number; won: number }>;
};

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(10,18,38,.9)', border: `1px solid ${color}20`,
      borderRadius: 14, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
        <div style={{ color, opacity: .7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '.72rem', color: '#475569' }}>{sub}</div>}
    </div>
  );
}

export default function ExecDashboardPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [data, setData] = useState<ExecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  async function load() {
    setLoading(true);
    try {
      // Agréger depuis plusieurs endpoints
      const [pipeline, forecast, kpi] = await Promise.allSettled([
        apiRequest<any>('/analytics/pipeline', {}, token),
        apiRequest<any>('/analytics/pipeline-forecast?horizon=90', {}, token),
        apiRequest<any>('/analytics/timeline?months=3', {}, token),
      ]);

      const p = pipeline.status === 'fulfilled' ? pipeline.value : {};
      const f = forecast.status === 'fulfilled' ? forecast.value : {};
      const k = kpi.status === 'fulfilled' ? kpi.value : {};

      const tenders_this_week = (f.weekly_timeline?.[0]?.tenders_deadline || 0);
      const monthly = (k.months || []).slice(-3).map((m: any) => ({
        month: m.month || '',
        tenders: m.ao_detectes || 0,
        won: m.ao_gagnes || 0,
      }));

      setData({
        pipeline_value:        f.total_pipeline        || p.total_value      || 0,
        weighted_forecast:     f.weighted_forecast      || 0,
        win_rate:              k.totals?.taux_succes   || p.win_rate         || 0,
        avg_score:             p.avg_go_score           || p.avg_score        || 0,
        tenders_active:        p.tenders_count          || p.total_tenders    || 0,
        deliverables_approved: p.deliverables_approved  || 0,
        opportunities_total:   f.total_opportunities    || p.opportunities    || 0,
        tenders_deadline_week: tenders_this_week,
        top_tenders:           (p.top_tenders || []).slice(0, 5),
        monthly_trend:         monthly,
      });
      setLastUpdate(new Date());
    } catch (e) {
      // fallback vide
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M€`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k€`
    : `${n}€`;

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(12px,3vw,32px)', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 6 }}>
            Vue direction
          </div>
          <h1 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, margin: 0, letterSpacing: '-.04em' }}>
            Dashboard exécutif
          </h1>
          <p style={{ color: '#475569', fontSize: '.82rem', margin: '4px 0 0' }}>
            Mis à jour le {lastUpdate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 9, border: '1px solid rgba(148,163,184,.15)',
            background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem',
          }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin .7s linear infinite' : 'none' }} />
            Actualiser
          </button>
          <button onClick={() => window.print()} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 9, border: 'none',
            background: 'rgba(250,204,21,.1)', color: '#facc15', cursor: 'pointer', fontSize: '.8rem',
          }}>
            <Printer size={13} /> Imprimer
          </button>
        </div>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>{lang === 'en' ? 'Loading indicators…' : 'Chargement des indicateurs…'}</div>
      )}

      {!loading && !data && (
        <EmptyState
          icon="📊"
          title={lang === "en" ? "Insufficient data" : "Données insuffisantes"}
          description="Importez des AOs et créez des livrables pour alimenter ce tableau de bord."
          size="lg"
        />
      )}

      {data && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label={lang === "en" ? "90-day pipeline" : "Pipeline 90j"} value={fmt(data.pipeline_value)} sub={`Forecast pondéré : ${fmt(data.weighted_forecast)}`} color="#3b82f6" icon={<DollarSign size={18} />} />
            <KpiCard label={lang === "en" ? "Win rate" : "Win rate"} value={`${data.win_rate}%`} sub="Taux de succès AOs" color="#22c55e" icon={<Award size={18} />} />
            <KpiCard label={lang === "en" ? "Go/No-Go score" : "Score Go/No-Go"} value={`${data.avg_score}/100`} sub="Moyenne IA" color="#facc15" icon={<Target size={18} />} />
            <KpiCard label={lang === "en" ? "Active tenders" : "AOs actifs"} value={data.tenders_active} sub={data.tenders_deadline_week > 0 ? `⚠️ ${data.tenders_deadline_week} deadline cette semaine` : 'Aucune deadline urgente'} color={data.tenders_deadline_week > 0 ? '#ef4444' : '#8b5cf6'} icon={<Clock size={18} />} />
            <KpiCard label={lang === "en" ? "Approved deliverables" : "Livrables approuvés"} value={data.deliverables_approved} sub="Bibliothèque de référence" color="#06b6d4" icon={<FileText size={18} />} />
            <KpiCard label={lang === "en" ? "CRM opportunities" : "Opportunités CRM"} value={data.opportunities_total} sub="Pipeline commercial" color="#f59e0b" icon={<TrendingUp size={18} />} />
          </div>

          {/* Top AOs */}
          {(data?.top_tenders ?? []).length > 0 && (
            <div style={{ background: 'rgba(10,18,38,.9)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '18px 22px', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '.84rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                AOs prioritaires en cours
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(data?.top_tenders ?? []).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', borderBottom: i < (data?.top_tenders ?? []).length - 1 ? '1px solid rgba(148,163,184,.05)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: (t.score || 0) >= 70 ? 'rgba(34,197,94,.1)' : (t.score || 0) >= 45 ? 'rgba(245,158,11,.1)' : 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.78rem', fontWeight: 900, color: (t.score || 0) >= 70 ? '#22c55e' : (t.score || 0) >= 45 ? '#f59e0b' : '#ef4444', flexShrink: 0 }}>
                      {t.score || '–'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.84rem', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 1 }}>{t.buyer}</div>
                    </div>
                    {t.deadline && <div style={{ fontSize: '.72rem', color: '#f59e0b', flexShrink: 0 }}>📅 {new Date(t.deadline).toLocaleDateString('fr-FR')}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tendance mensuelle */}
          {(data?.monthly_trend ?? []).length > 0 && (
            <div style={{ background: 'rgba(10,18,38,.9)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '18px 22px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '.84rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Tendance — 3 derniers mois
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(data?.monthly_trend ?? []).length}, 1fr)`, gap: 12 }}>
                {(data?.monthly_trend ?? []).map((m, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(255,255,255,.02)', borderRadius: 10 }}>
                    <div style={{ fontSize: '.7rem', color: '#475569', marginBottom: 8 }}>{m.month}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{m.tenders}</div>
                    <div style={{ fontSize: '.68rem', color: '#475569' }}>{lang === 'en' ? 'Processed tenders' : 'AOs traités'}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#22c55e', marginTop: 6 }}>{m.won}</div>
                    <div style={{ fontSize: '.68rem', color: '#475569' }}>{lang === 'en' ? 'won' : 'gagnés'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body { background: white !important; color: black !important; }
          button { display: none !important; }
          div[style*="rgba(10,18,38"] { background: white !important; border-color: #e2e8f0 !important; }
        }
      `}</style>
    </div>
  );
}
