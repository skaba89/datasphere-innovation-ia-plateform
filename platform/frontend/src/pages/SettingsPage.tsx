import { useI18n } from '../i18n/index';
/**
 * SettingsPage — Configuration plateforme (admin) + état des intégrations
 */
import { useEffect, useState } from 'react';
import {
  Activity, Bot, CheckCircle2, Cloud, Database, Globe,
  Key, Mail, RefreshCw, Server, Shield, Sparkles,
  AlertTriangle, Clock, Cpu, HardDrive, Wifi, X,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface HealthData {
  status: string; version: string; environment: string;
  uptime_seconds: number;
  components: {
    db:        { ok: boolean; latency_ms?: number };
    llm:       { ok: boolean; provider: string };
    rag:       { ok: boolean; mode: string; active_provider: string };
    scheduler: { ok: boolean };
    cache:     { ok: boolean; size: number };
    email:     { ok: boolean };
  };
}

interface DiagData {
  checks: Record<string, any>;
  overall: string;
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: ok ? '#22c55e' : '#ef4444',
        display: 'block', flexShrink: 0,
        boxShadow: ok ? '0 0 6px rgba(34,197,94,.6)' : '0 0 6px rgba(239,68,68,.6)',
      }} />
      {pulse && ok && (
        <span style={{
          position: 'absolute', inset: -2, borderRadius: '50%',
          border: '2px solid rgba(34,197,94,.3)',
          animation: 'settingsPulse 2s ease-in-out infinite',
        }} />
      )}
    </span>
  );
}

