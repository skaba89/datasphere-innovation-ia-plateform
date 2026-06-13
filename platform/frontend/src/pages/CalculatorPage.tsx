/**
 * CalculatorPage — Calculateur de rentabilité pour consultants freelance
 *
 * Features:
 *   - Simulation financière temps réel
 *   - Presets TJM par rôle
 *   - Breakdown coûts détaillé
 *   - Alertes intelligentes
 *   - Comparaison de scénarios
 */

import { useI18n } from '../i18n';
import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  Info, Plus, RefreshCw, TrendingUp, X,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimInput {
  tjm_ht:           number;
  days_billed:      number;
  portage_pct:      number;
  overhead_monthly: number;
  non_billed_days:  number;
  vat_regime:       'normal' | 'franchise';
  include_cfe:      boolean;
  include_mutuelle: boolean;
}

interface SimResult {
  revenue:  { gross_ht: number; after_portage: number; vat_collected: number };
  costs:    { portage_fee: number; overhead_annual: number; cfe: number; mutuelle: number; total: number };
  net:      { annual: number; monthly_avg: number; daily_equivalent: number };
  metrics:  { occupancy_rate_pct: number; breakeven_days: number; cost_ratio_pct: number; days_billed: number };
  alerts:   { level: string; message: string }[];
}

interface RolePreset { label: string; tjm_min: number; tjm_max: number }
interface PortageRate { label: string; rate_pct: number }

