/**
 * ErrorPages — Pages d'erreur branded DataSphere
 *
 * Usage dans AppRoot :
 *   <NotFoundPage />
 *   <ServerErrorPage message="..." />
 *   <ForbiddenPage />
 */

import { AlertTriangle, ArrowLeft, Home, RefreshCw, Shield } from 'lucide-react';

const gold = '#facc15';

const S = {
  page: {
    minHeight: '60vh',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    padding: 'clamp(32px,8vw,80px) clamp(16px,4vw,40px)',
    textAlign: 'center' as const,
  },
  code: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 'clamp(4rem,15vw,8rem)',
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: '-.06em',
    background: 'linear-gradient(135deg,#facc15 0%,#f59e0b 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 800,
    fontSize: 'clamp(1.2rem,3vw,1.8rem)',
    marginBottom: 12,
    letterSpacing: '-.02em',
  },
  msg: {
    color: '#64748b',
    fontSize: 'clamp(.85rem,2vw,.98rem)',
    lineHeight: 1.6,
    maxWidth: 460,
    marginBottom: 28,
  },
  actions: {
    display: 'flex', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'center',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: gold, color: '#060e18',
    cursor: 'pointer', fontWeight: 800, fontSize: '.88rem',
    fontFamily: 'Syne, sans-serif',
  } as React.CSSProperties,
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '10px 20px', borderRadius: 10,
    border: '1px solid rgba(148,163,184,.2)', background: 'none',
    color: '#64748b', cursor: 'pointer', fontWeight: 700, fontSize: '.88rem',
  } as React.CSSProperties,
};

interface NotFoundProps {
  onGoHome?: () => void;
  onGoBack?: () => void;
}

export function NotFoundPage({ onGoHome, onGoBack }: NotFoundProps) {
  return (
    <div style={S.page}>
      <div style={S.code}>404</div>
      <h1 style={S.title}>Page introuvable</h1>
      <p style={S.msg}>
        La page que vous cherchez n'existe pas ou a été déplacée.
        Vérifiez l'URL ou retournez au tableau de bord.
      </p>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={onGoHome ?? (() => window.location.href = '/')}>
          <Home size={15} /> Tableau de bord
        </button>
        {onGoBack && (
          <button style={S.btnSecondary} onClick={onGoBack}>
            <ArrowLeft size={14} /> Retour
          </button>
        )}
      </div>
    </div>
  );
}

interface ServerErrorProps {
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function ServerErrorPage({ message, onRetry, onGoHome }: ServerErrorProps) {
  return (
    <div style={S.page}>
      <div style={{ ...S.code, fontSize: 'clamp(3.5rem,12vw,7rem)' }}>500</div>
      <h1 style={S.title}>Erreur serveur</h1>
      <p style={S.msg}>
        {message || "Une erreur inattendue s'est produite. Nos équipes ont été notifiées."}
      </p>
      <div style={S.actions}>
        {onRetry && (
          <button style={S.btnPrimary} onClick={onRetry}>
            <RefreshCw size={14} /> Réessayer
          </button>
        )}
        <button style={S.btnSecondary} onClick={onGoHome ?? (() => window.location.href = '/')}>
          <Home size={14} /> Tableau de bord
        </button>
      </div>
      {message && (
        <details style={{ marginTop: 20, textAlign: 'left', maxWidth: 480 }}>
          <summary style={{ cursor: 'pointer', fontSize: '.76rem', color: '#475569' }}>
            Détails techniques
          </summary>
          <pre style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(0,0,0,.3)', borderRadius: 8, fontSize: '.72rem', color: '#94a3b8', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {message}
          </pre>
        </details>
      )}
    </div>
  );
}

export function ForbiddenPage({ onGoHome }: { onGoHome?: () => void }) {
  return (
    <div style={S.page}>
      <div style={{ marginBottom: 20 }}>
        <Shield size={52} color={gold} strokeWidth={1.5} />
      </div>
      <h1 style={S.title}>Accès refusé</h1>
      <p style={S.msg}>
        Vous n'avez pas les permissions nécessaires pour accéder à cette ressource.
        Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
      </p>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={onGoHome ?? (() => window.location.href = '/')}>
          <Home size={15} /> Tableau de bord
        </button>
      </div>
    </div>
  );
}

export function RateLimitPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <div style={S.page}>
      <div style={{ marginBottom: 20 }}>
        <AlertTriangle size={48} color="#f59e0b" strokeWidth={1.5} />
      </div>
      <h1 style={S.title}>Trop de requêtes</h1>
      <p style={S.msg}>
        Vous avez dépassé la limite de requêtes autorisée (60/min).
        Attendez un moment avant de réessayer.
      </p>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={onRetry ?? (() => window.location.reload())}>
          <RefreshCw size={14} /> Réessayer
        </button>
      </div>
    </div>
  );
}