function ServiceCard({ icon: Icon, label, ok, detail, color = '#64748b', extra }: {
  icon: React.ElementType; label: string; ok: boolean;
  detail?: string; color?: string; extra?: React.ReactNode;
}) {
  const { lang } = useI18n();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
      background: ok ? 'rgba(34,197,94,.03)' : 'rgba(239,68,68,.03)',
      border: `1px solid ${ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'}`,
      borderRadius: 12, transition: 'all .18s ease',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}12`, border: `1px solid ${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.84rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          {label}
          <StatusDot ok={ok} pulse={ok} />
          <span style={{ fontSize: '.7rem', fontWeight: 700, color: ok ? '#86efac' : '#fca5a5', marginLeft: 'auto' }}>
            {ok ? 'Opérationnel' : 'Hors ligne'}
          </span>
        </div>
        {detail && <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>{detail}</div>}
        {extra}
      </div>

          {/* Guide de mise en production */}
          <div>
            <h2 style={{ fontSize: '.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>{lang === 'en' ? 'Render configuration guide' : 'Guide de configuration Render'}</h2>
            <div style={{ padding: '18px 20px', background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { step: '1', title: 'RAG vectoriel (gratuit)', desc: 'Ajouter GEMINI_API_KEY dans Render → Environment → embeddings réels au lieu de TF-IDF', urgency: 'recommandé', color: '#facc15' },
                  { step: '2', title: 'Emails transactionnels', desc: 'SMTP_HOST + SMTP_USER + SMTP_PASSWORD → invitations, alertes deadline, rapport hebdo', urgency: 'important', color: '#f59e0b' },
                  { step: '3', title: 'LinkedIn publication', desc: 'LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET → OAuth + publication automatique', urgency: 'optionnel', color: '#3b82f6' },
                  { step: '4', title: 'Stripe billing', desc: 'STRIPE_SECRET_KEY + STRIPE_STARTER/PRO_PRICE_ID → checkout réel (mock sinon)', urgency: 'optionnel', color: '#8b5cf6' },
                ].map(({ step, title, desc, urgency, color }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,.04)' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '.72rem', fontWeight: 900, color }}>
                      {step}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
                        <span style={{ fontSize: '.65rem', padding: '1px 7px', borderRadius: 99, background: `${color}10`, color, border: `1px solid ${color}20`, fontWeight: 700 }}>{urgency.toUpperCase()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '.75rem', color: '#475569', lineHeight: 1.5 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 14, fontSize: '.73rem', color: '#334155', lineHeight: 1.5 }}>
                Accéder aux variables : <strong style={{ color: '#64748b' }}>Render Dashboard → datasphere-backend → Environment → Add Environment Variable</strong>
              </p>
            </div>
          </div>
    </div>
  );
}

function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 700 }}>{value} / {max}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          transition: 'width 1s cubic-bezier(0,0,.2,1)',
          boxShadow: `0 0 8px ${color}50`,
        }} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [health, setHealth]   = useState<HealthData | null>(null);
  const [diag,   setDiag]     = useState<DiagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ok:boolean;msg:string}|null>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [h, d] = await Promise.all([
        apiRequest<HealthData>('/health', {}, token),
        apiRequest<DiagData>('/auth/diagnose-login', {}, token).catch(() => null),
      ]);
      setHealth(h); setDiag(d);
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function sendTestEmail() {
    if (!testEmail) return;
    setTesting(true); setTestResult(null);
    try {
      await apiRequest('/email/test', { method: 'POST', body: JSON.stringify({ to: testEmail }) }, token);
      setTestResult({ ok: true, msg: `Email de test envoyé à ${testEmail}` });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e).slice(0, 120) });
    } finally { setTesting(false); }
  }

  const c = health?.components;

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px)', maxWidth: 900, display: 'grid', gap: 24 }}>
      <style>{`
        @keyframes settingsPulse {
          0%, 100% { transform: scale(1); opacity: .6; }
          50%       { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div>
        <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>{lang === 'en' ? 'Configuration' : 'Configuration'}</div>
        <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, letterSpacing: '-.04em', margin: 0, marginBottom: 6 }}>
          Paramètres & Intégrations
        </h1>
        <p style={{ color: '#64748b', fontSize: '.86rem', margin: 0 }}>
          État des services, clés API et diagnostics plateforme.
        </p>
      </div>

      {/* Global status */}
      {health && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px',
          background: health.status === 'ok' ? 'rgba(34,197,94,.05)' : 'rgba(245,158,11,.05)',
          border: `1px solid ${health.status === 'ok' ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)'}`,
          borderRadius: 14, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusDot ok={health.status === 'ok'} pulse />
            <span style={{ fontWeight: 800, color: health.status === 'ok' ? '#86efac' : '#fde68a', fontSize: '.9rem' }}>
              {health.status === 'ok' ? 'Tous les systèmes opérationnels' : 'Service dégradé'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { icon: Server,  label: `v${health.version}` },
              { icon: Globe,   label: health.environment },
              { icon: Clock,   label: formatUptime(health.uptime_seconds) },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.76rem', color: '#64748b' }}>
                <Icon size={12} /> {label}
              </div>
            ))}
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.76rem', fontWeight: 600 }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin .7s linear infinite' : 'none' }} /> Actualiser
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[...Array(5)].map((_,i) => (
            <div key={i} style={{ height: 66, borderRadius: 12, background: 'linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        </div>
      ) : c && (
        <div style={{ display: 'grid', gap: 24 }}>

          {/* Services grid */}
          <div>
            <h2 style={{ fontSize: '.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Services</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              <ServiceCard icon={Database} label={lang === "en" ? "PostgreSQL database" : "Base de données PostgreSQL"} ok={c.db.ok} color="#3b82f6"
                detail={c.db.latency_ms ? `Latence : ${c.db.latency_ms}ms · Render Frankfurt` : 'Render Frankfurt'} />
              <ServiceCard icon={Sparkles} label={`LLM — ${c.llm.provider}`} ok={c.llm.ok} color="#8b5cf6"
                detail={`Provider actif : ${c.llm.provider} · Fallback simulation disponible`} />
              <ServiceCard icon={Cpu} label={`RAG — ${c.rag?.mode === 'vector' ? 'pgvector + Embeddings' : 'TF-IDF fallback'}`}
                ok={c.rag?.ok ?? true} color="#22c55e"
                detail={`Provider embeddings : ${c.rag?.active_provider ?? 'tfidf'} · ${c.rag?.mode === 'vector' ? 'Recherche vectorielle active' : 'Activez GEMINI_API_KEY pour embeddings réels'}`} />
              <ServiceCard icon={Mail} label={lang === "en" ? "Email / SMTP" : "Email / SMTP"} ok={c.email?.ok ?? false} color="#f59e0b"
                detail={c.email?.ok ? 'SMTP configuré et opérationnel' : 'SMTP non configuré — définissez SMTP_HOST dans Render'}
                extra={
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                      placeholder="test@example.com" type="email"
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(148,163,184,.12)', color: '#f1f5f9', fontSize: '.76rem', outline: 'none', minWidth: 0 }} />
                    <button onClick={sendTestEmail} disabled={testing || !testEmail}
                      style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#facc15', color: '#060d1a', cursor: 'pointer', fontWeight: 700, fontSize: '.74rem', opacity: !testEmail ? .5 : 1, whiteSpace: 'nowrap' }}>
                      {testing ? '…' : 'Tester'}
                    </button>
                    {testResult && (
                      <span style={{ fontSize: '.72rem', color: testResult.ok ? '#86efac' : '#fca5a5' }}>
                        {testResult.ok ? '✓' : '✗'} {testResult.msg.slice(0, 40)}
                      </span>
                    )}
                  </div>
                } />
              <ServiceCard icon={Bot} label="Scheduler APScheduler" ok={c.scheduler.ok} color="#facc15"
                detail="Jobs : scan BOAMP toutes les 6h · rapport hebdo lundi 8h" />
              <ServiceCard icon={HardDrive} label={lang === "en" ? "In-memory cache" : "Cache in-memory"} ok={c.cache.ok} color="#06b6d4"
                detail={`${c.cache.size ?? 0} entrées en cache · TTL automatique`} />
            </div>
          </div>

          {/* Métriques */}
          {diag?.checks && (
            <div>
              <h2 style={{ fontSize: '.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>{lang === 'en' ? 'Auth diagnostic' : 'Diagnostic auth'}</h2>
              <div style={{ padding: '18px 20px', background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, display: 'grid', gap: 10 }}>
                {Object.entries(diag.checks).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,.04)' }}>
                    <span style={{ fontSize: '.76rem', color: '#475569', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{key}</span>
                    <span style={{ fontSize: '.76rem', color: val === true ? '#86efac' : val === false ? '#fca5a5' : '#94a3b8', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }}>
                      {typeof val === 'boolean' ? (val ? '✓ true' : '✗ false') : String(val).slice(0, 60)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variables d'environnement requises */}
          <div>
            <h2 style={{ fontSize: '.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Variables d&apos;environnement</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                { key: 'DATABASE_URL',          req: true,  desc: 'PostgreSQL Render (auto-configuré)',        category: 'core' },
                { key: 'SECRET_KEY',            req: true,  desc: 'JWT signing key (32+ caractères)',          category: 'core' },
                { key: 'GEMINI_API_KEY',        req: false, desc: 'Embeddings RAG vectoriels (GRATUIT)',       category: 'ai', recommend: true },
                { key: 'GLM_API_KEY',           req: false, desc: 'Génération texte GLM-4-Flash (GRATUIT)',    category: 'ai' },
                { key: 'GROQ_API_KEY',          req: false, desc: 'Génération rapide Llama/Mixtral (GRATUIT)', category: 'ai' },
                { key: 'OPENAI_API_KEY',        req: false, desc: 'GPT-4o + embeddings premium',              category: 'ai' },
                { key: 'MISTRAL_API_KEY',       req: false, desc: 'Mistral Large (souveraineté EU)',           category: 'ai' },
                { key: 'SMTP_HOST',             req: false, desc: 'Serveur email sortant',                    category: 'email' },
                { key: 'SMTP_USER',             req: false, desc: 'Utilisateur SMTP',                         category: 'email' },
                { key: 'SMTP_PASSWORD',         req: false, desc: 'Mot de passe SMTP',                        category: 'email' },
                { key: 'STRIPE_SECRET_KEY',     req: false, desc: 'Paiements Stripe (mode prod)',             category: 'billing' },
                { key: 'LINKEDIN_CLIENT_ID',    req: false, desc: 'OAuth LinkedIn (publication posts)',        category: 'social' },
                { key: 'LINKEDIN_CLIENT_SECRET',req: false, desc: 'OAuth LinkedIn secret',                    category: 'social' },
                { key: 'SENTRY_DSN',            req: false, desc: 'Monitoring erreurs Sentry',                category: 'ops' },
              ].map(({ key, req, desc, recommend }) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', flexWrap: 'wrap',
                  borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.05)',
                }}>
                  <Key size={11} color={req ? '#fca5a5' : '#334155'} style={{ flexShrink: 0 }} />
                  <code style={{ fontSize: '.72rem', color: req ? '#fde68a' : '#64748b', fontFamily: "'JetBrains Mono', monospace", flex: 1, minWidth: 140, wordBreak: 'break-all' }}>{key}</code>
                  {recommend && <span style={{ fontSize: '.65rem', padding: '2px 6px', borderRadius: 99, background: 'rgba(250,204,21,.1)', color: '#facc15', border: '1px solid rgba(250,204,21,.2)', fontWeight: 700, flexShrink: 0 }}>{lang === 'en' ? 'RECOMMENDED' : 'RECOMMANDÉ'}</span>}
                  {req && <span style={{ fontSize: '.65rem', padding: '2px 6px', borderRadius: 99, background: 'rgba(239,68,68,.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.2)', fontWeight: 700, flexShrink: 0 }}>{lang === 'en' ? 'REQUIRED' : 'REQUIS'}</span>}
                  <span style={{ fontSize: '.71rem', color: '#334155', textAlign: 'right', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '.74rem', color: '#334155', marginTop: 12, lineHeight: 1.5 }}>
              Configurez ces variables dans <strong style={{ color: '#64748b' }}>Render Dashboard → datasphere-backend → Environment</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
