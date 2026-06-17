import EmptyState from '../components/EmptyState';
import { useI18n } from '../i18n/index';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2, Users, TrendingUp, Target, DollarSign, Activity,
  Kanban, RefreshCw, Plus, ChevronRight, CheckCircle, Clock,
  AlertCircle, BarChart2, ArrowUpRight, Star, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import ContactsPanel from '../components/ContactsPanel';
import KanbanPipeline from '../components/KanbanPipeline';
import CrmAutomationPanel from '../components/CrmAutomationPanel';
import OpportunityKanban from '../components/OpportunityKanban';

type Tab = 'overview' | 'pipeline' | 'kanban-opps' | 'new-opp' | 'contacts' | 'automation';

interface CrmKpi {
  organizations: number;
  contacts: number;
  opportunities_total: number;
  opportunities_active: number;
  opportunities_won: number;
  pipeline_value_weighted: number;
}

interface Activity7d {
  new_opportunities: number;
  new_tenders: number;
  new_deliverables: number;
}

interface DashboardData {
  crm: CrmKpi;
  activity_7d: Activity7d;
  tenders: { go_decisions: number; submitted: number; upcoming_deadlines_14d: number };
  agents: { pending_approvals: number; execution_rate: number };
}

interface Opportunity {
  id: number;
  title: string;
  status: string;
  potential_value?: number;
  probability?: number;
  organization_name?: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  t('crm.stage_prospect'):       '#64748b',
  'Analyse en cours':         '#3b82f6',
  'GO — En cours de réponse': '#f59e0b',
  'Réponse soumise':          '#8b5cf6',
  'Mission gagnée':           '#22c55e',
  'NO GO — Écarté':           '#ef4444',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  'Mission gagnée': <CheckCircle size={12} />,
  'NO GO — Écarté': <AlertCircle size={12} />,
  'GO — En cours de réponse': <Clock size={12} />,
};

