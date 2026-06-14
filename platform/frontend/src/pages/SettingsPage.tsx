/**
 * SettingsPage — Configuration de la plateforme
 * Affiche l'état de toutes les intégrations et guides de configuration.
 */

import { useEffect, useState } from 'react';
import {
  Bell, CheckCircle, ChevronRight, ExternalLink,
  Loader2, Mail, RefreshCw, Shield, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface SettingsStatus {
  email:      { configured: boolean; smtp_host: string; smtp_user: string; smtp_from: string; port: number; status: string };
  llm:        { groq: boolean; openai: boolean; anthropic: boolean; gemini: boolean; mistral: boolean; active_provider: string; status: string };
  stripe:     { configured: boolean; mode: string; status: string };
  monitoring: { sentry: boolean; status: string };
  security:   { secret_key_strength: string; setup_disabled: boolean; scheduler: boolean };
  app:        { env: string; version: string };
}

const renderEnvLink = "https://dashboard.render.com";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
      border: `1px solid ${ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
      color: ok ? '#22c55e' : '#ef4444',
      fontSize: '.72rem', fontWeight: 700,
    }}>
      {ok ? <CheckCircle size={11} /> : '✗'} {label}
    </span>
  );
}

function ConfigCard({ icon, title, status, configured, children }: {
  icon: React.ReactNode; title: string; status: string; configured: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!configured);
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${configured ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)'}`, background: 'rgba(15,23,42,.5)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: configured ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#f1f5f9' }}>{title}</div>
          <div style={{ fontSize: '.72rem', color: configured ? '#22c55e' : '#ef4444', marginTop: 1 }}>{status}</div>
        </div>
        <ChevronRight size={14} color="#475569" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: '.15s' }} />
      </div>
      {open && <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(148,163,184,.06)' }}>{children}</div>}
    </div>
  );
}

function EnvVar({ name, value, required }: { name: string; value?: string | null; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: '.78rem', borderBottom: '1px solid rgba(148,163,184,.05)' }}>
      <code style={{ color: value ? '#22c55e' : required ? '#ef4444' : '#64748b', fontWeight: 700, minWidth: 220 }}>{name}</code>
      <span style={{ color: '#475569', flex: 1 }}>{value ? `= ${value}` : required ? '← OBLIGATOIRE' : '← optionnel'}</span>
      {value ? <CheckCircle size={12} color="#22c55e" /> : null}
    </div>
  );
}

