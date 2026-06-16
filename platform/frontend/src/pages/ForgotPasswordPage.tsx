import { useI18n } from '../i18n/index';
import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { apiRequest } from '../api/client';

interface Props {
  onBack: () => void;
}

export default function ForgotPasswordPage({ onBack }: Props) {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
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
    borderRadius: 9, color: '#f1f5f9', fontSize: '.88rem', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color .15s',
  };

  if (sent) {
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="#86efac" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: 12 }}>
            Email envoyé
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '.88rem', lineHeight: 1.65, marginBottom: 24 }}>
            Si cette adresse correspond à un compte, un lien de réinitialisation a été envoyé.
            Vérifiez votre boîte mail (et vos spams).
          </p>
          <p style={{ color: '#64748b', fontSize: '.8rem', marginBottom: 24 }}>
            Le lien est valable <strong style={{ color: '#94a3b8' }}>60 minutes</strong>.
          </p>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 auto', padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '.84rem' }}>
            <ArrowLeft size={14} /> Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '.8rem', marginBottom: 24 }}>
        <ArrowLeft size={13} /> Retour
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Mail size={20} color="#facc15" />
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.02em' }}>
          Mot de passe oublié
        </h2>
      </div>
      <p style={{ color: '#64748b', fontSize: '.84rem', marginBottom: 28, lineHeight: 1.6 }}>
        Entrez votre email. Si un compte existe, vous recevrez un lien de réinitialisation valable 60 min.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '.73rem', fontWeight: 700, color: '#64748b', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            Email professionnel
          </label>
          <input
            type="email"
            style={inputStyle}
            placeholder="votre@email.fr"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.18)')}
          />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.8rem', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(250,204,21,.5)' : '#facc15', color: '#060e18', fontWeight: 800, fontSize: '.9rem', fontFamily: 'Syne, sans-serif', letterSpacing: '.02em' }}
        >
          {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
        </button>
      </form>
    </div>
  );
}
