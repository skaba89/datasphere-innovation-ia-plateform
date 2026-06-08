/**
 * ConfirmModal — Modal de confirmation pour les actions destructives.
 *
 * Usage :
 *   const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
 *
 *   <ConfirmModal
 *     open={!!pending}
 *     title="Supprimer ce contact ?"
 *     description="Cette action est irréversible."
 *     confirmLabel="Supprimer"
 *     variant="danger"
 *     onConfirm={async () => { await pending?.(); setPending(null); }}
 *     onCancel={() => setPending(null)}
 *   />
 */

import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT = {
  danger:  { bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.22)', btn: '#ef4444', icon: '#fca5a5' },
  warning: { bg: 'rgba(251,191,36,.08)', border: 'rgba(251,191,36,.22)', btn: '#f59e0b', icon: '#fde68a' },
  info:    { bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.22)', btn: '#3b82f6', icon: '#93c5fd' },
} as const;

export default function ConfirmModal({
  open, title, description,
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  variant = 'danger', loading = false,
  onConfirm, onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus piège + Escape
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const v = VARIANT[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: '#0c1829',
        border: `1px solid ${v.border}`,
        borderRadius: 16,
        maxWidth: 420, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,.55)',
        overflow: 'hidden',
        animation: 'dsModalIn .15s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          borderBottom: `1px solid ${v.border}`,
          background: v.bg,
        }}>
          <AlertTriangle size={18} color={v.icon} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <h3 id="confirm-title" style={{
              margin: 0, fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '.97rem', color: '#f1f5f9', letterSpacing: '-.02em',
            }}>
              {title}
            </h3>
            {description && (
              <p style={{ margin: '6px 0 0', fontSize: '.83rem', color: '#94a3b8', lineHeight: 1.55 }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', flexShrink: 0 }}
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 20px',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '9px 18px', borderRadius: 9,
              border: '1px solid rgba(148,163,184,.2)',
              background: 'rgba(255,255,255,.04)',
              color: '#94a3b8', cursor: 'pointer', fontSize: '.83rem', fontWeight: 700,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: v.btn, color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '.83rem', fontWeight: 800, opacity: loading ? .6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading && (
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,.4)',
                borderTopColor: '#fff',
                animation: 'ds-spin .7s linear infinite',
              }} />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dsModalIn {
          from { transform: scale(.93); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes ds-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
