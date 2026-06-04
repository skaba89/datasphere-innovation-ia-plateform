import { useEffect, useState } from 'react';
import {
  User, Lock, Shield, Eye, EyeOff, CheckCircle, AlertCircle,
  Save, RefreshCw,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:       { label: 'Administrateur', color: '#fca5a5' },
  manager:     { label: 'Manager',        color: '#fde68a' },
  consultant:  { label: 'Consultant',     color: '#93c5fd' },
  viewer:      { label: 'Lecteur',        color: '#94a3b8' },
};

export default function UserProfilePage() {
  const token = tokenStorage.get();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Change password state
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiRequest<CurrentUser>('/auth/me', {}, token)
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pwdChecks = [
    { label: '8+ caractères', ok: next.length >= 8 },
    { label: 'Majuscule', ok: /[A-Z]/.test(next) },
    { label: 'Chiffre', ok: /\d/.test(next) },
    { label: 'Caractère spécial', ok: /[^A-Za-z0-9]/.test(next) },
  ];
  const pwdStrength = pwdChecks.filter(c => c.ok).length;

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (next !== confirm) { setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' }); return; }
    if (pwdStrength < 2) { setPwdMsg({ ok: false, text: 'Mot de passe trop faible.' }); return; }
    setPwdLoading(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      }, token);
      setPwdMsg({ ok: true, text: 'Mot de passe mis à jour avec succès.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setPwdMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setPwdLoading(false);
    }
  }

  const card: React.CSSProperties = {
    background: 'rgba(12,20,37,.9)', border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 16, overflow: 'hidden',
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#64748b',
    marginBottom: 6, letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: 'monospace',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 13px',
    background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(148,163,184,.15)',
    borderRadius: 9, color: '#f1f5f9', fontSize: '.86rem', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s',
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Chargement…</div>;

  const role = user ? ROLE_LABELS[user.role] : null;

  return (
    <div style={{ maxWidth: 760, margin: 'clamp(16px,3vw,32px) auto', padding: '0 clamp(12px,3vw,24px)', display: 'grid', gap: 20 }}>

      {/* Profile header */}
      <div style={{ ...card, padding: 28, display: 'flex', gap: 20, alignItems: 'center', background: 'linear-gradient(135deg,rgba(250,204,21,.04),rgba(12,20,37,.9))' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,rgba(250,204,21,.2),rgba(250,204,21,.06))', border: '2px solid rgba(250,204,21,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={28} color="#facc15" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.03em' }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{ color: '#64748b', fontSize: '.85rem', marginTop: 3 }}>{user?.email}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            {role && (
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '.72rem', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(148,163,184,.15)', color: role.color }}>
                {role.label}
              </span>
            )}
            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '.72rem', fontFamily: 'monospace', background: user?.is_active ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${user?.is_active ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: user?.is_active ? '#86efac' : '#fca5a5' }}>
              {user?.is_active ? 'Actif' : 'Désactivé'}
            </span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div style={card}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={15} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Changer le mot de passe</span>
        </div>
        <form onSubmit={handleChangePwd} style={{ padding: 24, display: 'grid', gap: 14 }}>
          {/* Current password */}
          <div>
            <label style={label}>Mot de passe actuel</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                style={{ ...input, paddingRight: 40 }}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="••••••••"
                required
                onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {/* New password */}
          <div>
            <label style={label}>Nouveau mot de passe</label>
            <input type="password" style={input} value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" required
              onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
            {/* Strength bar */}
            {next.length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= pwdStrength ? (pwdStrength <= 1 ? '#ef4444' : pwdStrength <= 2 ? '#f59e0b' : pwdStrength <= 3 ? '#22c55e' : '#4ade80') : 'rgba(148,163,184,.15)', transition: 'background .2s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {pwdChecks.map(c => (
                    <span key={c.label} style={{ fontSize: '.7rem', color: c.ok ? '#86efac' : '#475569', fontFamily: 'monospace' }}>
                      {c.ok ? '✓' : '○'} {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Confirm */}
          <div>
            <label style={label}>Confirmer le nouveau mot de passe</label>
            <input type="password" style={input} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required
              onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
          </div>

          {pwdMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 8, background: pwdMsg.ok ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${pwdMsg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: pwdMsg.ok ? '#86efac' : '#fca5a5', fontSize: '.82rem' }}>
              {pwdMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {pwdMsg.text}
            </div>
          )}

          <button type="submit" disabled={pwdLoading || !current || !next || !confirm}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', borderRadius: 9, border: 'none', cursor: pwdLoading ? 'not-allowed' : 'pointer', background: pwdLoading ? 'rgba(250,204,21,.4)' : '#facc15', color: '#060e18', fontWeight: 800, fontSize: '.87rem', fontFamily: 'Syne, sans-serif' }}>
            {pwdLoading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
            {pwdLoading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>

      {/* Security info */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Shield size={15} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Sécurité du compte</span>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { label: 'Session active', val: 'JWT — expire dans 60 min (renouvelé automatiquement)' },
            { label: 'Durée session maximale', val: 'Refresh token 30 jours' },
            { label: 'Identifiant', val: `#${user?.id}` },
            { label: 'Rôle', val: user?.role || '—' },
          ].map(({ label: l, val }) => (
            <div key={l} style={{ display: 'flex', gap: 16, padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.07)' }}>
              <span style={{ fontSize: '.78rem', color: '#475569', minWidth: 160, fontFamily: 'monospace' }}>{l}</span>
              <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
