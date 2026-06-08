/**
 * ToastContainer — Notifications flottantes (toasts)
 *
 * Positionné en bas à droite, max 4 toasts visibles simultanément.
 * Auto-dismiss après 5s, fermeture manuelle possible.
 * Supporte : success, info, warning, error
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Info, X, Zap } from 'lucide-react';
import type { ToastEvent } from '../hooks/useRealtimeToasts';

interface Props {
  toasts: ToastEvent[];
  onDismiss: (id: string) => void;
}

const COLORS: Record<ToastEvent['type'], { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(34,197,94,.09)',   border: 'rgba(34,197,94,.25)',   icon: '#86efac' },
  info:    { bg: 'rgba(59,130,246,.09)',   border: 'rgba(59,130,246,.25)',  icon: '#93c5fd' },
  warning: { bg: 'rgba(251,191,36,.09)',   border: 'rgba(251,191,36,.25)',  icon: '#fde68a' },
  error:   { bg: 'rgba(239,68,68,.09)',    border: 'rgba(239,68,68,.25)',   icon: '#fca5a5' },
};

const ICONS: Record<ToastEvent['type'], React.ElementType> = {
  success: Check,
  info:    Info,
  warning: AlertTriangle,
  error:   AlertTriangle,
};

function Toast({ toast, onDismiss }: { toast: ToastEvent; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[toast.type];
  const Icon = ICONS[toast.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
        background: c.bg, border: `1px solid ${c.border}`,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 8px 32px rgba(0,0,0,.35)',
        maxWidth: 320, minWidth: 240, width: '100%',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), opacity .25s',
      }}
    >
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${c.icon}15`, border: `1px solid ${c.icon}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={11} color={c.icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#f1f5f9', lineHeight: 1.3 }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 3, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {toast.message}
          </div>
        )}
      </div>
      <X size={11} color="#475569" style={{ flexShrink: 0, marginTop: 1 }} />
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8,
      alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {toasts.slice(-4).map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
