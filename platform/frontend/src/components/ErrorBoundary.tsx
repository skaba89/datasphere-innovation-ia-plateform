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
      return (
        <div style={{
          padding: '32px', margin: '24px', maxWidth: 560,
          background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)',
          borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} color="#fca5a5" />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: '#fca5a5', fontSize: '1rem' }}>
              Une erreur s'est produite
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '.85rem', lineHeight: 1.6 }}>
            {this.state.error?.message || 'Erreur inconnue'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 9,
              border: '1px solid rgba(239,68,68,.3)',
              background: 'rgba(239,68,68,.1)', color: '#fca5a5',
              cursor: 'pointer', fontSize: '.82rem', fontWeight: 700,
            }}
          >
            <RefreshCw size={13} /> Réessayer
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
