/**
 * DashboardPage — Vue d'ensemble ultra-premium
 * Glassmorphism · Micro-animations · KPIs temps réel · Activity feed
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, Bot, Building2, CheckCircle2,
  Clock, FileText, RefreshCw, Target, TrendingUp, Zap,
  ArrowUpRight, Sparkles, Trophy, Calendar,
} from 'lucide-react';
import { DashboardCharts } from '../components/DashboardCharts';
import { SetupWizard } from '../components/SetupWizard';
import { apiRequest, tokenStorage } from '../api/client';
import ActivityFeed from '../components/ActivityFeed';
import type { PipelineAnalytics } from '../api/domainTypes';

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k€`;
  return `${n.toFixed(0)}€`;
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    const t0 = performance.now();
    const dur = Math.min(800, Math.abs(diff) * 20);
    function step(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * ease));
      if (p < 1) requestAnimationFrame(step);
      else prev.current = value;
    }
    requestAnimationFrame(step);
  }, [value]);
  return <>{display.toLocaleString('fr-FR')}</>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color, trend, numeric }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; trend?: string; numeric?: number;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: .1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      background: 'rgba(12,22,45,.85)', border: `1px solid ${color}15`,
      borderRadius: 18, padding: '22px 22px 18px',
      display: 'flex', flexDirection: 'column', gap: 14,
      backdropFilter: 'blur(24px)', position: 'relative', overflow: 'hidden',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity .4s ease, transform .4s ease, box-shadow .2s ease, border-color .2s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${color}15`; e.currentTarget.style.borderColor = `${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = visible ? 'translateY(0)' : 'translateY(12px)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = `${color}15`; }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: `radial-gradient(circle, ${color}08 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}12`, border: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={color} />
        </div>
        {trend && (
          <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,.08)', padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(34,197,94,.2)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowUpRight size={10} />{trend}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.05em', color: '#f1f5f9', lineHeight: 1 }}>
          {visible && numeric !== undefined ? <Counter value={numeric} /> : value}
        </div>
        <div style={{ fontSize: '.75rem', color: '#475569', marginTop: 5, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: '.71rem', color: '#334155', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Deadline item ─────────────────────────────────────────────────────────────
function DeadlineItem({ title, deadline, daysLeft }: { title: string; deadline: string; daysLeft: number }) {
  const color = daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.06)', transition: 'background .15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.82rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: '.7rem', color: '#475569', marginTop: 1 }}>{fmtDateShort(deadline)}</div>
      </div>
      <span style={{ fontSize: '.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: `${color}12`, color, border: `1px solid ${color}25`, flexShrink: 0 }}>
        J-{daysLeft}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const token = tokenStorage.get();
  const [data,      setData]      = useState<PipelineAnalytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const pipeline = await apiRequest<PipelineAnalytics>('/analytics/pipeline', {}, token);
      setData(pipeline);
      // Afficher le wizard si pas d'AOs et pas d'organisations
      if (!pipeline.tenders?.total && !pipeline.opportunities?.total) setShowSetup(true);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Dériver les métriques depuis la vraie structure
  const tenders     = data?.tenders;
  const opps        = data?.opportunities;
  const agents      = data?.agents;
  const deliverables = data?.deliverables;
  const topTenders  = data?.top_tenders ?? [];
  const recentDelivs = data?.recent_deliverables ?? [];

  const winRate = opps ? Math.round((opps.won / Math.max(opps.total, 1)) * 100) : 0;
  const pipelineVal = opps?.pipeline_value ?? 0;

  const deadlines = topTenders
    .filter(t => t.days_left !== null && t.days_left! >= 0 && t.days_left! <= 14)
    .map(t => ({ title: t.title, deadline: t.deadline!, daysLeft: t.days_left! }))
    .slice(0, 4);

  const statusLabel: Record<string, string> = { draft:'Brouillon', review:'Révision', approved:'Approuvé', submitted:'Soumis' };
  const statusColor: Record<string, string> = { draft:'#64748b', review:'#f59e0b', approved:'#22c55e', submitted:'#3b82f6' };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const dayName = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) return (
    <div style={{ padding: '40px clamp(16px,3vw,40px)', display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        {[...Array(6)].map((_,i) => (
          <div key={i} style={{ height: 110, borderRadius: 18, background: 'linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
        ))}
      </div>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: '0 clamp(16px,3vw,40px) 40px', maxWidth: 1200, display: 'grid', gap: 24 }}>
      <style>{`@keyframes dashSpin{to{transform:rotate(360deg)}} @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ padding: '28px 32px', marginTop: 20, background: 'linear-gradient(135deg,rgba(12,22,45,.9),rgba(8,16,36,.95))', border: '1px solid rgba(148,163,184,.08)', borderRadius: 22, position: 'relative', overflow: 'hidden', backdropFilter: 'blur(32px)' }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 300, height: 300, background: 'radial-gradient(circle,rgba(250,204,21,.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -40, width: 250, height: 250, background: 'radial-gradient(circle,rgba(37,99,235,.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(250,204,21,.7)', marginBottom: 8 }}>Tableau de bord</div>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, letterSpacing: '-.05em', margin: 0, lineHeight: 1.1 }}>{greeting} 👋</h1>
            <p style={{ color: '#475569', fontSize: '.88rem', marginTop: 8 }}>{dayName.charAt(0).toUpperCase() + dayName.slice(1)}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {showSetup && <SetupWizard token={token} onDismiss={() => setShowSetup(false)} />}
            <button onClick={() => load(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(148,163,184,.12)', background: 'rgba(255,255,255,.03)', color: '#64748b', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'dashSpin .7s linear infinite' : 'none' }} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Win rate */}
        {data && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(148,163,184,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '.74rem', color: '#475569', fontWeight: 600 }}>Taux de conversion</span>
              <span style={{ fontSize: '.8rem', fontWeight: 800, color: winRate >= 30 ? '#22c55e' : '#f59e0b' }}>{winRate}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${winRate}%`, background: `linear-gradient(90deg,${winRate>=30?'#22c55e':'#f59e0b'},${winRate>=30?'#4ade80':'#fbbf24'})`, transition: 'width 1s cubic-bezier(0,0,.2,1)', boxShadow: `0 0 12px ${winRate>=30?'rgba(34,197,94,.4)':'rgba(245,158,11,.4)'}` }} />
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total AOs',   val: tenders?.total ?? 0,      color: '#64748b' },
                { label: 'Go décidés',  val: tenders?.go_count ?? 0,   color: '#facc15' },
                { label: 'Livrables',   val: deliverables?.total ?? 0, color: '#3b82f6' },
                { label: 'Opportunités gagnées', val: opps?.won ?? 0,  color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 800, color: s.color }}>{s.val}</span>
                  <span style={{ fontSize: '.68rem', color: '#334155' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Grid ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        <KpiCard icon={Target}     label="AOs actifs"          value={tenders?.total ?? 0}              numeric={tenders?.total}          color="#facc15" />
        <KpiCard icon={TrendingUp} label="Pipeline opportunités" value={fmtCurrency(pipelineVal)}        color="#3b82f6" />
        <KpiCard icon={Building2}  label="Opportunités"         value={opps?.total ?? 0}                 numeric={opps?.total}             color="#8b5cf6" />
        <KpiCard icon={FileText}   label="Livrables"            value={deliverables?.total ?? 0}         numeric={deliverables?.total}     color="#22c55e" sub={`${deliverables?.approved ?? 0} approuvés`} />
        <KpiCard icon={Bot}        label="Agents — en attente"  value={agents?.actions_pending_approval ?? 0} numeric={agents?.actions_pending_approval} color="#f59e0b" />
        <KpiCard icon={Trophy}     label="Opportunités gagnées" value={opps?.won ?? 0}                   numeric={opps?.won}               color="#4ade80" trend={`${winRate}%`} />
      </div>

      {/* ── 2 colonnes ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Charts */}
        <div style={{ background: 'rgba(12,22,45,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={15} color="#facc15" />
            <span style={{ fontWeight: 700, fontSize: '.88rem' }}>Analyse du pipeline</span>
          </div>
          <div style={{ padding: '16px 22px 22px' }}>
            <DashboardCharts token={token} />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'grid', gap: 14 }}>

          {/* Deadlines */}
          <div style={{ background: 'rgba(12,22,45,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={14} color="#ef4444" />
              <span style={{ fontWeight: 700, fontSize: '.85rem' }}>Échéances proches</span>
              {tenders && tenders.deadlines_this_week > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '.68rem', background: 'rgba(239,68,68,.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.2)', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>
                  {tenders.deadlines_this_week} cette semaine
                </span>
              )}
            </div>
            <div style={{ padding: '10px 8px 12px' }}>
              {deadlines.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#334155', fontSize: '.8rem' }}>
                  <CheckCircle2 size={20} style={{ margin: '0 auto 6px', opacity: .3 }} />
                  Aucune échéance imminente
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {deadlines.map((d, i) => <DeadlineItem key={i} {...d} />)}
                </div>
              )}
            </div>
          </div>

          {/* Livrables récents */}
          {recentDelivs.length > 0 && (
            <div style={{ background: 'rgba(12,22,45,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color="#8b5cf6" />
                <span style={{ fontWeight: 700, fontSize: '.85rem' }}>Livrables récents</span>
              </div>
              <div style={{ padding: '8px' }}>
                {recentDelivs.slice(0, 4).map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      <div style={{ fontSize: '.68rem', color: '#475569', marginTop: 1 }}>{d.type?.replace(/_/g,' ')}</div>
                    </div>
                    <span style={{ fontSize: '.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', background: `${statusColor[d.status]||'#64748b'}12`, color: statusColor[d.status]||'#64748b', border: `1px solid ${statusColor[d.status]||'#64748b'}25` }}>
                      {statusLabel[d.status] || d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerte agents */}
          {(agents?.actions_pending_approval ?? 0) > 0 && (
            <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#fde68a', marginBottom: 2 }}>
                  {agents!.actions_pending_approval} approbation{agents!.actions_pending_approval > 1 ? 's' : ''} en attente
                </div>
                <div style={{ fontSize: '.73rem', color: '#64748b', lineHeight: 1.4 }}>Des étapes du workflow nécessitent votre validation.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ background: 'rgba(12,22,45,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={14} color="#22c55e" />
          <span style={{ fontWeight: 700, fontSize: '.88rem' }}>Activité récente</span>
        </div>
        <div style={{ padding: '12px 22px 22px' }}>
          <ActivityFeed compact days={7} limit={6} />
        </div>
      </div>
    </div>
  );
}
