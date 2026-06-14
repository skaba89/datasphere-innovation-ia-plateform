/**
 * AgentManagementPanel — Gestion des 12 agents IA
 * Installe, active/désactive et inspecte chaque agent.
 */

import { useEffect, useState } from 'react';
import {
  Bot, CheckCircle, ChevronDown, ChevronRight,
  Download, Loader2, RefreshCw, Shield, Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface Agent {
  id: number; name: string; slug: string; domain: string;
  seniority: string; description: string; mission_types: string;
  languages: string; tools: string; governance_rules: string;
  is_active: boolean;
}

const DOMAIN_COLORS: Record<string, string> = {
  'data-architecture': '#3b82f6', 'public-tenders': '#facc15',
  'data-governance': '#8b5cf6', 'it-data-business': '#06b6d4',
  'documentation': '#22c55e', 'mlops-dataops': '#f97316',
  'cloud-infrastructure': '#60a5fa', 'data-quality': '#a78bfa',
  'rgpd-compliance': '#ef4444', 'bi-analytics': '#10b981',
  'data-strategy': '#f59e0b', 'ai-machine-learning': '#ec4899',
};

const DOMAIN_LABELS: Record<string, string> = {
  'data-architecture': 'Architecture Data', 'public-tenders': "Appels d'offres",
  'data-governance': 'Gouvernance', 'it-data-business': 'Business Analysis',
  'documentation': 'Documentation', 'mlops-dataops': 'MLOps & DataOps',
  'cloud-infrastructure': 'Cloud & Infra', 'data-quality': 'Qualité Data',
  'rgpd-compliance': 'RGPD', 'bi-analytics': 'BI & Analytics',
  'data-strategy': 'Data Strategy', 'ai-machine-learning': 'IA & ML',
};

export default function AgentManagementPanel({ token }: { token: string | null }) {
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [installing, setInstalling] = useState(false);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [toggling,  setToggling]  = useState<number | null>(null);
  const [done,      setDone]      = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<Agent[]>('/agents', {}, token);
      setAgents(data ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function installDefaults() {
    setInstalling(true);
    try {
      await apiRequest('/agents/defaults/install', { method: 'POST' }, token);
      setDone(true); await load();
    } finally { setInstalling(false); }
  }

  async function toggleAgent(agent: Agent) {
    setToggling(agent.id);
    try {
      await apiRequest(`/agents/${agent.id}`, {
        method: 'PATCH', body: JSON.stringify({ is_active: !agent.is_active }),
      }, token);
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: !a.is_active } : a));
    } finally { setToggling(null); }
  }

  const active = agents.filter(a => a.is_active).length;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.78rem', color: '#64748b' }}>
          <span style={{ color: '#22c55e', fontWeight: 800 }}>{active}</span> actifs ·{' '}
          <span style={{ color: '#94a3b8', fontWeight: 800 }}>{agents.length}</span> total
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={load} style={ghostBtn}><RefreshCw size={12} /> Actualiser</button>
          <button onClick={installDefaults} disabled={installing} style={primaryBtn}>
            {installing ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} />
              : done ? <CheckCircle size={13} /> : <Download size={13} />}
            {done ? 'Agents installés ✓' : 'Installer les 12 agents'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!loading && agents.length === 0 && (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px dashed rgba(148,163,184,.1)' }}>
          <Bot size={36} color="#334155" style={{ margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: '#94a3b8', fontWeight: 800, margin: '0 0 6px' }}>Aucun agent installé</p>
          <p style={{ color: '#64748b', fontSize: '.8rem', margin: '0 0 16px', lineHeight: 1.6 }}>
            Installez les 12 agents IA spécialisés en un clic.
          </p>
          <button onClick={installDefaults} disabled={installing} style={primaryBtn}>
            {installing ? '⏳ Installation…' : '⚡ Installer maintenant'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 30, textAlign: 'center' }}>
          <Loader2 size={20} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
        </div>
      )}

      {/* Agents list */}
      {!loading && agents.map(agent => {
        const isOpen   = expanded === agent.id;
        const color    = DOMAIN_COLORS[agent.domain] || '#64748b';
        const missions = agent.mission_types?.split(',').map(m => m.trim()) ?? [];
        const tools    = agent.tools?.split(',').map(t => t.trim()) ?? [];

        return (
          <div key={agent.id} style={{
            borderRadius: 12, overflow: 'hidden', transition: 'all .15s',
            border: `1px solid ${agent.is_active ? color + '22' : 'rgba(148,163,184,.07)'}`,
            background: agent.is_active ? color + '04' : 'rgba(255,255,255,.01)',
          }}>
            {/* Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: color + '12', border: `1.5px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={17} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '.85rem', color: agent.is_active ? '#f1f5f9' : '#64748b' }}>{agent.name}</span>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: color + '15', color }}>{DOMAIN_LABELS[agent.domain] || agent.domain}</span>
                  <span style={{ fontSize: '.62rem', color: '#475569', fontFamily: 'monospace' }}>{agent.seniority}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '.74rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                {/* Toggle */}
                <button onClick={() => toggleAgent(agent)} disabled={toggling === agent.id} title={agent.is_active ? 'Désactiver' : 'Activer'}
                  style={{ width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', background: agent.is_active ? '#22c55e' : 'rgba(148,163,184,.15)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: agent.is_active ? 17 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s' }} />
                </button>
                {/* Expand */}
                <button onClick={() => setExpanded(isOpen ? null : agent.id)}
                  style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(148,163,184,.1)', background: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              </div>
            </div>

            {/* Detail */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(148,163,184,.06)', padding: '10px 14px 12px', display: 'grid', gap: 10 }}>
                <div>
                  <div style={sectionLabel}>Missions</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {missions.map(m => <span key={m} style={chipStyle}>{m}</span>)}
                  </div>
                </div>
                <div>
                  <div style={sectionLabel}><Zap size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Outils</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {tools.map(t => <span key={t} style={{ ...chipStyle, background: color + '0a', border: `1px solid ${color}18`, color }}>{t}</span>)}
                  </div>
                </div>
                {agent.governance_rules && (
                  <div style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.1)', display: 'flex', gap: 7 }}>
                    <Shield size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: '.72rem', color: '#fca5a5', lineHeight: 1.5 }}>{agent.governance_rules}</span>
                  </div>
                )}
                <span style={{ fontSize: '.65rem', color: '#334155', fontFamily: 'monospace' }}>slug: {agent.slug} · {agent.languages}</span>
              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
  borderRadius: 8, border: '1px solid rgba(148,163,184,.15)',
  background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.76rem', fontWeight: 600,
};
const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  borderRadius: 9, border: '1px solid rgba(250,204,21,.3)',
  background: 'rgba(250,204,21,.08)', color: '#facc15',
  cursor: 'pointer', fontWeight: 700, fontSize: '.8rem',
};
const chipStyle: React.CSSProperties = {
  padding: '2px 7px', borderRadius: 5, fontSize: '.7rem', color: '#94a3b8',
  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(148,163,184,.08)',
};
const sectionLabel: React.CSSProperties = {
  fontSize: '.65rem', fontWeight: 800, color: '#475569',
  letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 5,
};
