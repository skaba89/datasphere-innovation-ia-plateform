/**
 * CrmAutomationPanel — Automatisation CRM via Agents IA
 *
 * Explique comment les agents peuplent le CRM et permet de
 * déclencher la synchronisation manuellement.
 */

import { useEffect, useState } from 'react';
import {
  ArrowRight, Bot, Building2, CheckCircle, Loader2,
  RefreshCw, TrendingUp, Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface CrmStats {
  organizations: { total: number; auto: number; manual: number };
  opportunities:  { total: number; auto: number; go: number; won: number };
  automation_rate: number;
}

interface SyncResult {
  status: string;
  organizations: { created: number; updated: number; skipped: number };
  opportunities:  { created: number; updated: number };
  crm_stats: CrmStats;
}

const PIPELINE_STAGES = [
  { key: 'Prospect identifié',      color: '#64748b', from: 'AO détecté (draft)' },
  { key: 'Analyse en cours',        color: '#3b82f6', from: 'AO en analyse' },
  { key: 'GO — En cours de réponse',color: '#facc15', from: 'Décision GO' },
  { key: 'Réponse soumise',         color: '#8b5cf6', from: 'AO soumis' },
  { key: 'Mission gagnée',          color: '#22c55e', from: 'AO gagné' },
  { key: 'NO GO — Écarté',          color: '#ef4444', from: 'Décision NO GO' },
];

export default function CrmAutomationPanel({ token }: { token: string | null }) {
  const [stats,   setStats]   = useState<CrmStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [result,  setResult]  = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await apiRequest<CrmStats>('/crm/auto/stats', {}, token);
      setStats(data);
    } catch { setStats(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadStats(); }, [token]);

  async function runSync() {
    setSyncing(true); setResult(null);
    try {
      const data = await apiRequest<SyncResult>('/crm/auto/sync', { method: 'POST' }, token);
      setResult(data);
      setStats(data.crm_stats);
    } finally { setSyncing(false); }
  }

  async function syncOrgsOnly() {
    setSyncing(true);
    try {
      await apiRequest('/crm/auto/sync-orgs', { method: 'POST' }, token);
      await loadStats();
    } finally { setSyncing(false); }
  }

  async function syncOppsOnly() {
    setSyncing(true);
    try {
      await apiRequest('/crm/auto/sync-opps', { method: 'POST' }, token);
      await loadStats();
    } finally { setSyncing(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Explication du fonctionnement */}
      <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(250,204,21,.04)', border: '1px solid rgba(250,204,21,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Bot size={16} color="#facc15" />
          <span style={{ fontWeight: 800, fontSize: '.85rem', color: '#facc15' }}>Comment les agents peuplent le CRM automatiquement</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { step: '1', icon: '🔍', label: 'BOAMP scan (toutes les 6h)', desc: 'Les agents détectent de nouveaux AOs et extraient le nom de l\'acheteur (buyer_name).' },
            { step: '2', icon: '🏢', label: 'Création Organisation auto', desc: 'Chaque buyer_name unique → une Organisation est créée avec secteur et site web devinés.' },
            { step: '3', icon: '💼', label: 'Création Opportunité auto', desc: 'Chaque AO GO/actif → une Opportunité commerciale liée à l\'organisation de l\'acheteur.' },
            { step: '4', icon: '📊', label: 'Mise à jour pipeline', desc: 'Quand le statut d\'un AO change (GO → Réponse soumise → Gagné), le pipeline CRM se met à jour.' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 900, color: '#facc15', flexShrink: 0 }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#e2e8f0' }}>{item.icon} {item.label}</div>
                <div style={{ fontSize: '.74rem', color: '#64748b', marginTop: 1, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Loader2 size={18} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
        </div>
      ) : stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Organisations', value: stats.organizations.total, sub: `${stats.organizations.auto} auto · ${stats.organizations.manual} manuelles`, icon: <Building2 size={16} color="#3b82f6" />, color: '#3b82f6' },
            { label: 'Opportunités', value: stats.opportunities.total, sub: `${stats.opportunities.go} GO · ${stats.opportunities.won} gagnées`, icon: <TrendingUp size={16} color="#facc15" />, color: '#facc15' },
            { label: 'Taux d\'auto.', value: `${stats.automation_rate}%`, sub: 'créées par les agents', icon: <Zap size={16} color="#22c55e" />, color: '#22c55e' },
          ].map(stat => (
            <div key={stat.label} style={{ padding: '14px 16px', borderRadius: 10, background: `${stat.color}08`, border: `1px solid ${stat.color}20` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {stat.icon}
                <span style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 700 }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '.68rem', color: '#475569', marginTop: 2 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={runSync} disabled={syncing} style={primaryBtn}>
          {syncing ? <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> : <Zap size={14} />}
          Sync CRM complet
        </button>
        <button onClick={syncOrgsOnly} disabled={syncing} style={ghostBtn}>
          <Building2 size={13} /> Sync Organisations
        </button>
        <button onClick={syncOppsOnly} disabled={syncing} style={ghostBtn}>
          <TrendingUp size={13} /> Sync Opportunités
        </button>
        <button onClick={loadStats} disabled={loading || syncing} style={{ ...ghostBtn, marginLeft: 'auto' }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Résultat du sync */}
      {result && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <CheckCircle size={14} color="#22c55e" />
            <span style={{ fontWeight: 800, fontSize: '.82rem', color: '#22c55e' }}>Synchronisation terminée</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '.78rem', color: '#64748b' }}>
            <div>
              <strong style={{ color: '#94a3b8' }}>Organisations</strong>
              <div>+{result.organizations.created} créées · {result.organizations.updated} mises à jour · {result.organizations.skipped} existantes</div>
            </div>
            <div>
              <strong style={{ color: '#94a3b8' }}>Opportunités</strong>
              <div>+{result.opportunities.created} créées · {result.opportunities.updated} mises à jour</div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline mapping */}
      <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.07)' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 800, color: '#475569', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Mapping AO → Pipeline commercial
        </div>
        <div style={{ display: 'grid', gap: 5 }}>
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.74rem' }}>
              <span style={{ fontSize: '.64rem', color: '#475569', width: 140, flexShrink: 0 }}>{stage.from}</span>
              <ArrowRight size={10} color="#334155" style={{ flexShrink: 0 }} />
              <span style={{ padding: '1px 8px', borderRadius: 99, background: `${stage.color}12`, border: `1px solid ${stage.color}25`, color: stage.color, fontWeight: 700 }}>
                {stage.key}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: '.7rem', color: '#334155' }}>
          ⏰ Sync automatique : <strong style={{ color: '#64748b' }}>lundi 08h05</strong> (après le scan BOAMP)
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  borderRadius: 9, border: '1px solid rgba(250,204,21,.3)',
  background: 'rgba(250,204,21,.08)', color: '#facc15',
  cursor: 'pointer', fontWeight: 700, fontSize: '.82rem',
};
const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
  borderRadius: 8, border: '1px solid rgba(148,163,184,.15)',
  background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600,
};
