import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { NotificationItem, PipelineAnalytics } from '../api/domainTypes';

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f97316', low: '#64748b' };
const TYPE_ICONS: Record<string, string> = {
  pending_approval: '🛡',
  review_needed: '📋',
  deadline_approaching: '⏰',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const token = tokenStorage.get();

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<PipelineAnalytics>('/analytics/pipeline', {}, token);
      setNotifications(data.notifications);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const highCount = notifications.filter((n) => n.priority === 'high').length;
  const total = notifications.length;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        style={{
          position: 'relative',
          background: open ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${open ? 'rgba(250,204,21,0.3)' : 'rgba(148,163,184,0.15)'}`,
          borderRadius: 10,
          padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.18s',
          color: open ? '#facc15' : '#94a3b8',
        }}
      >
        <Bell size={16} />
        {total > 0 && (
          <span style={{
            position: 'absolute',
            top: -5, right: -5,
            width: 18, height: 18,
            background: highCount > 0 ? '#ef4444' : '#f97316',
            borderRadius: '50%',
            fontSize: '0.65rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            border: '2px solid #07111f',
          }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 360,
          background: '#0d1f35',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.1)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <Bell size={14} color="#facc15" />
            <span style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>
              Notifications
            </span>
            {total > 0 && (
              <span style={{
                padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
              }}>
                {total} alerte{total > 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading && notifications.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                Chargement…
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <CheckCircle2 size={32} color="#22c55e" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>Tout est à jour</div>
                <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  Aucune action requise pour le moment.
                </div>
              </div>
            )}
            {notifications.map((n, i) => (
              <div key={i} style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(148,163,184,0.06)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: n.priority === 'high' ? 'rgba(239,68,68,0.04)' : 'transparent',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${PRIORITY_COLORS[n.priority]}15`,
                  border: `1px solid ${PRIORITY_COLORS[n.priority]}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem',
                }}>
                  {TYPE_ICONS[n.type] ?? '📌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 3, lineHeight: 1.3 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                    {n.detail}
                  </div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: PRIORITY_COLORS[n.priority],
                  boxShadow: n.priority === 'high' ? `0 0 6px ${PRIORITY_COLORS[n.priority]}` : 'none',
                }} />
              </div>
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid rgba(148,163,184,0.08)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={12} color="#f97316" />
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                {highCount} priorité haute · Auto-refresh 30s
              </span>
              <button
                onClick={load}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  cursor: 'pointer', color: '#64748b', fontSize: '0.74rem',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Clock size={10} />
                Actualiser
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
