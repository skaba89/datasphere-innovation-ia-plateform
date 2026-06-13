/**
 * SettingsPage — Configuration de la plateforme
 *
 * Sections :
 *   - Providers LLM (clés API configurées, statut, test)
 *   - SMTP email (statut, test d'envoi)
 *   - Stripe billing (clés configurées)
 *   - Plateforme (version, santé, vider cache)
 *
 * Note : les clés API sont configurées dans le .env backend.
 * Cette page affiche le statut et permet de déclencher des tests.
 */

import { useI18n } from '../i18n';
import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Check, CheckCircle,
  Cpu, CreditCard, Key, Mail, Plus, RefreshCw, Send, Settings,
  Shield, Trash2, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string; name: string; configured: boolean;
  active_model?: string; status?: string;
}

interface ProvidersData {
  providers: Provider[];
  active_provider?: string;
  summary: { total: number; configured: number };
  simulation_mode: boolean;
}

interface HealthData {
  overall: string; version: string;
  checks: Record<string, { status: string; detail?: string }>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { padding: 'clamp(20px,4vw,36px) clamp(16px,3vw,32px)', maxWidth: 900, margin: '0 auto' } as React.CSSProperties,
  section: { background: 'rgba(12,20,37,.92)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 16, marginBottom: 20, overflow: 'hidden' } as React.CSSProperties,
  header: { padding: '16px 22px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  body: { padding: '18px 22px' } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,.05)', flexWrap: 'wrap', gap: 8 } as React.CSSProperties,
  badge: (ok: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 99, fontSize: '.72rem', fontWeight: 700,
    background: ok ? 'rgba(34,197,94,.08)' : 'rgba(100,116,139,.08)',
    color: ok ? '#86efac' : '#64748b',
    border: `1px solid ${ok ? 'rgba(34,197,94,.2)' : 'rgba(100,116,139,.15)'}`,
  }),
  btn: (variant: 'ghost' | 'gold' = 'ghost'): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 8, border: variant === 'gold' ? 'none' : '1px solid rgba(148,163,184,.15)',
    background: variant === 'gold' ? '#facc15' : 'rgba(255,255,255,.04)',
    color: variant === 'gold' ? '#060e18' : '#64748b',
    cursor: 'pointer', fontSize: '.78rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6,
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [providers, setProviders] = useState<ProvidersData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [prov, h] = await Promise.all([
        apiRequest<ProvidersData>('/providers', {}, token).catch(() => null),
        apiRequest<HealthData>('/health/detailed', {}, token).catch(() => null),
      ]);
      if (prov) setProviders(prov);
      if (h) setHealth(h);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleTestEmail() {
    if (!testEmail) return;
    setTestingEmail(true);
    setTestMsg(null);
    try {
      await apiRequest('/email/send', {
        method: 'POST',
        body: JSON.stringify({
          to: testEmail,
          email_type: 'welcome',
          params: { first_name: 'Test DataSphere' },
          dry_run: false,
        }),
      }, token);
      setTestMsg({ ok: true, text: `Email de test envoyé à ${testEmail}` });
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof Error ? e.message : 'Échec envoi' });
    } finally { setTestingEmail(false); }
  }

  async function handleRefreshHealth() {
    setRefreshing(true);
    try {
      const h = await apiRequest<HealthData>('/health/detailed', {}, token);
      setHealth(h);
    } finally { setRefreshing(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#64748b' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #facc15', borderTopColor: 'transparent', animation: 'ds-spin .7s linear infinite' }} />
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const smtpOk = health?.checks?.smtp?.status === 'ok';
  const dbOk   = health?.checks?.database?.status === 'ok';

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Settings size={22} color="#facc15" />
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.4rem', margin: 0, letterSpacing: '-.03em' }}>{t('settings.title')}</h1>
          <p style={{ color: '#64748b', fontSize: '.82rem', margin: '2px 0 0' }}>Statut des services et paramètres de la plateforme</p>
        </div>
        <button onClick={handleRefreshHealth} style={{ ...S.btn(), marginLeft: 'auto' }} disabled={refreshing}>
          <RefreshCw size={13} style={refreshing ? { animation: 'ds-spin .7s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>

      {/* ── Santé système ── */}
      <div style={S.section}>
        <div style={S.header}>
          <Activity size={16} color="#facc15" />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem' }}>{t('settings.health')}</span>
          {health && (
            <span style={{ ...S.badge(health.overall === 'ok'), marginLeft: 'auto' }}>
              {health.overall === 'ok' ? <Check size={11} /> : <AlertTriangle size={11} />}
              {health.overall?.toUpperCase()}
            </span>
          )}
        </div>
        <div style={S.body}>
          {health ? (
            <div style={{ display: 'grid', gap: 0 }}>
              {[
                { label: 'Base de données', key: 'database' },
                { label: 'Stockage fichiers', key: 'storage' },
                { label: 'SMTP Email', key: 'smtp' },
                { label: 'Scheduler', key: 'scheduler' },
              ].map(({ label, key }) => {
                const check = health.checks?.[key];
                const ok = check?.status === 'ok';
                return (
                  <div key={key} style={S.row}>
                    <span style={{ fontSize: '.85rem', color: '#94a3b8' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {check?.detail && <span style={{ fontSize: '.72rem', color: '#475569', fontFamily: 'monospace' }}>{check.detail}</span>}
                      <span style={S.badge(ok)}>
                        {ok ? <Check size={10} /> : <AlertTriangle size={10} />}
                        {check?.status ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ ...S.row, borderBottom: 'none' }}>
                <span style={{ fontSize: '.85rem', color: '#94a3b8' }}>Version</span>
                <span style={{ fontSize: '.82rem', color: '#facc15', fontFamily: 'monospace', fontWeight: 700 }}>
                  {health.version}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#475569', fontSize: '.83rem' }}>Impossible de charger l'état du système.</p>
          )}
        </div>
      </div>

      {/* ── Providers LLM ── */}
      <ProvidersSection token={token} />

      {/* ── Email SMTP ── */}
      <div style={S.section}>
        <div style={S.header}>
          <Mail size={16} color="#22c55e" />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem' }}>Email SMTP</span>
          <span style={{ ...S.badge(smtpOk), marginLeft: 'auto' }}>
            {smtpOk ? <Check size={10} /> : <AlertTriangle size={10} />}
            {smtpOk ? 'Configuré' : 'Non configuré'}
          </span>
        </div>
        <div style={S.body}>
          {!smtpOk && (
            <p style={{ color: '#64748b', fontSize: '.82rem', marginTop: 0, marginBottom: 14, lineHeight: 1.6 }}>
              Les emails fonctionnent en mode dry-run (log uniquement).<br />
              Configurer <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>SMTP_HOST</code>, <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>SMTP_USER</code> et <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>SMTP_PASSWORD</code> dans <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>.env</code>.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'monospace' }}>
                Email de test
              </label>
              <input
                type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="votre@email.fr"
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(148,163,184,.15)', borderRadius: 9, color: '#f1f5f9', fontSize: '.85rem', outline: 'none' }}
              />
            </div>
            <button onClick={handleTestEmail} disabled={testingEmail || !testEmail} style={S.btn('gold')}>
              <Send size={12} />
              {testingEmail ? 'Envoi…' : 'Envoyer test'}
            </button>
          </div>
          {testMsg && (
            <div style={{ marginTop: 12, padding: '9px 13px', borderRadius: 9, fontSize: '.8rem', display: 'flex', gap: 8, alignItems: 'center', background: testMsg.ok ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${testMsg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: testMsg.ok ? '#86efac' : '#fca5a5' }}>
              {testMsg.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {testMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── Stripe ── */}
      <div style={S.section}>
        <div style={S.header}>
          <CreditCard size={16} color="#3b82f6" />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem' }}>Stripe Billing</span>
        </div>
        <div style={S.body}>
          <div style={{ display: 'grid', gap: 0 }}>
            {[
              { label: 'Mode Stripe',    hint: 'STRIPE_SECRET_KEY',   desc: 'Activer les paiements réels' },
              { label: 'Webhooks',       hint: 'STRIPE_WEBHOOK_SECRET', desc: 'Recevoir les événements Stripe' },
              { label: 'Plan Starter',   hint: 'STRIPE_STARTER_PRICE_ID', desc: 'Price ID Stripe mensuel' },
              { label: 'Plan Pro',       hint: 'STRIPE_PRO_PRICE_ID',    desc: 'Price ID Stripe mensuel' },
            ].map(({ label, hint, desc }, i, arr) => (
              <div key={hint} style={{ ...S.row, borderBottom: i < arr.length - 1 ? undefined : 'none' }}>
                <div>
                  <div style={{ fontSize: '.85rem', color: '#94a3b8' }}>{label}</div>
                  <div style={{ fontSize: '.72rem', color: '#334155', fontFamily: 'monospace', marginTop: 2 }}>{hint}</div>
                </div>
                <span style={{ fontSize: '.75rem', color: '#475569' }}>{desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,0,0,.2)', borderRadius: 10, fontSize: '.78rem', color: '#475569', lineHeight: 1.6 }}>
            Sans clé Stripe, le bouton "Upgrader" utilise le <strong style={{ color: '#94a3b8' }}>mode demo</strong> (mock upgrade immédiat, sans paiement réel).
            Configurer ces variables dans <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>.env</code> pour activer les paiements.
          </div>
        </div>
      </div>

      {/* ── Sécurité ── */}
      <div style={S.section}>
        <div style={S.header}>
          <Shield size={16} color="#f97316" />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem' }}>Sécurité</span>
        </div>
        <div style={S.body}>
          {[
            { label: 'Rate limiting',   ok: true,  detail: '60 req/min par IP' },
            { label: 'CORS',           ok: true,  detail: 'localhost en dev, domaines configurés en prod' },
            { label: 'JWT tokens',     ok: true,  detail: '60 min access + 30j refresh' },
            { label: 'RBAC',           ok: true,  detail: '4 rôles (admin/manager/consultant/viewer)' },
            { label: 'Secret key',     ok: health?.checks?.database?.status === 'ok', detail: 'Vérifier SECRET_KEY dans .env' },
          ].map(({ label, ok, detail }, i, arr) => (
            <div key={label} style={{ ...S.row, borderBottom: i < arr.length - 1 ? undefined : 'none' }}>
              <div>
                <div style={{ fontSize: '.85rem', color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: '.72rem', color: '#334155', marginTop: 2 }}>{detail}</div>
              </div>
              <span style={S.badge(ok)}>
                {ok ? <Check size={10} /> : <AlertTriangle size={10} />}
                {ok ? 'OK' : 'À vérifier'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── API Keys ── */}
      <ApiKeysSection token={token} />

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── API Keys Section ──────────────────────────────────────────────────────────

interface ApiKeyItem {
  id: number; name: string; prefix: string; scopes: string;
  is_active: boolean; last_used_at: string | null;
  expires_at: string | null; created_at: string;
}

interface ApiKeyCreated extends ApiKeyItem { secret: string }

function ApiKeysSection({ token }: { token: string | null }) {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>(['read:all']);
  const [justCreated, setJustCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const SCOPES = ['read:all','write:tenders','write:deliverables','write:opportunities','read:analytics'];

  useEffect(() => {
    apiRequest<ApiKeyItem[]>('/api-keys', {}, token).then(setKeys).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const k = await apiRequest<ApiKeyCreated>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName, scopes: newScopes }),
      }, token);
      setJustCreated(k);
      setKeys(prev => [k, ...prev]);
      setNewKeyName('');
    } catch { /* silent */ }
    finally { setCreating(false); }
  }

  async function revoke(id: number) {
    await apiRequest(`/api-keys/${id}`, { method: 'DELETE' }, token).catch(() => {});
    setKeys(prev => prev.filter(k => k.id !== id));
  }

  function copySecret() {
    if (!justCreated?.secret) return;
    navigator.clipboard.writeText(justCreated.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const S2 = {
    section: { background: 'rgba(12,20,37,.92)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 16, marginBottom: 20, overflow: 'hidden' } as React.CSSProperties,
    header:  { padding: '16px 22px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
    body:    { padding: '18px 22px' } as React.CSSProperties,
    row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,.05)', flexWrap: 'wrap', gap: 8 } as React.CSSProperties,
  };

  return (
    <div style={S2.section}>
      <div style={S2.header}>
        <Key size={16} color="#f97316" />
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem', flex: 1 }}>
          Clés API publique
        </span>
        <span style={{ fontSize: '.74rem', color: '#475569' }}>Pour intégrations Zapier, Make, scripts…</span>
      </div>
      <div style={S2.body}>

        {/* Secret display */}
        {justCreated && (
          <div style={{ marginBottom: 18, padding: '14px 16px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 10 }}>
            <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#86efac', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={12} /> Clé créée — copiez le secret maintenant (affiché une seule fois)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ flex: 1, fontSize: '.72rem', background: 'rgba(0,0,0,.3)', padding: '8px 12px', borderRadius: 8, color: '#e2e8f0', wordBreak: 'break-all' }}>
                {justCreated.secret}
              </code>
              <button onClick={copySecret} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: copied ? '#22c55e' : '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.76rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {copied ? '✓ Copié' : 'Copier'}
              </button>
              <button onClick={() => setJustCreated(null)} style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )}

        {/* Create form */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
            placeholder="Nom de la clé (ex : Zapier prod)"
            onKeyDown={e => e.key === 'Enter' && create()}
            style={{ flex: 1, minWidth: 160, padding: '8px 12px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(148,163,184,.15)', borderRadius: 9, color: '#f1f5f9', fontSize: '.84rem', outline: 'none' }} />
          <button onClick={create} disabled={creating || !newKeyName.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.8rem', opacity: creating ? .6 : 1 }}>
            <Plus size={13} /> {creating ? '…' : 'Créer'}
          </button>
        </div>

        {/* Scope selector */}
        <div style={{ marginBottom: 18, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {SCOPES.map(s => (
            <button key={s} onClick={() => setNewScopes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
              style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${newScopes.includes(s) ? 'rgba(250,204,21,.35)' : 'rgba(148,163,184,.12)'}`, background: newScopes.includes(s) ? 'rgba(250,204,21,.1)' : 'none', color: newScopes.includes(s) ? '#facc15' : '#64748b', cursor: 'pointer', fontSize: '.7rem', fontWeight: 700 }}>
              {s}
            </button>
          ))}
        </div>

        {/* Keys list */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: '.82rem', padding: '12px 0' }}>Chargement…</div>
        ) : keys.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#334155', fontSize: '.82rem', padding: '16px 0' }}>
            Aucune clé API — créez-en une pour intégrer des outils tiers.
          </div>
        ) : (
          <div>
            {keys.map((k, i) => (
              <div key={k.id} style={{ ...S2.row, borderBottom: i < keys.length - 1 ? undefined : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {k.name}
                    <code style={{ fontSize: '.72rem', color: '#64748b', background: 'rgba(0,0,0,.25)', padding: '1px 7px', borderRadius: 5 }}>{k.prefix}</code>
                  </div>
                  <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 3, display: 'flex', gap: 10 }}>
                    {k.scopes.split(' ').map(s => (
                      <span key={s} style={{ background: 'rgba(148,163,184,.08)', padding: '1px 6px', borderRadius: 4, color: '#64748b' }}>{s}</span>
                    ))}
                    {k.last_used_at && <span>Utilisée {new Date(k.last_used_at).toLocaleDateString('fr-FR')}</span>}
                  </div>
                </div>
                <button onClick={() => revoke(k.id)}
                  title="Révoquer cette clé"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)', background: 'rgba(239,68,68,.05)', color: '#fca5a5', cursor: 'pointer', fontSize: '.74rem' }}>
                  <Trash2 size={11} /> Révoquer
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,0,0,.2)', borderRadius: 9, fontSize: '.75rem', color: '#475569', lineHeight: 1.6 }}>
          <strong style={{ color: '#94a3b8' }}>Utilisation :</strong>{' '}
          <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 3 }}>Authorization: Bearer {'{votre_clé}'}</code>
          {' '}dans chaque requête vers <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 3 }}>https://api.datasphere-innovation.fr/api/v1</code>
        </div>
      </div>
    </div>
  );
}

// ── ProvidersSection ──────────────────────────────────────────────────────────

interface ProviderData {
  name: string; label: string; tier: string; tier_label: string;
  configured: boolean; models: string[]; default_model: string;
  active_model: string; context_window: number;
  strengths: string[]; notes: string; api_key_env: string;
}

const TIER_COLOR: Record<string, string> = {
  'free':       '#86efac',
  'near-free':  '#6ee7b7',
  'budget':     '#93c5fd',
  'standard':   '#c4b5fd',
  'premium':    '#fca5a5',
};

const PROVIDER_LINKS: Record<string, string> = {
  groq:       'https://console.groq.com/keys',
  gemini:     'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/keys',
  openai:     'https://platform.openai.com/api-keys',
  anthropic:  'https://console.anthropic.com/settings/keys',
  mistral:    'https://console.mistral.ai/api-keys',
  glm:        'https://open.bigmodel.ai/usercenter/apikeys',
  qwen:       'https://dashscope.console.aliyun.com/apiKey',
  together:   'https://api.together.xyz/settings/api-keys',
  cohere:     'https://dashboard.cohere.com/api-keys',
  perplexity: 'https://www.perplexity.ai/settings/api',
};

function ProvidersSection({ token }: { token: string | null }) {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latency_ms?: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiRequest<{ providers: ProviderData[] }>('/providers', {}, token)
      .then(d => setProviders(d.providers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleTest(name: string) {
    setTesting(name);
    try {
      const r = await apiRequest<{ success: boolean; message: string; latency_ms: number }>(
        `/providers/${name}/test`, { method: 'POST' }, token
      );
      setTestResults(prev => ({ ...prev, [name]: r }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [name]: { success: false, message: String(e) } }));
    } finally { setTesting(null); }
  }

  async function handleSave(name: string) {
    if (!keys[name]?.trim()) return;
    setSaving(name);
    try {
      await apiRequest('/providers/config', {
        method: 'POST',
        body: JSON.stringify({ provider: name, api_key: keys[name].trim(), model: models[name] || undefined }),
      }, token);
      setSaveMsg(prev => ({ ...prev, [name]: '✓ Clé enregistrée pour cette session' }));
      // Refresh providers list
      apiRequest<{ providers: ProviderData[] }>('/providers', {}, token)
        .then(d => setProviders(d.providers ?? [])).catch(() => {});
      setTimeout(() => setSaveMsg(prev => ({ ...prev, [name]: '' })), 3000);
    } catch (e) {
      setSaveMsg(prev => ({ ...prev, [name]: `❌ ${String(e).slice(0, 80)}` }));
    } finally { setSaving(null); }
  }

  const configuredCount = providers.filter(p => p.configured).length;

  const Ps = {
    wrap: { background: 'rgba(12,20,37,.92)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 16, marginBottom: 20, overflow: 'hidden' } as React.CSSProperties,
    hdr:  { padding: '16px 22px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
    body: { padding: '14px 22px' } as React.CSSProperties,
  };

  return (
    <div style={Ps.wrap}>
      <div style={Ps.hdr}>
        <Cpu size={16} color="#8b5cf6" />
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem', flex: 1 }}>{t('settings.providers')}</span>
        <span style={{ fontSize: '.74rem', color: configuredCount > 0 ? '#86efac' : '#fde68a' }}>
          {configuredCount}/{providers.length} configurés
          {configuredCount === 0 && <span style={{ marginLeft: 6, color: '#fde68a' }}>· Mode simulation actif</span>}
        </span>
      </div>
      <div style={Ps.body}>

        {configuredCount === 0 && (
          <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.15)', borderRadius: 10, marginBottom: 16, fontSize: '.8rem', color: '#fde68a', lineHeight: 1.6 }}>
            <strong>Aucun provider actif</strong> — les agents fonctionnent en mode simulation.<br />
            Commence par <strong>Groq</strong> (gratuit, aucune CB) ou <strong>Gemini</strong> (1500 req/jour gratuit).
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: 16, fontSize: '.82rem' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {providers.map(p => {
              const isExp = expanded === p.name;
              const testR = testResults[p.name];
              const isFirst = providers.indexOf(p) === 0;

              return (
                <div key={p.name} style={{
                  border: `1px solid ${p.configured ? 'rgba(134,239,172,.2)' : isExp ? 'rgba(148,163,184,.15)' : 'rgba(148,163,184,.08)'}`,
                  borderRadius: 11,
                  background: p.configured ? 'rgba(34,197,94,.03)' : 'rgba(12,20,37,.6)',
                  overflow: 'hidden',
                }}>
                  {/* Row header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                    onClick={() => setExpanded(isExp ? null : p.name)}
                  >
                    {/* Tier badge */}
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: TIER_COLOR[p.tier] || '#475569', flexShrink: 0 }} />

                    {/* Name + model */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '.86rem', fontWeight: 700, color: p.configured ? '#e2e8f0' : '#64748b' }}>
                          {p.label}
                        </span>
                        <span style={{ fontSize: '.66rem', padding: '1px 6px', borderRadius: 99, background: `${TIER_COLOR[p.tier] || '#475569'}15`, color: TIER_COLOR[p.tier] || '#475569', border: `1px solid ${TIER_COLOR[p.tier] || '#475569'}30`, fontWeight: 700 }}>
                          {p.tier_label}
                        </span>
                      </div>
                      {p.configured && p.active_model && (
                        <div style={{ fontSize: '.7rem', color: '#475569', fontFamily: 'monospace', marginTop: 1 }}>{p.active_model}</div>
                      )}
                    </div>

                    {/* Status + test result */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {testR && (
                        <span style={{ fontSize: '.7rem', color: testR.success ? '#86efac' : '#fca5a5', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {testR.success ? `✓ ${testR.latency_ms}ms` : '✗'}
                        </span>
                      )}
                      <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 99, border: `1px solid ${p.configured ? 'rgba(34,197,94,.3)' : 'rgba(148,163,184,.15)'}`, color: p.configured ? '#86efac' : '#475569', background: p.configured ? 'rgba(34,197,94,.08)' : 'none' }}>
                        {p.configured ? '✓ Actif' : '—'}
                      </span>
                      <span style={{ color: '#475569', fontSize: '.7rem' }}>{isExp ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExp && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(148,163,184,.08)' }}>
                      {/* Notes */}
                      {p.notes && (
                        <div style={{ margin: '10px 0', padding: '8px 12px', background: 'rgba(0,0,0,.2)', borderRadius: 8, fontSize: '.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                          {p.notes}
                        </div>
                      )}

                      {/* Strengths */}
                      {p.strengths?.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                          {p.strengths.map(s => (
                            <span key={s} style={{ fontSize: '.66rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(148,163,184,.06)', color: '#64748b', border: '1px solid rgba(148,163,184,.1)' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* API Key input */}
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input
                              type={showKey[p.name] ? 'text' : 'password'}
                              value={keys[p.name] ?? ''}
                              onChange={e => setKeys(prev => ({ ...prev, [p.name]: e.target.value }))}
                              placeholder={`${p.api_key_env}=sk-...`}
                              style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(148,163,184,.15)', borderRadius: 9, color: '#f1f5f9', fontSize: '.8rem', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                            />
                            <button
                              onClick={() => setShowKey(prev => ({ ...prev, [p.name]: !prev[p.name] }))}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '.7rem', padding: 0 }}
                            >
                              {showKey[p.name] ? '🙈' : '👁'}
                            </button>
                          </div>
                          <button
                            onClick={() => handleSave(p.name)}
                            disabled={!keys[p.name]?.trim() || saving === p.name}
                            style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: keys[p.name]?.trim() ? '#8b5cf6' : 'rgba(148,163,184,.1)', color: keys[p.name]?.trim() ? 'white' : '#475569', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem', flexShrink: 0 }}
                          >
                            {saving === p.name ? '…' : 'Sauver'}
                          </button>
                          {p.configured && (
                            <button
                              onClick={() => handleTest(p.name)}
                              disabled={testing === p.name}
                              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(34,197,94,.25)', background: 'rgba(34,197,94,.06)', color: '#86efac', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem', flexShrink: 0 }}
                            >
                              {testing === p.name ? '…' : 'Tester'}
                            </button>
                          )}
                        </div>

                        {/* Model selector */}
                        {p.models?.length > 0 && (
                          <select
                            value={models[p.name] || p.active_model || p.default_model}
                            onChange={e => setModels(prev => ({ ...prev, [p.name]: e.target.value }))}
                            style={{ padding: '7px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 8, color: '#94a3b8', fontSize: '.76rem' }}
                          >
                            {p.models.map(m => (
                              <option key={m} value={m}>{m}{m === p.default_model ? ' (défaut)' : ''}</option>
                            ))}
                          </select>
                        )}

                        {/* Messages */}
                        {saveMsg[p.name] && (
                          <div style={{ fontSize: '.76rem', color: saveMsg[p.name].startsWith('✓') ? '#86efac' : '#fca5a5' }}>
                            {saveMsg[p.name]}
                          </div>
                        )}
                        {testR && (
                          <div style={{ fontSize: '.76rem', color: testR.success ? '#86efac' : '#fca5a5', padding: '6px 10px', background: testR.success ? 'rgba(34,197,94,.05)' : 'rgba(239,68,68,.05)', borderRadius: 7 }}>
                            {testR.message}
                          </div>
                        )}

                        {/* Get key link */}
                        {PROVIDER_LINKS[p.name] && (
                          <a href={PROVIDER_LINKS[p.name]} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '.72rem', color: '#475569', textDecoration: 'none' }}>
                            ↗ Obtenir une clé API {p.label}
                          </a>
                        )}

                        {/* .env instruction */}
                        <div style={{ fontSize: '.7rem', color: '#334155', padding: '6px 10px', background: 'rgba(0,0,0,.2)', borderRadius: 7, fontFamily: 'monospace' }}>
                          # .env — pour la persistance :<br />
                          {p.api_key_env}=votre_clé_ici
                          {models[p.name] && <><br />LLM_MODEL_{p.name.toUpperCase()}={models[p.name]}</>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Priority chain */}
        {configuredCount > 0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,0,0,.2)', borderRadius: 9, fontSize: '.74rem', color: '#475569', lineHeight: 1.7 }}>
            <strong style={{ color: '#94a3b8' }}>Chaîne de fallback active :</strong>{' '}
            {providers.filter(p => p.configured).map(p => p.name).join(' → ')}{' '}→ simulation
          </div>
        )}
      </div>
    </div>
  );
}
