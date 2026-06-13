import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Filter, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import { useWorkflowSSE } from '../hooks/useWorkflowSSE';

interface Notification {
  id: number;
  title: string;
  detail: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  created_at: string;
  source?: string;
  tender_id?: number;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444', high: '#f97316', normal: '#facc15', low: '#64748b',
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent', high: 'Haute', normal: 'Normale', low: 'Basse',
};

export default function NotificationsPage() {
  const token = tokenStorage.get();
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [loading,        setLoading]         = useState(true);
  const [filter,         setFilter]          = useState<'all' | 'unread' | 'high'>('all');
  const [markingAll,     setMarkingAll]      = useState(false);

  // Live updates via SSE
  useWorkflowSSE({
    token,
    onEvent: (e) => {
      if (e.type === 'notification' || e.type === 'workflow.step_awaiting') load();
    },
  });

  async function load() {
    try {
      const params = filter === 'unread' ? '?is_read=false' :
                     filter === 'high'   ? '?priority=high&priority=urgent' : '';
      const data = await apiRequest<Notification[]>(`/notifications${params}&limit=50`, {}, token);
      setNotifications(data ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setLoading(true); load(); }, [filter]);

  async function markRead(id: number) {
    await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }, token);
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function deleteNotif(id: number) {
    await apiRequest(`/notifications/${id}`, { method: 'DELETE' }, token);
    setNotifications(ns => ns.filter(n => n.id !== id));
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' }, token);
      setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filtered    = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'high')   return n.priority === 'high' || n.priority === 'urgent';
    return true;
  });

  function fmtDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1)   return 'à l\'instant';
    if (diffMin < 60)  return `il y a ${diffMin} min`;
    if (diffMin < 1440) return `il y a ${Math.floor(diffMin / 60)}h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  if (!token) return (
    <main className="app-shell">
      <section className="panel"><p>Connecte-toi d'abord.</p></section>
    </main>
  );

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="eyebrow">Centre de notifications</p>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <Bell size={20} color="#facc15" />
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  background: '#ef4444', color: 'white', borderRadius: 99,
                  fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', minWidth: 20, textAlign: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} style={ghostBtn}>
              <RefreshCw size={13} /> Actualiser
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={markingAll} style={primaryBtn}>
                {markingAll ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <CheckCheck size={13} />}
                Tout marquer lu
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['all', 'unread', 'high'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '.78rem',
              border: `1px solid ${filter === f ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.15)'}`,
              background: filter === f ? 'rgba(250,204,21,.08)' : 'none',
              color: filter === f ? '#facc15' : '#64748b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <Filter size={11} />
            {f === 'all' ? `Toutes (${notifications.length})` :
             f === 'unread' ? `Non lues (${unreadCount})` : 'Haute priorité'}
          </button>
        ))}
      </div>

      {/* List */}
      <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 size={24} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <CheckCheck size={32} color="#22c55e" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ color: '#64748b', margin: 0, fontSize: '.88rem' }}>
              {filter === 'unread' ? 'Aucune notification non lue' :
               filter === 'high'   ? 'Aucune notification haute priorité' :
               'Aucune notification'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((n, idx) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 20px',
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(148,163,184,.06)' : 'none',
                background: n.is_read ? 'transparent' : 'rgba(250,204,21,.02)',
                transition: 'background .15s',
              }}>
                {/* Priority dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                  background: PRIORITY_COLOR[n.priority] || '#64748b',
                  boxShadow: !n.is_read ? `0 0 8px ${PRIORITY_COLOR[n.priority] || '#64748b'}` : 'none',
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontWeight: n.is_read ? 600 : 800,
                      fontSize: '.85rem',
                      color: n.is_read ? '#94a3b8' : '#f1f5f9',
                    }}>{n.title}</span>
                    <span style={{
                      fontSize: '.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: `${PRIORITY_COLOR[n.priority]}15`,
                      color: PRIORITY_COLOR[n.priority],
                      border: `1px solid ${PRIORITY_COLOR[n.priority]}25`,
                    }}>
                      {PRIORITY_LABEL[n.priority] || n.priority}
                    </span>
                    {!n.is_read && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#3b82f6', flexShrink: 0,
                      }} />
                    )}
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '.78rem', color: '#64748b', lineHeight: 1.5 }}>
                    {n.detail}
                  </p>
                  <span style={{ fontSize: '.68rem', color: '#475569' }}>
                    {fmtDate(n.created_at)}
                    {n.source && <span style={{ marginLeft: 8 }}>· {n.source}</span>}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} title="Marquer comme lu"
                      style={iconBtn('#22c55e')}>
                      <Check size={13} />
                    </button>
                  )}
                  <button onClick={() => deleteNotif(n.id)} title="Supprimer"
                    style={iconBtn('#ef4444')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          main.app-shell > div:nth-child(2) { flex-wrap: wrap; }
        }
      `}</style>
    </main>
  );
}

const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '7px 12px', borderRadius: 8,
  border: '1px solid rgba(148,163,184,.15)',
  background: 'none', color: '#64748b', cursor: 'pointer',
  fontSize: '.78rem', fontWeight: 600,
};
const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 8, border: 'none',
  background: 'rgba(34,197,94,.12)', color: '#86efac',
  cursor: 'pointer', fontSize: '.78rem', fontWeight: 700,
};
const iconBtn = (color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${color}20`,
  background: `${color}08`,
  color, cursor: 'pointer',
});