function KpiCard({ icon, label, value, sub, color = '#facc15', delta }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color?: string; delta?: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(148,163,184,.1)',
      borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
        {delta && (
          <span style={{ fontSize: '.7rem', color: '#22c55e', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', padding: '2px 7px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowUpRight size={10} />{delta}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9' }}>{value}</div>
        <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function RecentOpps({ token }: { token: string }) {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ items: Opportunity[] }>('/opportunities?limit=8&sort=created_at_desc', {}, token)
      .then(r => setOpps(Array.isArray(r) ? r : (r?.items ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ color: '#475569', fontSize: '.82rem', padding: 16 }}>Chargement…</div>;
  if (!opps.length) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#334155' }}>
      <Target size={32} style={{ opacity: .3, marginBottom: 8 }} />
      <p style={{ fontSize: '.82rem' }}>Aucune opportunité encore.<br />Ajoutez-en depuis la page Organisations.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {opps.map(opp => {
        const color = STATUS_COLOR[opp.status] ?? '#64748b';
        return (
          <div key={opp.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            borderRadius: 10, transition: 'background .12s',
            cursor: 'pointer',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.82rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opp.title}
              </div>
              <div style={{ fontSize: '.7rem', color: '#475569', marginTop: 1 }}>
                {opp.organization_name ?? '—'} · {opp.status}
              </div>
            </div>
            {opp.potential_value ? (
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#facc15', flexShrink: 0 }}>
                {opp.potential_value >= 1000 ? `${(opp.potential_value/1000).toFixed(0)}k€` : `${opp.potential_value}€`}
              </div>
            ) : null}
            <div style={{ color, display: 'flex', alignItems: 'center' }}>
              {STATUS_ICON[opp.status] ?? <ChevronRight size={12} style={{ color: '#334155' }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversionFunnel({ data }: { data: DashboardData }) {
  const { t } = useI18n();
  const steps = [
    { label: t('crm.organizations'), value: data.crm.organizations, color: '#3b82f6' },
    { label: t('crm.opportunities'), value: data.crm.opportunities_total, color: '#8b5cf6' },
    { label: 'Actives', value: data.crm.opportunities_active, color: '#f59e0b' },
    { label: 'Gagnées', value: data.crm.opportunities_won, color: '#22c55e' },
  ];
  const max = Math.max(...steps.map(s => s.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 90, fontSize: '.72rem', color: '#64748b', textAlign: 'right', flexShrink: 0 }}>{s.label}</div>
          <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,.04)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 6,
              width: `${(s.value / max) * 100}%`,
              background: s.color,
              transition: 'width .6s ease',
              opacity: .85,
              display: 'flex', alignItems: 'center', paddingLeft: 8,
            }}>
              {s.value > 0 && <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'white' }}>{s.value}</span>}
            </div>
          </div>
          <div style={{ width: 32, fontSize: '.78rem', fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}


// Formulaire création opportunité autonome (ne dépend pas des props complexes de OpportunityForm)
function NewOpportunityForm({ token, onSaved, onCancel }: { token: string | null; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle]   = useState('');
  const [orgId, setOrgId]   = useState('');
  const [type, setType]     = useState('mission_data');
  const [value, setValue]   = useState('');
  const [saving, setSaving] = useState(false);
  const [orgs, setOrgs]     = useState<{id:number;name:string}[]>([]);

  useEffect(() => {
    apiRequest<{id:number;name:string}[]>('/organizations?limit=100', {}, token)
      .then(r => setOrgs(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [token]);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiRequest('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          organization_id: orgId ? parseInt(orgId) : null,
          opportunity_type: type,
          potential_value: value ? parseFloat(value) : null,
          status: t('crm.stage_prospect'),
        }),
      }, token);
      onSaved();
    } catch (e) { alert(String(e)); }
    finally { setSaving(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(148,163,184,.15)',
    color: '#f1f5f9', fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 560 }}>
      <div>
        <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em', fontWeight: 700 }}>Titre *</label>
        <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Mission Data Engineering SACEM" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em', fontWeight: 700 }}>Organisation</label>
        <select style={{ ...inp }} value={orgId} onChange={e => setOrgId(e.target.value)}>
          <option value="">— Sans organisation —</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em', fontWeight: 700 }}>Type</label>
          <select style={{ ...inp }} value={type} onChange={e => setType(e.target.value)}>
            <option value="mission_data">Mission Data</option>
            <option value="appel_offre">Appel d'offres</option>
            <option value="regie">Régie</option>
            <option value="forfait">Forfait</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em', fontWeight: 700 }}>Valeur estimée (€)</label>
          <input style={inp} type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="50000" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.84rem' }}>
          Annuler
        </button>
        <button onClick={submit} disabled={saving || !title.trim()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem', opacity: !title.trim() ? .5 : 1 }}>
          {saving ? 'Création…' : "+ Créer l'opportunité"}
        </button>
      </div>
    </div>
  );
}

export default function CommercialPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get() ?? '';
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const d = await apiRequest<DashboardData>('/analytics/dashboard', {}, token);
      setData(d);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const tabBtn = (t: Tab, label: string, Icon: React.ComponentType<{size:number}>) => (
    <button onClick={() => setTab(t)} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 500,
      fontSize: '.84rem', background: tab === t ? 'rgba(250,204,21,.1)' : 'none',
      color: tab === t ? '#facc15' : '#64748b', borderBottom: `2px solid ${tab === t ? '#facc15' : 'transparent'}`,
      transition: 'all .15s',
    }}>
      <Icon size={14} /> {label}
    </button>
  );

  const winRate = data ? Math.round((data.crm.opportunities_won / Math.max(data.crm.opportunities_total, 1)) * 100) : 0;
  const pipelineK = data ? (data.crm.pipeline_value_weighted / 1000).toFixed(0) : '—';

  return (
    <div style={{ padding: 'clamp(16px,3vw,32px) clamp(16px,4vw,40px)', maxWidth: 1400, minHeight: '100vh', display: 'grid', gap: 24, alignContent: 'start' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#facc15', marginBottom: 6 }}>
            CRM Commercial
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Pipeline & Opportunités
          </h1>
          <p style={{ color: '#64748b', fontSize: '.88rem', maxWidth: 520, lineHeight: 1.6 }}>
            Vue 360° de votre pipeline commercial — KPIs temps réel, opportunités, contacts et automatisation CRM.
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
          border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.82rem',
        }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'ds-spin .7s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(148,163,184,.1)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tabBtn('overview',   'Vue d\'ensemble',     BarChart2)}
        {tabBtn('pipeline',   'Pipeline Kanban',     Kanban)}
        {tabBtn('contacts',   'Contacts CRM',        Users)}
        {tabBtn('automation', 'Automatisation IA',   Zap)}
        {tabBtn('kanban-opps','Opportunités Kanban',  TrendingUp)}
        {tabBtn('new-opp',    'Nouvelle opportunité', Plus)}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              {[...Array(6)].map((_,i) => (
                <div key={i} style={{ height: 110, borderRadius: 14, background: 'rgba(255,255,255,.02)', animation: 'ds-pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
                <KpiCard icon={<Building2 size={18}/>} label="Organisations" value={data.crm.organizations} color="#3b82f6" delta={`+${data.activity_7d.new_opportunities} /7j`} />
                <KpiCard icon={<Users size={18}/>} label="Contacts CRM" value={data.crm.contacts} color="#8b5cf6" />
                <KpiCard icon={<Target size={18}/>} label="Opportunités actives" value={data.crm.opportunities_active} sub={`${data.crm.opportunities_total} total`} color="#f59e0b" />
                <KpiCard icon={<CheckCircle size={18}/>} label="Missions gagnées" value={data.crm.opportunities_won} sub={`Taux : ${winRate}%`} color="#22c55e" />
                <KpiCard icon={<DollarSign size={18}/>} label="Pipeline pondéré" value={`${pipelineK}k€`} sub="Probabilité × valeur" color="#facc15" />
                <KpiCard icon={<Activity size={18}/>} label="AOs actifs GO" value={data.tenders.go_decisions} sub={`${data.tenders.upcoming_deadlines_14d} deadline <14j`} color="#f43f5e" />
              </div>

              {/* 2-col layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>

                {/* Funnel */}
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '20px 20px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <BarChart2 size={16} color="#facc15" />
                    <span style={{ fontWeight: 700, fontSize: '.88rem' }}>Entonnoir de conversion</span>
                    <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: winRate >= 30 ? '#22c55e' : '#f59e0b', background: winRate >= 30 ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)', padding: '2px 8px', borderRadius: 99 }}>
                      Taux global : {winRate}%
                    </span>
                  </div>
                  <ConversionFunnel data={data} />
                  <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 10, background: 'rgba(250,204,21,.04)', border: '1px solid rgba(250,204,21,.08)' }}>
                    <div style={{ fontSize: '.72rem', color: '#64748b', marginBottom: 4 }}>Recommandation IA</div>
                    <div style={{ fontSize: '.78rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                      {winRate < 20
                        ? '📊 Taux de conversion faible — activez l\'automatisation CRM pour qualifier plus vite vos prospects.'
                        : winRate < 40
                        ? '⚡ Bon rythme — concentrez-vous sur les AOs GO pour alimenter le pipeline.'
                        : '🎯 Excellente conversion ! Scalez votre prospection pour multiplier le volume.'}
                    </div>
                  </div>
                </div>

                {/* Recent opps */}
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={16} color="#facc15" />
                    <span style={{ fontWeight: 700, fontSize: '.88rem' }}>Opportunités récentes</span>
                    <button onClick={() => setTab('pipeline')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#facc15', cursor: 'pointer', fontSize: '.74rem', fontWeight: 600 }}>
                      Voir tout <ChevronRight size={12} />
                    </button>
                  </div>
                  <div style={{ padding: '8px 4px' }}>
                    <RecentOpps token={token} />
                  </div>
                </div>
              </div>

              {/* Activity 7j */}
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '16px 20px' }}>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Star size={13} color="#facc15" /> Activité des 7 derniers jours
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Nouvelles opportunités', value: data.activity_7d.new_opportunities, color: '#8b5cf6' },
                    { label: 'Nouveaux AOs détectés', value: data.activity_7d.new_tenders, color: '#f59e0b' },
                    { label: 'Livrables créés', value: data.activity_7d.new_deliverables, color: '#22c55e' },
                    { label: 'Approbations en attente', value: data.agents.pending_approvals, color: '#ef4444' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: item.color }}>{item.value}</span>
                      <span style={{ fontSize: '.72rem', color: '#64748b' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#ef4444', fontSize: '.82rem' }}>Erreur de chargement des données analytics.</div>
          )}
        </div>
      )}

      {tab === 'pipeline'   && <KanbanPipeline />}   {/* token géré en interne */}
      {tab === 'contacts'   && <ContactsPanel />}
      {tab === 'automation'  && <CrmAutomationPanel token={token} />}
      {tab === 'kanban-opps' && <OpportunityKanban token={token} />}
      {tab === 'new-opp'     && (
        <section className="panel">
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Créer une opportunité</h2>
          <NewOpportunityForm token={token} onSaved={() => setTab('kanban-opps')} onCancel={() => setTab('overview')} />
        </section>
      )}

      <style>{`
        @keyframes ds-spin { to { transform: rotate(360deg); } }
        @keyframes ds-pulse { 0%,100% { opacity:.4; } 50% { opacity:.7; } }
      `}</style>
    </div>
  );
}
