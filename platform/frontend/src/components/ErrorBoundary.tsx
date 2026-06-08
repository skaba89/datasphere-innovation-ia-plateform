/**
 * ErrorBoundary — catches uncaught React rendering errors
 * and shows a clean fallback UI instead of a blank screen.
 */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const msg = this.state.error?.message;
      return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '5rem', fontWeight: 900, color: '#facc15', lineHeight: 1 }}>500</div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '12px 0' }}>Erreur inattendue</h1>
          <p style={{ color: '#64748b', fontSize: '.88rem', maxWidth: 400, lineHeight: 1.6, marginBottom: 24 }}>
            {msg || "Une erreur s'est produite. Nos équipes ont été notifiées."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.88rem' }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Inline error banner for async operation errors */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)',
      color: '#fca5a5', fontSize: '.82rem',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <AlertTriangle size={14} />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button onClick={onRetry}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', textDecoration: 'underline', fontSize: '.78rem' }}>
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Loading spinner with optional label */
export function LoadingSpinner({ label = 'Chargement…', size = 'md' }: { label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 14 : size === 'lg' ? 28 : 20;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', color: '#64748b', fontSize: '.83rem' }}>
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
      </svg>
      {label}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/** Empty state with optional action */
export function EmptyState({ icon, title, description, action }: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      color: '#475569',
    }}>
      {icon && <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{icon}</div>}
      <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#64748b', marginBottom: 6 }}>{title}</div>
      {description && <p style={{ fontSize: '.82rem', color: '#475569', maxWidth: 340, margin: '0 auto 16px' }}>{description}</p>}
      {action}
    </div>
  );
}