export default function SettingsPage() {
  const token = tokenStorage.get();
  const [status,  setStatus]  = useState<SettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<SettingsStatus>('/settings/status', {}, token);
      setStatus(data);
    } catch { setStatus(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function testSmtp() {
    setTesting(true); setTestResult(null);
    try {
      const r = await apiRequest<{ success: boolean; message: string; status: string }>('/email/test', { method: 'POST' }, token);
      setTestResult({ success: r.success, message: r.message });
    } catch (e) {
      setTestResult({ success: false, message: 'Erreur réseau' });
    } finally { setTesting(false); }
  }

  if (loading) return (
    <main className="app-shell">
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Loader2 size={22} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
      </div>
    </main>
  );

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p className="eyebrow">Configuration</p>
            <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Paramètres</h1>
            <p style={{ margin: '3px 0 0', fontSize: '.78rem', color: '#64748b' }}>
              v{status?.app?.version} · {status?.app?.env}
            </p>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem' }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
      </section>

      {!status ? (
        <section className="panel"><p style={{ color: '#ef4444' }}>Impossible de charger les paramètres</p></section>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>

          {/* Email SMTP */}
          <ConfigCard icon={<Mail size={16} color={status.email.configured ? '#22c55e' : '#ef4444'} />}
            title="Email SMTP" status={status.email.status} configured={status.email.configured}>
            <div style={{ paddingTop: 12, display: 'grid', gap: 8 }}>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
                <EnvVar name="SMTP_HOST" value={status.email.smtp_host} required />
                <EnvVar name="SMTP_PORT" value={status.email.port ? String(status.email.port) : null} />
                <EnvVar name="SMTP_USER" value={status.email.smtp_user} required />
                <EnvVar name="SMTP_PASSWORD" value={status.email.smtp_user ? '••••••••' : null} required />
                <EnvVar name="SMTP_FROM"     value={status.email.smtp_from} />
              </div>
              {status.email.configured ? (
                <div>
                  <button onClick={testSmtp} disabled={testing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,.25)', background: 'rgba(59,130,246,.06)', color: '#93c5fd', cursor: 'pointer', fontWeight: 700, fontSize: '.8rem' }}>
                    {testing ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <Mail size={13} />}
                    Tester le SMTP
                  </button>
                  {testResult && (
                    <p style={{ margin: '8px 0 0', fontSize: '.78rem', color: testResult.success ? '#22c55e' : '#fca5a5' }}>
                      {testResult.success ? '✅' : '❌'} {testResult.message}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.1)', fontSize: '.76rem', color: '#fca5a5' }}>
                  <strong>Configuration recommandée :</strong> Gmail (smtp.gmail.com:587 + mot de passe d'application)
                  <br />ou Brevo (smtp-relay.brevo.com:587 — 300 emails/jour gratuit)
                  <br /><br />
                  <a href={renderEnvLink} target="_blank" rel="noopener" style={{ color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ExternalLink size={11} /> Configurer dans Render →
                  </a>
                </div>
              )}
            </div>
          </ConfigCard>

          {/* LLM Providers */}
          <ConfigCard icon={<Zap size={16} color={status.llm.groq || status.llm.openai ? '#22c55e' : '#ef4444'} />}
            title="Providers IA (LLM)" status={status.llm.status} configured={status.llm.groq || status.llm.openai}>
            <div style={{ paddingTop: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {[
                  { name: 'Groq',      ok: status.llm.groq,      link: 'https://console.groq.com', badge: '🆓 Gratuit' },
                  { name: 'Gemini',    ok: status.llm.gemini,    link: 'https://aistudio.google.com/app/apikey', badge: '🆓 Gratuit' },
                  { name: 'OpenAI',    ok: status.llm.openai,    link: 'https://platform.openai.com/api-keys', badge: '💳 Payant' },
                  { name: 'Anthropic', ok: status.llm.anthropic, link: 'https://console.anthropic.com', badge: '💳 Payant' },
                  { name: 'Mistral',   ok: status.llm.mistral,   link: 'https://console.mistral.ai', badge: '💳 Payant' },
                ].map(p => (
                  <div key={p.name} style={{ padding: '6px 10px', borderRadius: 8, background: p.ok ? 'rgba(34,197,94,.06)' : 'rgba(255,255,255,.02)', border: `1px solid ${p.ok ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.1)'}`, fontSize: '.72rem' }}>
                    <span style={{ color: p.ok ? '#22c55e' : '#64748b', fontWeight: 700 }}>{p.ok ? '✅' : '○'} {p.name}</span>
                    <span style={{ color: '#475569', marginLeft: 4 }}>{p.badge}</span>
                    {!p.ok && <a href={p.link} target="_blank" rel="noopener" style={{ display: 'block', color: '#60a5fa', fontSize: '.65rem', marginTop: 2 }}>Obtenir clé →</a>}
                  </div>
                ))}
              </div>
              {!status.llm.groq && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(250,204,21,.04)', border: '1px solid rgba(250,204,21,.15)', fontSize: '.74rem', color: '#fbbf24' }}>
                  ⚠️ <strong>CRITIQUE :</strong> Sans LLM configuré, les agents IA tournent en mode simulation. Les CVs, analyses et suggestions ne sont pas réels.
                  <br />Ajoute <code style={{ background: 'rgba(255,255,255,.08)', padding: '1px 5px', borderRadius: 4 }}>GROQ_API_KEY</code> dans Render → gratuit sur <a href="https://console.groq.com" target="_blank" rel="noopener" style={{ color: '#facc15' }}>console.groq.com</a>
                </div>
              )}
            </div>
          </ConfigCard>

          {/* Stripe */}
          <ConfigCard icon={<span style={{ fontSize: '1rem' }}>💳</span>}
            title="Stripe Billing" status={status.stripe.status} configured={status.stripe.configured}>
            <div style={{ paddingTop: 12, fontSize: '.78rem', color: '#64748b' }}>
              {status.stripe.configured ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge ok={status.stripe.mode === 'live'} label={status.stripe.mode === 'live' ? 'Mode live ✅' : 'Mode test ⚠️'} />
                  {status.stripe.mode !== 'live' && <span style={{ color: '#fbbf24' }}>Remplace <code>sk_test_</code> par <code>sk_live_</code> dans Render</span>}
                </div>
              ) : (
                <p>Non configuré — <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener" style={{ color: '#60a5fa' }}>Obtenir les clés Stripe →</a></p>
              )}
            </div>
          </ConfigCard>

          {/* Monitoring */}
          <ConfigCard icon={<Bell size={16} color={status.monitoring.sentry ? '#22c55e' : '#64748b'} />}
            title="Monitoring (Sentry)" status={status.monitoring.status} configured={status.monitoring.sentry}>
            <div style={{ paddingTop: 12, fontSize: '.78rem', color: '#64748b' }}>
              {!status.monitoring.sentry && (
                <div>
                  <p style={{ margin: '0 0 8px' }}>Sans Sentry, les erreurs production ne sont pas trackées.</p>
                  <ol style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 4 }}>
                    <li>Créer un projet sur <a href="https://sentry.io" target="_blank" rel="noopener" style={{ color: '#60a5fa' }}>sentry.io</a> (gratuit)</li>
                    <li>Copier le DSN</li>
                    <li>Ajouter <code style={{ background: 'rgba(255,255,255,.08)', padding: '1px 5px', borderRadius: 4 }}>SENTRY_DSN</code> dans Render</li>
                  </ol>
                </div>
              )}
            </div>
          </ConfigCard>

          {/* Sécurité */}
          <ConfigCard icon={<Shield size={16} color="#22c55e" />}
            title="Sécurité" status="Vérifications de base" configured>
            <div style={{ paddingTop: 12, display: 'grid', gap: 6 }}>
              {[
                { label: 'Clé secrète JWT', ok: status.security.secret_key_strength.startsWith('✅'), detail: status.security.secret_key_strength },
                { label: 'Endpoint /setup désactivé', ok: status.security.setup_disabled, detail: status.security.setup_disabled ? 'SETUP_ENABLED=false ✅' : 'SETUP_ENABLED=true ⚠️ risque prod' },
                { label: 'Scheduler BOAMP actif', ok: status.security.scheduler, detail: status.security.scheduler ? 'Scan toutes les 6h ✅' : 'SCHEDULER_ENABLED=false' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.78rem' }}>
                  <StatusBadge ok={item.ok} label={item.ok ? 'OK' : 'Attention'} />
                  <span style={{ color: '#94a3b8' }}>{item.label}</span>
                  <span style={{ color: '#475569', fontSize: '.72rem' }}>{item.detail}</span>
                </div>
              ))}
            </div>
          </ConfigCard>

        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
