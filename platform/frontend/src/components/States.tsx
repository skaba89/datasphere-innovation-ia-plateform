/* ── Loading screen ──────────────────────────────────────────── */

export function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#07111f', zIndex: 999,
      gap: 20,
    }}>
      {/* Logo animé */}
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg,#facc15,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', fontWeight: 900, color: '#0a0f1a',
          animation: 'ds-pulse 2s ease-in-out infinite',
        }}>DS</div>
        <div style={{
          position: 'absolute', inset: -4, borderRadius: 18,
          border: '2px solid rgba(250,204,21,.2)',
          animation: 'ds-spin 3s linear infinite',
          borderTopColor: 'rgba(250,204,21,.6)',
        }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontWeight: 900, fontSize: '.95rem', letterSpacing: '.08em',
          background: 'linear-gradient(135deg,#facc15,#f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>DataSphere IA Platform</div>
        <div style={{ fontSize: '.72rem', color: '#334155' }}>Chargement en cours…</div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 160, height: 2, background: 'rgba(148,163,184,.1)', borderRadius: 99 }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(90deg,#facc15,#f59e0b)',
          animation: 'ds-progress 1.5s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes ds-pulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes ds-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ds-progress {
          0% { width: 0%; }
          50% { width: 80%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────── */

interface EmptyStateProps {
  icon:    string;
  title:   string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(148,163,184,.06)',
        border: '1px solid rgba(148,163,184,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.8rem', marginBottom: 4,
      }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#e2e8f0' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '.82rem', color: '#64748b', maxWidth: 340, lineHeight: 1.6 }}>{message}</p>
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 8, padding: '9px 20px', borderRadius: 10,
          border: '1px solid rgba(250,204,21,.25)',
          background: 'rgba(250,204,21,.06)',
          color: '#facc15', cursor: 'pointer',
          fontWeight: 700, fontSize: '.82rem',
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── Error state ─────────────────────────────────────────────── */

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px', textAlign: 'center', gap: 10,
    }}>
      <div style={{ fontSize: '2rem' }}>⚠️</div>
      <p style={{ margin: 0, fontWeight: 700, color: '#fca5a5', fontSize: '.88rem' }}>
        {message || 'Une erreur est survenue'}
      </p>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '7px 16px', borderRadius: 8,
          border: '1px solid rgba(239,68,68,.25)',
          background: 'rgba(239,68,68,.06)',
          color: '#fca5a5', cursor: 'pointer',
          fontWeight: 700, fontSize: '.78rem',
        }}>
          Réessayer
        </button>
      )}
    </div>
  );
}