const DEFAULT_INPUT: SimInput = {
  tjm_ht: 650, days_billed: 110, portage_pct: 8.5,
  overhead_monthly: 200, non_billed_days: 30,
  vat_regime: 'normal', include_cfe: true, include_mutuelle: true,
};

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1)} %`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [inp, setInp] = useState<SimInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<Record<string, RolePreset>>({});
  const [portageRates, setPortageRates] = useState<Record<string, PortageRate>>({});
  const [showPresets, setShowPresets] = useState(false);
  const [scenarios, setScenarios] = useState<Array<{ label: string; input: SimInput; result: SimResult }>>([]);

  // Load presets on mount
  useEffect(() => {
    apiRequest<{ roles: Record<string, RolePreset>; portage: Record<string, PortageRate> }>
      ('/calculator/presets', {}, token)
      .then(d => { setPresets(d.roles); setPortageRates(d.portage); })
      .catch(() => {});
  }, []);

  // Auto-simulate on input change
  const simulate = useCallback(async (input: SimInput) => {
    setLoading(true);
    try {
      const res = await apiRequest<SimResult>('/calculator/simulate', {
        method: 'POST', body: JSON.stringify(input),
      }, token);
      setResult(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { simulate(inp); }, [inp, simulate]);

  function set(field: keyof SimInput, value: unknown) {
    setInp(prev => ({ ...prev, [field]: value }));
  }

  function applyPreset(role: RolePreset) {
    const mid = Math.round((role.tjm_min + role.tjm_max) / 2 / 50) * 50;
    setInp(prev => ({ ...prev, tjm_ht: mid, days_billed: 110 }));
    setShowPresets(false);
  }

  function saveScenario() {
    if (!result) return;
    const label = `Scénario ${scenarios.length + 1} — ${eur(inp.tjm_ht)}/j`;
    setScenarios(prev => [...prev.slice(-2), { label, input: { ...inp }, result }]);
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const gold = '#facc15';
  const S = {
    page: { padding: 'clamp(20px,4vw,36px) clamp(16px,3vw,32px)', maxWidth: 1080, margin: '0 auto' } as React.CSSProperties,
    card: { background: 'rgba(12,20,37,.92)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 16, padding: 'clamp(16px,3vw,24px)' } as React.CSSProperties,
    label: { display: 'block', fontSize: '.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '.05em', textTransform: 'uppercase' as const, marginBottom: 6, fontFamily: 'monospace' },
    input: { width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(148,163,184,.15)', borderRadius: 9, color: '#f1f5f9', fontSize: '.9rem', outline: 'none', fontFamily: 'Syne, sans-serif', fontWeight: 700 } as React.CSSProperties,
    kpi: (accent?: string): React.CSSProperties => ({
      padding: '16px 18px', borderRadius: 14,
      background: accent ? `rgba(${accent},.06)` : 'rgba(255,255,255,.03)',
      border: `1px solid rgba(${accent || '148,163,184'},.12)`,
    }),
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,.05)', fontSize: '.82rem' } as React.CSSProperties,
  };

  const alertColor: Record<string, string> = {
    danger: '#fca5a5', warning: '#fde68a', success: '#86efac', info: '#93c5fd',
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <TrendingUp size={22} color={gold} />
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.4rem', margin: 0, letterSpacing: '-.03em' }}>
            Calculateur de rentabilité
          </h1>
          <p style={{ color: '#64748b', fontSize: '.82rem', margin: '2px 0 0' }}>
            Simulez votre revenu net réel en temps réel
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={saveScenario} disabled={!result} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={12} /> Sauvegarder scénario
          </button>
          <button onClick={() => setInp(DEFAULT_INPUT)} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem' }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px,100%), 1fr))', gap: 20 }}>

        {/* ── Inputs ── */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, margin: 0, fontSize: '.95rem' }}>Paramètres</h3>
              <button onClick={() => setShowPresets(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.06)', color: gold, cursor: 'pointer', fontSize: '.76rem', fontWeight: 700 }}>
                Presets <ChevronDown size={12} style={{ transform: showPresets ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
            </div>

            {/* Preset picker */}
            {showPresets && (
              <div style={{ marginBottom: 16, display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {Object.entries(presets).map(([key, p]) => (
                  <button key={key} onClick={() => applyPreset(p)} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.1)', background: 'rgba(255,255,255,.03)', cursor: 'pointer', color: '#e2e8f0', fontSize: '.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{p.label}</span>
                    <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{p.tjm_min}–{p.tjm_max} €/j</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gap: 14 }}>
              {/* TJM */}
              <div>
                <label style={S.label}>Taux journalier moyen HT (€)</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={100} max={3000} step={25} value={inp.tjm_ht}
                    onChange={e => set('tjm_ht', +e.target.value)} style={S.input} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '.8rem' }}>€/jour</span>
                </div>
                <input type="range" min={200} max={2000} step={25} value={inp.tjm_ht}
                  onChange={e => set('tjm_ht', +e.target.value)}
                  style={{ width: '100%', marginTop: 8, accentColor: gold }} />
              </div>

              {/* Jours facturés */}
              <div>
                <label style={S.label}>Jours facturés / an <span style={{ color: gold }}>({inp.days_billed} j)</span></label>
                <input type="range" min={20} max={220} step={5} value={inp.days_billed}
                  onChange={e => set('days_billed', +e.target.value)}
                  style={{ width: '100%', accentColor: gold }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', color: '#475569', marginTop: 4 }}>
                  <span>20 j (min)</span>
                  <span style={{ color: gold }}>{inp.days_billed} jours</span>
                  <span>220 j (max)</span>
                </div>
              </div>

              {/* Portage */}
              <div>
                <label style={S.label}>Structure / portage salarial</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(portageRates).map(([key, p]) => (
                    <button key={key}
                      onClick={() => set('portage_pct', p.rate_pct)}
                      style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${inp.portage_pct === p.rate_pct ? gold : 'rgba(148,163,184,.15)'}`, background: inp.portage_pct === p.rate_pct ? 'rgba(250,204,21,.1)' : 'none', color: inp.portage_pct === p.rate_pct ? gold : '#64748b', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}>
                      {p.label} {p.rate_pct > 0 ? `(${p.rate_pct}%)` : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frais fixes */}
              <div>
                <label style={S.label}>Frais fixes / mois (€) — outils, déplacements…</label>
                <input type="number" min={0} max={5000} step={50} value={inp.overhead_monthly}
                  onChange={e => set('overhead_monthly', +e.target.value)} style={S.input} />
              </div>

              {/* Jours non facturés */}
              <div>
                <label style={S.label}>Jours non facturés / an (congés, prospection…)</label>
                <input type="number" min={0} max={200} value={inp.non_billed_days}
                  onChange={e => set('non_billed_days', +e.target.value)} style={S.input} />
              </div>

              {/* Options */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { field: 'include_cfe' as const, label: 'CFE (~600€)' },
                  { field: 'include_mutuelle' as const, label: 'Mutuelle (~150€/mois)' },
                ].map(({ field, label }) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '.8rem', color: '#94a3b8' }}>
                    <input type="checkbox" checked={inp[field] as boolean}
                      onChange={e => set(field, e.target.checked)}
                      style={{ accentColor: gold, width: 14, height: 14 }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {loading && !result && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #facc15', borderTopColor: 'transparent', animation: 'ds-spin .7s linear infinite' }} />
            </div>
          )}

          {result && (<>
            {/* Main KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12 }}>
              {[
                { label: 'Revenu net / an',    value: eur(result.net.annual),          accent: '250,204,21', big: true },
                { label: 'Net / mois moyen',   value: eur(result.net.monthly_avg),     accent: '34,197,94' },
                { label: 'Équivalent / jour',  value: eur(result.net.daily_equivalent),accent: '59,130,246' },
                { label: 'Taux occupation',    value: pct(result.metrics.occupancy_rate_pct), accent: result.metrics.occupancy_rate_pct < 60 ? '239,68,68' : '34,197,94' },
              ].map(k => (
                <div key={k.label} style={S.kpi(k.accent)}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: k.big ? '1.5rem' : '1.15rem', color: `rgb(${k.accent})`, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: '.7rem', color: '#475569', marginTop: 5 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div style={S.card}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, margin: '0 0 14px', fontSize: '.9rem' }}>Décomposition</h3>
              {[
                { label: 'Chiffre d\'affaires brut HT', value: result.revenue.gross_ht, color: '#86efac' },
                { label: `Frais portage (${inp.portage_pct}%)`, value: -result.costs.portage_fee, color: '#fca5a5' },
                { label: 'Frais fixes annuels', value: -result.costs.overhead_annual, color: '#fca5a5' },
                ...(result.costs.cfe > 0 ? [{ label: 'CFE', value: -result.costs.cfe, color: '#fca5a5' }] : []),
                ...(result.costs.mutuelle > 0 ? [{ label: 'Mutuelle', value: -result.costs.mutuelle, color: '#fca5a5' }] : []),
                { label: 'REVENU NET ANNUEL', value: result.net.annual, color: '#facc15', bold: true },
              ].map((row, i) => (
                <div key={i} style={{ ...S.row, ...(row.bold ? { borderTop: '1px solid rgba(148,163,184,.15)', marginTop: 6, paddingTop: 12, fontWeight: 800 } : {}) }}>
                  <span style={{ color: row.bold ? '#f1f5f9' : '#64748b' }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 700, fontFamily: 'monospace' }}>
                    {row.value < 0 ? '− ' : '+ '}{eur(Math.abs(row.value))}
                  </span>
                </div>
              ))}

              {/* Metrics */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(148,163,184,.07)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '.76rem', color: '#475569' }}>
                  Seuil de rentabilité : <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{result.metrics.breakeven_days} j facturés</span>
                </div>
                <div style={{ fontSize: '.76rem', color: '#475569' }}>
                  Part charges : <span style={{ color: result.metrics.cost_ratio_pct > 30 ? '#fca5a5' : '#e2e8f0', fontWeight: 700 }}>{pct(result.metrics.cost_ratio_pct)}</span>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {result.alerts.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {result.alerts.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, background: `rgba(${alertColor[a.level] === '#fca5a5' ? '239,68,68' : alertColor[a.level] === '#fde68a' ? '250,204,21' : alertColor[a.level] === '#86efac' ? '34,197,94' : '59,130,246'},.07)`, border: `1px solid rgba(${alertColor[a.level] === '#fca5a5' ? '239,68,68' : alertColor[a.level] === '#fde68a' ? '250,204,21' : alertColor[a.level] === '#86efac' ? '34,197,94' : '59,130,246'},.2)`, color: alertColor[a.level], fontSize: '.8rem', alignItems: 'flex-start' }}>
                    {a.level === 'success' ? <CheckCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : a.level === 'danger' ? <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
                    {a.message}
                  </div>
                ))}
              </div>
            )}
          </>)}
        </div>
      </div>

      {/* Scenarios comparison */}
      {scenarios.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, margin: 0, fontSize: '.95rem' }}>Comparaison de scénarios</h3>
            <button onClick={() => setScenarios([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 14, overflowX: 'auto' }}>
            {scenarios.map((sc, i) => (
              <div key={i} style={{ ...S.card, borderColor: i === 0 ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.1)' }}>
                <div style={{ fontSize: '.75rem', fontFamily: 'monospace', color: i === 0 ? gold : '#64748b', marginBottom: 10, fontWeight: 700 }}>
                  {i === 0 ? '⭐ ' : ''}{sc.label}
                </div>
                {[
                  { l: 'Net / an',   v: eur(sc.result.net.annual) },
                  { l: 'Net / mois', v: eur(sc.result.net.monthly_avg) },
                  { l: 'TJM',        v: `${eur(sc.input.tjm_ht)}/j` },
                  { l: 'Jours',      v: `${sc.input.days_billed} j facturés` },
                  { l: 'Occupation', v: pct(sc.result.metrics.occupancy_rate_pct) },
                ].map(({ l, v }) => (
                  <div key={l} style={S.row}>
                    <span style={{ color: '#475569', fontSize: '.78rem' }}>{l}</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '.78rem', fontFamily: 'monospace' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
