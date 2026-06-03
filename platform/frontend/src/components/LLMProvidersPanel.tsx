import React from 'react';
/**
 * LLMProvidersPanel — shows the full provider fallback chain
 * with tier badges, configured status, active model, strengths.
 * Used in OperationsPage under a new "Providers IA" tab.
 */
import { useEffect, useState } from 'react';
import {
  Zap, Shield, DollarSign, Star, RefreshCw,
  CheckCircle, XCircle, ArrowRight, Info,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface Provider {
  name: string;
  label: string;
  configured: boolean;
  tier: string;
  tier_label: string;
  tier_order: number;
  active_model: string;
  default_model: string;
  models: string[];
  context_window: number;
  strengths: string[];
  notes: string;
  api_key_env: string;
}

interface Summary {
  total: number;
  configured: number;
  unconfigured: number;
  active_provider: string;
  priority_order: string[];
  free_providers_configured: string[];
}

interface ProvidersData {
  providers: Provider[];
  summary: Summary;
}

interface Recommendations {
  strategy: string;
  priority_order: string[];
  tier_breakdown: Record<string, string[]>;
  all_tasks: Record<string, { best: string[]; reason: string; cost_hint: string; avoid: string[] }>;
  tips: string[];
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  'free':      { bg: 'rgba(34,197,94,.08)',   border: 'rgba(34,197,94,.2)',   text: '#86efac', icon: <Zap size={10} /> },
  'near-free': { bg: 'rgba(99,202,183,.08)',  border: 'rgba(99,202,183,.2)',  text: '#6ee7b7', icon: <Zap size={10} /> },
  'budget':    { bg: 'rgba(250,204,21,.08)',  border: 'rgba(250,204,21,.2)',  text: '#fde68a', icon: <DollarSign size={10} /> },
  'standard':  { bg: 'rgba(147,197,253,.08)', border: 'rgba(147,197,253,.2)', text: '#93c5fd', icon: <Shield size={10} /> },
  'premium':   { bg: 'rgba(216,180,254,.08)', border: 'rgba(216,180,254,.2)', text: '#d8b4fe', icon: <Star size={10} /> },
};

function TierBadge({ tier, label }: { tier: string; label: string }) {
  const c = TIER_COLORS[tier] || TIER_COLORS['standard'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: '.66rem', fontWeight: 700, fontFamily: 'monospace', background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {c.icon}{label}
    </span>
  );
}

const TASK_LABELS: Record<string, string> = {
  context_analysis: 'Analyse de contexte',
  go_no_go_recommendation: 'Go/No-Go',
  tender_requirements_review: 'Revue exigences AO',
  deliverable_plan: 'Plan de livrable',
  compliance_matrix: 'Matrice conformité',
  commercial_proposal: 'Proposition commerciale',
  sector_analysis: 'Analyse sectorielle',
};

export default function LLMProvidersPanel() {
  const token = tokenStorage.get();
  const [data, setData] = useState<ProvidersData | null>(null);
  const [reco, setReco] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'chain' | 'tasks' | 'tips'>('chain');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [prov, rec] = await Promise.all([
        apiRequest<ProvidersData>('/providers', {}, token),
        apiRequest<Recommendations>('/providers/recommendations', {}, token),
      ]);
      setData(prov);
      setReco(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement des providers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const card: React.CSSProperties = {
    background: 'var(--bg2, #0c1425)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 14,
    overflow: 'hidden',
  };

  if (!data) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid #facc15', borderTopColor: 'transparent', animation: 'ds-spin .75s linear infinite' }} />
          Chargement des providers…
          <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#fca5a5' }}>⚠ {error}</span>
          <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: '#fca5a5', cursor: 'pointer', fontSize: '.8rem' }}>Réessayer</button>
        </div>
      )}
      {!loading && !error && 'Aucune donnée'}
    </div>
  );

  const { providers, summary } = data;
  const configured = providers.filter(p => p.configured);
  const unconfigured = providers.filter(p => !p.configured);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Header KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Providers actifs', val: summary.configured, color: '#86efac' },
          { label: 'Provider actif', val: summary.active_provider.split('/')[0], color: '#facc15', small: true },
          { label: 'Gratuits configurés', val: summary.free_providers_configured.length, color: '#6ee7b7' },
          { label: 'Non configurés', val: summary.unconfigured, color: '#94a3b8' },
        ].map(({ label, val, color, small }) => (
          <div key={label} style={{ ...card, padding: '16px 18px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '.66rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: small ? '1rem' : '1.6rem', color, letterSpacing: '-.03em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['chain', 'tasks', 'tips'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${tab === t ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.15)'}`, background: tab === t ? 'rgba(250,204,21,.1)' : 'none', color: tab === t ? '#facc15' : '#64748b', cursor: 'pointer', fontSize: '.79rem', fontWeight: 600, fontFamily: 'inherit' }}>
            {t === 'chain' ? 'Chaîne de fallback' : t === 'tasks' ? 'Par tâche' : 'Conseils'}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: 'pointer', color: '#64748b' }}>
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {/* Tab: Fallback chain */}
      {tab === 'chain' && (
        <div style={card}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowRight size={14} color="#facc15" />
            <span style={{ fontWeight: 700, fontSize: '.86rem' }}>Ordre de priorité — Gratuit → Quasi-gratuit → Budget → Standard → Premium</span>
          </div>
          {/* Configured */}
          {configured.length > 0 && (
            <div>
              <div style={{ padding: '8px 18px 4px', fontFamily: 'monospace', fontSize: '.66rem', letterSpacing: '.1em', color: '#64748b', textTransform: 'uppercase' }}>
                Actifs ({configured.length})
              </div>
              {configured.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 18px', borderBottom: '1px solid rgba(148,163,184,.05)' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle size={13} color="#86efac" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '.86rem' }}>{p.label}</span>
                      <TierBadge tier={p.tier} label={p.tier_label} />
                      <span style={{ fontFamily: 'monospace', fontSize: '.7rem', padding: '1px 7px', borderRadius: 5, background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.15)', color: '#fde68a' }}>
                        {p.active_model}
                      </span>
                      {i === 0 && (
                        <span style={{ fontFamily: 'monospace', fontSize: '.65rem', padding: '1px 7px', borderRadius: 5, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', color: '#86efac' }}>
                          ACTIF
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#64748b', lineHeight: 1.4 }}>
                      {p.notes}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {p.strengths.map(s => (
                        <span key={s} style={{ padding: '1px 7px', borderRadius: 99, fontSize: '.68rem', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(148,163,184,.12)', color: '#94a3b8' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '.68rem', color: '#475569', flexShrink: 0 }}>
                    {(p.context_window / 1000).toFixed(0)}K ctx
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Unconfigured */}
          {unconfigured.length > 0 && (
            <div>
              <div style={{ padding: '8px 18px 4px', fontFamily: 'monospace', fontSize: '.66rem', letterSpacing: '.1em', color: '#475569', textTransform: 'uppercase' }}>
                Non configurés ({unconfigured.length}) — ajouter la clé dans .env
              </div>
              {unconfigured.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', borderBottom: '1px solid rgba(148,163,184,.04)', opacity: 0.5 }}>
                  <XCircle size={13} color="#475569" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '.82rem', flex: 1 }}>{p.label}</span>
                  <TierBadge tier={p.tier} label={p.tier_label} />
                  <span style={{ fontFamily: 'monospace', fontSize: '.68rem', color: '#475569' }}>{p.api_key_env}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tasks */}
      {tab === 'tasks' && reco && (
        <div style={{ display: 'grid', gap: 10 }}>
          {Object.entries(reco.all_tasks).map(([task, rec]) => (
            <div key={task} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.86rem', marginBottom: 4 }}>
                    {TASK_LABELS[task] || task}
                  </div>
                  <div style={{ fontSize: '.77rem', color: '#64748b', marginBottom: 8 }}>{rec.reason}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {rec.best.map((p, i) => {
                      const info = providers.find(x => x.name === p);
                      const isActive = info?.configured;
                      return (
                        <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: '.72rem', fontWeight: 600, fontFamily: 'monospace', background: isActive ? 'rgba(34,197,94,.08)' : 'rgba(255,255,255,.04)', border: `1px solid ${isActive ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.12)'}`, color: isActive ? '#86efac' : '#64748b' }}>
                          {i === 0 && isActive ? <CheckCircle size={9} /> : null}
                          {p}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {rec.cost_hint && (
                  <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.15)', fontSize: '.73rem', color: '#fde68a', whiteSpace: 'nowrap' }}>
                    {rec.cost_hint.split('Coût')[1]?.trim() || rec.cost_hint}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Tips */}
      {tab === 'tips' && reco && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {reco.tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)' }}>
                <Info size={13} color="#facc15" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: '.83rem', color: '#94a3b8', lineHeight: 1.6 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
