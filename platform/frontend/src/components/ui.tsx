/**
 * DataSphere UI — Shared state primitives
 *
 * Composants réutilisables pour la gestion cohérente des états dans toute l'app :
 *   <Spinner />          — indicateur de chargement
 *   <StatusMsg />        — message inline succès / erreur / warning
 *   <EmptyCard />        — état vide avec icône + texte + action optionnelle
 *   <PageError />        — erreur pleine largeur avec retry
 *   <SectionHeader />    — titre de section avec bouton optionnel
 */

import React from 'react';
import { AlertTriangle, CheckCircle, Info, RefreshCw, XCircle } from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      'rgba(12, 20, 37, .9)',
  border:  'rgba(148, 163, 184, .12)',
  text:    '#f1f5f9',
  sub:     '#64748b',
  gold:    '#facc15',
  error:   { bg: 'rgba(239,68,68,.07)', border: 'rgba(239,68,68,.2)', text: '#fca5a5' },
  success: { bg: 'rgba(34,197,94,.07)',  border: 'rgba(34,197,94,.2)',  text: '#86efac' },
  warning: { bg: 'rgba(250,204,21,.07)', border: 'rgba(250,204,21,.2)', text: '#fde68a' },
  info:    { bg: 'rgba(59,130,246,.07)', border: 'rgba(59,130,246,.2)', text: '#93c5fd' },
} as const;

// ─── Spinner ──────────────────────────────────────────────────────────────────
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  inline?: boolean;
}

export function Spinner({ size = 'md', label, inline = false }: SpinnerProps) {
  const px = { sm: 14, md: 20, lg: 32 }[size];
  const style: React.CSSProperties = inline
    ? { display: 'inline-flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: '.82rem' }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '24px 16px', color: T.sub, fontSize: '.83rem' };

  return (
    <div style={style}>
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none"
        style={{ animation: 'ds-spin .75s linear infinite', flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
          strokeDasharray="40" strokeDashoffset="15" strokeLinecap="round" />
      </svg>
      {label && <span>{label}</span>}
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── StatusMsg ────────────────────────────────────────────────────────────────
type StatusVariant = 'error' | 'success' | 'warning' | 'info';

interface StatusMsgProps {
  variant: StatusVariant;
  children: React.ReactNode;
  onClose?: () => void;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

const ICONS: Record<StatusVariant, React.ComponentType<{ size: number }>> = {
  error: XCircle, success: CheckCircle, warning: AlertTriangle, info: Info,
};

export function StatusMsg({ variant, children, onClose, onRetry, style }: StatusMsgProps) {
  const c = T[variant];
  const Icon = ICONS[variant];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '11px 14px', borderRadius: 10,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: '.82rem', lineHeight: 1.5,
      ...style,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
        <Icon size={14} />
      </span>
      <span style={{ flex: 1 }}>{children}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'none',
          border: 'none', cursor: 'pointer', color: c.text, fontSize: '.76rem',
          textDecoration: 'underline', flexShrink: 0,
        }}>
          <RefreshCw size={10} /> Réessayer
        </button>
      )}
      {onClose && (
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: c.text, opacity: .6, flexShrink: 0, fontSize: '.9rem', lineHeight: 1,
        }}>✕</button>
      )}
    </div>
  );
}

// ─── EmptyCard ────────────────────────────────────────────────────────────────
interface EmptyCardProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyCard({ icon, title, description, action, compact = false }: EmptyCardProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: compact ? '24px 16px' : '48px 24px',
      background: T.bg, border: `1px dashed ${T.border}`,
      borderRadius: 14, textAlign: 'center', gap: 8,
    }}>
      {icon && (
        <div style={{ fontSize: '2rem', marginBottom: 4, opacity: .5 }}>{icon}</div>
      )}
      <div style={{ fontWeight: 700, color: T.sub, fontSize: compact ? '.83rem' : '.9rem' }}>
        {title}
      </div>
      {description && (
        <p style={{ color: T.sub, fontSize: '.78rem', maxWidth: 320, margin: 0, opacity: .8 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ─── PageError ────────────────────────────────────────────────────────────────
interface PageErrorProps {
  message: string;
  onRetry?: () => void;
}

export function PageError({ message, onRetry }: PageErrorProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 14, padding: '40px 24px', textAlign: 'center',
    }}>
      <XCircle size={28} color="#fca5a5" />
      <div>
        <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: 6 }}>
          Erreur de chargement
        </div>
        <p style={{ color: T.sub, fontSize: '.82rem', margin: 0, maxWidth: 360 }}>{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 9,
          border: '1px solid rgba(239,68,68,.25)',
          background: 'rgba(239,68,68,.08)',
          color: '#fca5a5', cursor: 'pointer', fontSize: '.82rem', fontWeight: 700,
        }}>
          <RefreshCw size={12} /> Réessayer
        </button>
      )}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string | number;
}

export function SectionHeader({ title, subtitle, action, badge }: SectionHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: '.92rem', margin: 0, letterSpacing: '-.02em',
          }}>
            {title}
          </h3>
          {badge !== undefined && (
            <span style={{
              padding: '1px 8px', borderRadius: 99,
              background: 'rgba(250,204,21,.12)',
              border: '1px solid rgba(250,204,21,.2)',
              color: '#fde68a', fontSize: '.7rem', fontFamily: 'monospace', fontWeight: 700,
            }}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p style={{ color: T.sub, fontSize: '.77rem', margin: '2px 0 0' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── ActionButton ────────────────────────────────────────────────────────────
interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function ActionButton({
  onClick, children, variant = 'primary', disabled, loading, icon, size = 'md',
}: ActionButtonProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: T.gold, color: '#060e18', border: 'none' },
    secondary: { background: 'rgba(255,255,255,.05)', color: T.text, border: `1px solid ${T.border}` },
    danger: { background: 'rgba(239,68,68,.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.2)' },
    ghost: { background: 'none', color: T.sub, border: 'none' },
  };
  const pad = size === 'sm' ? '6px 12px' : '9px 16px';
  const fsize = size === 'sm' ? '.76rem' : '.82rem';

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: pad, borderRadius: 9, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontWeight: 800, fontSize: fsize, fontFamily: 'Syne, sans-serif',
        opacity: disabled ? .4 : 1, transition: 'opacity .15s',
        ...styles[variant],
      }}
    >
      {loading ? <Spinner size="sm" inline /> : icon}
      {children}
    </button>
  );
}
