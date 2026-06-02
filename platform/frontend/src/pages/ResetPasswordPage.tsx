import { useState, useEffect } from 'react';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client';

interface Props {
  onSuccess: () => void;
}

export default function ResetPasswordPage({ onSuccess }: Props) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read token from URL ?token=... or #token=...
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    setLoading(true); setError(null);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      });
      setDone(true);
      setTimeout(onSuccess, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 420, margin: '80px auto', padding: '36px 32px',
    background: 'rgba(12,20,37,.9)', border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,.4)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(148,163,184,.18)',
    borderRadius: 9, color: '#f1f5f9', fontSize: '.88rem', outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '.73rem', fontWeight: 700, color: '#64748b',
    marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'monospace',
  };

  if (!token) {
    return (
      <div style={cardStyle}>
        <AlertCircle size={36} color="#fca5a5" style={{ margin: '0 auto 16px', display: 'block' }} />
        <p style={{ textAlign: 'center', color: '#fca5a5', fontSize: '.9rem' }}>
          Lien de réinitialisation invalide ou expiré.<br />
          <button onClick={onSuccess} style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#facc15', textDecoration: 'underline', fontSize: '.84rem' }}>
            Retour à la connexion
          </button>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={cardStyle}>
        <CheckCircle size={48} color="#86efac" style={{ margin: '0 auto 16px', display: 'block' }} />
        <p style={{ textAlign: 'center', color: '#86efac', fontWeight: 700, fontSize: '.95rem' }}>
          Mot de passe mis à jour.
        </p>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '.82rem', marginTop: 8 }}>
          Redirection vers la connexion…
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Lock size={20} color="#facc15" />
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.02em' }}>
          Nouveau mot de passe
        </h2>
      </div>
      <p style={{ color: '#64748b', fontSize: '.84rem', marginBottom: 28, lineHeight: 1.6 }}>
        Choisissez un mot de passe sécurisé (minimum 8 caractères).
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nouveau mot de passe</label>
          <input type="password" style={inputStyle} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Confirmer le mot de passe</label>
          <input type="password" style={inputStyle} placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.8rem', marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Password strength hint */}
        {password.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {['8+ caractères', 'Majuscule', 'Chiffre', 'Caractère spécial'].map((req, i) => {
              const checks = [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10, fontSize: '.72rem', color: checks[i] ? '#86efac' : '#475569', fontFamily: 'monospace' }}>
                  {checks[i] ? '✓' : '○'} {req}
                </span>
              );
            })}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(250,204,21,.5)' : '#facc15', color: '#060e18', fontWeight: 800, fontSize: '.9rem', fontFamily: 'Syne, sans-serif' }}
        >
          {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </div>
  );
}
