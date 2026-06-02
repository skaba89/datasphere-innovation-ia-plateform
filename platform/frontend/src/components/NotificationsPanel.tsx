import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Clock, RefreshCw, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { AppNotification } from '../api/domainTypes';

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f97316', low: '#64748b' };
const TYPE_ICONS: Record<string, string> = {
  approval_required:   '🛡',
  deliverable_approved:'✅',
  deadline:            '⏰',
  system:              '📌',
};

function fmtTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = tokenStorage.get();

  async function loadCount() {
    if (!token) return;
    const data = await apiRequest<{ unread: number }>('/notifications/count', {}, token).catch(() => ({ unread: 0 }));
    setUnread(data.unread);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const data = await apiRequest<AppNotification[]>('/notifications?limit=30', {}, token);
      setNotifications(data);
      setUnread(data.filter(n => !n.is_read).length);
    } finally { setLoading(false); }
  }

  async function markRead(id: number) {
    await apiRequest(`/notifications/${id}/read`, { method: 'POST' }, token);
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  }

  async function markAllRead() {
    await apiRequest('/notifications/read-all', { method: 'POST' }, token);
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  }

  useEffect(() => {
    loadCount();
    const iv = setInterval(loadCount, 30_000); // fallback polling every 30s

    // Real-time SSE — refresh count instantly on new notification
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
    const currentToken = token;
    let es: EventSource | null = null;

    if (currentToken) {
      try {
        // Append token as query param for EventSource (no custom headers support)
        es = new EventSource(`${API_BASE}/notifications/stream?token=${currentToken}`);
        es.addEventListener('notification', () => { loadCount(); });
        es.addEventListener('action_approved', () => { loadCount(); if (open) loadAll(); });
        es.onerror = () => { es?.close(); }; // Browser auto-reconnects via new EventSource
      } catch { /* SSE not supported or server not ready */ }
    }

    return () => {
      clearInterval(iv);
      es?.close();
    };
  }, [token]);

  useEffect(() => {
    if (open && notifications.length === 0) loadAll();
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadAll(); }}
        style={{
          position: 'relative', padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
          background: open ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(250,204,21,0.3)' : 'rgba(148,163,184,0.15)'}`,
          color: open ? '#facc15' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #07111f',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 380, maxHeight: 520,
          background: '#0d1f35', border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.1)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
            <Bell size={14} color="#facc15" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>Notifications</span>
            {unread > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                {unread} non lue{unread > 1 ? 's' : ''}
              </span>
            )}
            {unread > 0 && (
              <button onClick={markAllRead} title="Tout marquer comme lu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
                <CheckCheck size={13} /> Tout lire
              </button>
            )}
            <button onClick={() => { loadAll(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={13} />
            </button>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 && !loading && (
              <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                <Bell size={28} style={{ margin: '0 auto 10px', opacity: 0.25 }} />
                <div>Aucune notification</div>
              </div>
            )}
            {notifications.map(n => {
              const pc = PRIORITY_COLORS[n.priority] ?? '#64748b';
              return (
                <div key={n.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '11px 16px',
                  borderBottom: '1px solid rgba(148,163,184,0.06)',
                  background: n.is_read ? 'transparent' : 'rgba(250,204,21,0.03)',
                  borderLeft: `3px solid ${n.is_read ? 'transparent' : pc}`,
                }}>
                  <div style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>
                    {TYPE_ICONS[n.type] ?? '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.is_read ? 400 : 700, fontSize: '0.84rem', lineHeight: 1.3, marginBottom: 3 }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: 4, lineHeight: 1.4 }}>{n.body}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Clock size={10} color="#475569" />
                      <span style={{ fontSize: '0.72rem', color: '#475569' }}>{fmtTime(n.created_at)}</span>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 99, background: `${pc}12`, color: pc, fontWeight: 700 }}>
                        {n.priority}
                      </span>
                    </div>
                  </div>
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} title="Marquer comme lu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', flexShrink: 0 }}>
                      <Check size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
