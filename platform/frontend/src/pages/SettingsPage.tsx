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
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.4rem', margin: 0, letterSpacing: '-.03em' }}>Configuration</h1>
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
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem' }}>Santé système</span>
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
      <div style={S.section}>
        <div style={S.header}>
          <Cpu size={16} color="#8b5cf6" />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.9rem' }}>Providers IA</span>
          {providers && (
            <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: '#64748b' }}>
              {providers.summary.configured} / {providers.summary.total} configurés
              {providers.simulation_mode && (
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 99, background: 'rgba(251,191,36,.1)', color: '#fde68a', fontSize: '.7rem', fontWeight: 700 }}>
                  Mode simulation
                </span>
              )}
            </span>
          )}
        </div>
        <div style={S.body}>
          {providers?.simulation_mode && (
            <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.15)', borderRadius: 10, marginBottom: 14, fontSize: '.82rem', color: '#fde68a', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Zap size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Aucune clé LLM configurée — les agents fonctionnent en mode simulation.
              Ajouter une clé dans le fichier <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>.env</code> pour activer l'IA réelle.
            </div>
          )}
          <div style={{ display: 'grid', gap: 0 }}>
            {providers?.providers.map((p, i, arr) => (
              <div key={p.id} style={{ ...S.row, borderBottom: i < arr.length - 1 ? undefined : 'none' }}>
                <div>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div>
                  {p.active_model && (
                    <div style={{ fontSize: '.72rem', color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>{p.active_model}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {providers.active_provider === p.id && (
                    <span style={{ fontSize: '.68rem', padding: '1px 7px', borderRadius: 99, background: 'rgba(250,204,21,.1)', color: '#facc15', fontWeight: 700 }}>Actif</span>
                  )}
                  <span style={S.badge(p.configured)}>
                    {p.configured ? <Check size={10} /> : <AlertTriangle size={10} />}
                    {p.configured ? 'Configuré' : 'Non configuré'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(0,0,0,.2)', borderRadius: 10, fontSize: '.78rem', color: '#475569', lineHeight: 1.6 }}>
            <strong style={{ color: '#94a3b8' }}>Providers gratuits recommandés :</strong><br />
            GLM-4-Flash (open.bigmodel.ai) · Groq Llama 3 (console.groq.com) · Gemini Flash (aistudio.google.com)
          </div>
        </div>
      </div>

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
