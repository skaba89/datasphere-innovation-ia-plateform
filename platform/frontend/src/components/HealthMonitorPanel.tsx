import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Server, XCircle } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { PlatformHealth } from '../api/domainTypes';

const STATUS_CONFIG = {
  healthy:   { color: '#22c55e', icon: CheckCircle2, label: 'Sain' },
  attention: { color: '#f97316', icon: AlertTriangle, label: 'Attention' },
  degraded:  { color: '#ef4444', icon: XCircle,      label: 'Dégradé' },
  up:        { color: '#22c55e', icon: CheckCircle2, label: 'Opérationnel' },
  running:   { color: '#22c55e', icon: CheckCircle2, label: 'Actif' },
  stopped:   { color: '#64748b', icon: XCircle,      label: 'Arrêté' },
  configured: { color: '#22c55e', icon: CheckCircle2, label: 'Configuré' },
  preview_only: { color: '#f97316', icon: AlertTriangle, label: 'Preview seulement' },
  simulation: { color: '#8b5cf6', icon: Activity,   label: 'Simulation' },
  live:      { color: '#22c55e', icon: CheckCircle2, label: 'Live LLM' },
  error:     { color: '#ef4444', icon: XCircle,      label: 'Erreur' },
  ok:        { color: '#22c55e', icon: CheckCircle2, label: 'OK' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? { color: '#64748b', icon: Activity, label: status };
  const Icon = cfg.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, color: cfg.color, fontSize: '0.75rem', fontWeight: 700 }}>
      <Icon size={11} />
      {cfg.label}
    </div>
  );
}

export default function HealthMonitorPanel() {
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [healthData, perfData] = await Promise.all([
        apiRequest<PlatformHealth>('/health/detailed', {}, token),
        apiRequest<Record<string, unknown>>('/analytics/performance', {}, token).catch(() => null),
      ]);
      setHealth(healthData);
      if (perfData) setPerf(perfData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const overallCfg = health ? (STATUS_CONFIG[health.overall] ?? STATUS_CONFIG.attention) : null;

  const checkLabels: Record<string, { icon: string; label: string }> = {
    database:  { icon: '🐘', label: 'Base de données PostgreSQL' },
    scheduler: { icon: '⚡', label: 'Scheduler APScheduler' },
    llm:       { icon: '🤖', label: 'Moteur LLM' },
    smtp:      { icon: '📧', label: 'SMTP Email' },
    governance:{ icon: '🛡', label: 'Gouvernance (approbations)' },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Server size={18} color="#facc15" />
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>Santé du système</span>
        {health && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Mis à jour {fmtDate(health.timestamp)}</span>}
        <button onClick={load} disabled={loading} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem' }}>
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>

      {/* Overall status */}
      {health && overallCfg && (
        <div style={{
          padding: '18px 22px', borderRadius: 14, marginBottom: 20,
          background: `${overallCfg.color}08`,
          border: `1px solid ${overallCfg.color}25`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${overallCfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <overallCfg.icon size={24} color={overallCfg.color} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: overallCfg.color }}>
              Plateforme {overallCfg.label}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 3 }}>
              v{health.version} · {Object.keys(health.checks).length} composants surveillés
            </div>
          </div>
        </div>
      )}

      {/* Check cards */}
      {health && (
        <div style={{ display: 'grid', gap: 12 }}>
          {Object.entries(health.checks).map(([key, check]) => {
            const meta = checkLabels[key] ?? { icon: '📦', label: key };
            const checkStatus = (check as any).status as string;
            return (
              <div key={key} style={{
                background: 'rgba(15,30,54,0.85)',
                border: '1px solid rgba(148,163,184,0.1)',
                borderRadius: 12, padding: '16px 18px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: 2 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{meta.label}</span>
                    <StatusBadge status={checkStatus} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {Object.entries(check as Record<string, unknown>)
                      .filter(([k]) => k !== 'status' && k !== 'error')
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <div key={k} style={{ fontSize: '0.78rem' }}>
                          <span style={{ color: '#64748b' }}>{k}: </span>
                          <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
                            {String(v)}
                          </span>
                        </div>
                      ))}
                  </div>
                  {(check as any).error && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, fontSize: '0.78rem', color: '#fca5a5' }}>
                      {(check as any).error}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!health && !loading && !error && (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: '0.84rem' }}>
          Impossible de charger l'état du système.
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span> {error}
          <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: '.76rem', textDecoration: 'underline' }}>Réessayer</button>
        </div>
      )}

      {/* Performance metrics section */}
      {perf && (() => {
        const g = (perf as any).growth ?? {};
        const a = (perf as any).agents ?? {};
        const f = (perf as any).funnel ?? {};
        const kpis = [
          { label: 'Organisations',       value: g.organizations_total ?? 0 },
          { label: 'AO total',            value: g.tenders_total ?? 0 },
          { label: 'Livrables approuvés', value: `${g.deliverables_approved ?? 0} / ${g.deliverables_total ?? 0}` },
          { label: 'Taux approbation',    value: `${g.approval_rate_pct ?? 0} %` },
          { label: 'Actions IA (30j)',    value: a.actions_last_30d ?? 0 },
          { label: 'Taux exécution IA',   value: `${a.execution_rate_pct ?? 0} %` },
          { label: 'AO → Go',             value: `${f.go_rate_pct ?? 0} %` },
          { label: 'Déliv. app. (30j)',   value: f.deliverables_approved_30d ?? 0 },
        ];
        return (
          <div style={{ marginTop: 20, borderTop: '1px solid rgba(148,163,184,.08)', paddingTop: 18 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12 }}>
              Métriques de performance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px,100%), 1fr))', gap: 10 }}>
              {kpis.map(k => (
                <div key={k.label} style={{ background: 'rgba(15,30,54,.85)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#facc15', fontFamily: 'Syne, sans-serif' }}>{k.value}</div>
                  <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
