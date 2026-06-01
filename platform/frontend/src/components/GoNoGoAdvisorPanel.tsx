import { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldAlert, Sparkles, TrendingUp, XCircle } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { GoNoGoRecommendation } from '../api/domainTypes';

const DECISION_CONFIG = {
  'Go':              { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  icon: CheckCircle2,  label: '✅ Go' },
  'No-Go':           { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  icon: XCircle,       label: '❌ No-Go' },
  'Go conditionnel': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', icon: AlertTriangle, label: '⚠️ Go conditionnel' },
};

const LEVEL_CONFIG = {
  high:   { color: '#ef4444', label: 'Élevé' },
  medium: { color: '#f97316', label: 'Moyen' },
  low:    { color: '#22c55e', label: 'Faible' },
};

const IMPACT_CONFIG = {
  fort:   { color: '#22c55e' },
  moyen:  { color: '#3b82f6' },
  faible: { color: '#64748b' },
};

interface Props { tenderId: number; }

export default function GoNoGoAdvisorPanel({ tenderId }: Props) {
  const [rec, setRec] = useState<GoNoGoRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const token = tokenStorage.get();

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await apiRequest<GoNoGoRecommendation>(
        `/tender-governance/tenders/${tenderId}/go-no-go/recommendation`, {}, token,
      );
      setRec(data);
      setExpanded({ risks: true, opps: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally { setLoading(false); }
  }

  const card: React.CSSProperties = {
    background: 'rgba(15,30,54,0.85)',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  };

  const s = (k: string) => expanded[k];
  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  return (
    <div>
      {/* Trigger button */}
      {!rec && (
        <div style={{ ...card, padding: '24px', textAlign: 'center' }}>
          <Bot size={36} color="#8b5cf6" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Recommandation IA Go/No-Go</h3>
          <p style={{ color: '#64748b', fontSize: '0.84rem', marginBottom: 20, maxWidth: 440, margin: '0 auto 20px' }}>
            Analyse les critères pondérés, le contexte de l'appel d'offres et les exigences pour produire une recommandation argumentée.
          </p>
          <button
            onClick={load} disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 26px', borderRadius: 99, border: 'none', cursor: 'pointer',
              background: loading ? 'rgba(139,92,246,0.3)' : '#8b5cf6',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
            {loading ? 'Analyse en cours…' : 'Analyser avec l\'IA'}
          </button>
          {error && (
            <p style={{ color: '#fca5a5', fontSize: '0.84rem', marginTop: 14 }}>{error}</p>
          )}
        </div>
      )}

      {rec && (() => {
        const cfg = DECISION_CONFIG[rec.decision] ?? DECISION_CONFIG['Go conditionnel'];
        const DecIcon = cfg.icon;
        return (
          <>
            {/* Decision banner */}
            <div style={{
              ...card, padding: '22px 24px',
              background: cfg.bg, border: `1px solid ${cfg.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <DecIcon size={36} color={cfg.color} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
                    <span style={{
                      padding: '3px 12px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 700,
                      background: 'rgba(255,255,255,0.1)', color: cfg.color,
                    }}>
                      Confiance {rec.confidence}%
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                      via {rec.provider}
                    </span>
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.7 }}>{rec.summary}</p>
                </div>
                <button
                  onClick={load}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Score bar */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${rec.score_percentage}%`, background: cfg.color, borderRadius: 99, transition: 'width 1s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Score pondéré : {rec.score_global.toFixed(1)}</span>
                <span style={{ fontWeight: 700, color: cfg.color }}>{rec.score_percentage}%</span>
              </div>
            </div>

            {/* Reasoning */}
            <div style={card}>
              <button onClick={() => toggle('reason')} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}>
                <Bot size={15} color="#8b5cf6" />
                <span style={{ fontWeight: 700, flex: 1 }}>Argumentaire détaillé</span>
                {s('reason') ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              </button>
              {s('reason') && (
                <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: 16 }}>
                  <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.75 }}>{rec.reasoning}</p>
                </div>
              )}
            </div>

            {/* Risks */}
            <div style={card}>
              <button onClick={() => toggle('risks')} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}>
                <ShieldAlert size={15} color="#ef4444" />
                <span style={{ fontWeight: 700, flex: 1 }}>Risques identifiés ({rec.risks.length})</span>
                {s('risks') ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              </button>
              {s('risks') && rec.risks.length > 0 && (
                <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: 16, display: 'grid', gap: 10 }}>
                  {rec.risks.map((r, i) => {
                    const lc = LEVEL_CONFIG[r.level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.medium;
                    return (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: `${lc.color}08`, border: `1px solid ${lc.color}20` }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: `${lc.color}20`, color: lc.color }}>{lc.label}</span>
                          <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>{r.category}</span>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: '#e2e8f0', marginBottom: 5 }}>{r.description}</p>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>💡 {r.mitigation}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Opportunities */}
            <div style={card}>
              <button onClick={() => toggle('opps')} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}>
                <TrendingUp size={15} color="#22c55e" />
                <span style={{ fontWeight: 700, flex: 1 }}>Opportunités ({rec.opportunities.length})</span>
                {s('opps') ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              </button>
              {s('opps') && rec.opportunities.length > 0 && (
                <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: 16, display: 'grid', gap: 8 }}>
                  {rec.opportunities.map((o, i) => {
                    const ic = IMPACT_CONFIG[o.impact as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.moyen;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ic.color, flexShrink: 0, marginTop: 6 }} />
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace', marginRight: 8 }}>{o.category}</span>
                          <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{o.description}</span>
                          <span style={{ marginLeft: 8, fontSize: '0.72rem', color: ic.color, fontWeight: 700 }}>({o.impact})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conditions + Actions */}
            {(rec.conditions.length > 0 || rec.recommended_actions.length > 0) && (
              <div style={card}>
                <div style={{ padding: '16px 20px' }}>
                  {rec.conditions.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Conditions requises</div>
                      {rec.conditions.map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: '0.84rem', color: '#fde68a' }}>
                          <span style={{ color: '#f97316' }}>→</span>{c}
                        </div>
                      ))}
                    </div>
                  )}
                  {rec.recommended_actions.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Actions recommandées</div>
                      {rec.recommended_actions.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.84rem', color: '#e2e8f0' }}>
                          <span style={{ color: '#facc15', fontWeight: 700 }}>{i + 1}.</span>{a}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
