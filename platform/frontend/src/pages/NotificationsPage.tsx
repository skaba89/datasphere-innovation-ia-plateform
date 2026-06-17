import EmptyState from '../components/EmptyState';
import { useI18n } from '../i18n/index';
/**
 * NotificationsPage — Centre de notifications premium
 */
import { useEffect, useState } from 'react';
import {
  AlertTriangle, Bell, BellOff, CheckCheck, ChevronRight,
  Clock, Filter, RefreshCw, Trash2, Zap, Bot, FileText,
  Target, Users, Activity, Info,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  link?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  workflow:      { icon: Zap,         color: '#facc15', label: 'Workflow' },
  agent:         { icon: Bot,         color: '#8b5cf6', label: 'Agent IA' },
  deliverable:   { icon: FileText,    color: '#22c55e', label: 'Livrable'  },
  tender:        { icon: Target,      color: '#3b82f6', label: 'AO'        },
  team:          { icon: Users,       color: '#f59e0b', label: 'Équipe'    },
  system:        { icon: Activity,    color: '#64748b', label: 'Système'   },
  approval:      { icon: CheckCheck,  color: '#22c55e', label: 'Validation'},
  alert:         { icon: AlertTriangle,color:'#ef4444', label: 'Alerte'   },
  default:       { icon: Info,        color: '#64748b', label: 'Info'      },
};

const SEV_COLOR: Record<string, string> = {
  info:    'rgba(59,130,246,.08)',
  warning: 'rgba(245,158,11,.08)',
  error:   'rgba(239,68,68,.08)',
  success: 'rgba(34,197,94,.08)',
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'À l\'instant';
  if (diff < 3600) return `${Math.floor(diff/60)}min`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}j`;
}

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [notifs, setNotifs]     = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all'|'unread'|'read'>('all');
  const [typeFilter, setType]   = useState('all');
  const [clearing, setClearing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<Notification[]>('/notifications?limit=50', {}, token);
      setNotifs(Array.isArray(data) ? data : []);
    } catch { setNotifs([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' }, token);
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
    } catch { }
  }

  async function markRead(id: number) {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'POST' }, token);
      setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    } catch { }
  }

  async function clearAll() {
    setClearing(true);
    try {
      await apiRequest('/notifications/clear', { method: 'DELETE' }, token);
      setNotifs([]);
    } catch { }
    finally { setClearing(false); }
  }

  const types = ['all', ...new Set(notifs.map(n => n.type || 'default'))];
  const filtered = notifs.filter(n => {
    if (filter === 'unread' && n.is_read)    return false;
    if (filter === 'read'   && !n.is_read)   return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });
  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px)', maxWidth: 820, display: 'grid', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>Centre</div>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, letterSpacing: '-.04em', margin: 0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{ fontSize: '.7rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontWeight: 800 }}>
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'notifSpin .7s linear infinite' : 'none' }} />
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(34,197,94,.2)', background: 'rgba(34,197,94,.06)', color: '#86efac', cursor: 'pointer', fontSize: '.8rem', fontWeight: 700 }}>
              <CheckCheck size={13} /> Tout marquer lu
            </button>
          )}
          {notifs.length > 0 && (
            <button onClick={clearAll} disabled={clearing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(239,68,68,.15)', background: 'rgba(239,68,68,.04)', color: '#fca5a5', cursor: 'pointer', fontSize: '.8rem', fontWeight: 700 }}>
              <Trash2 size={13} /> Tout effacer
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {(['all','unread','read'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: '.78rem', fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${filter===f?'rgba(250,204,21,.3)':'rgba(148,163,184,.1)'}`,
            background: filter===f?'rgba(250,204,21,.08)':'none',
            color: filter===f?'#facc15':'#64748b',
          }}>
            {f==='all'?'Toutes':f==='unread'?'Non lues':'Lues'}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'rgba(148,163,184,.1)', margin: '0 4px' }} />
        {types.map(t => {
          const cfg = TYPE_CONFIG[t] ?? TYPE_CONFIG.default;
          return (
            <button key={t} onClick={() => setType(t)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${typeFilter===t?`${cfg.color}40`:'rgba(148,163,184,.08)'}`,
              background: typeFilter===t?`${cfg.color}08`:'none',
              color: typeFilter===t?cfg.color:'#64748b',
            }}>
              {t !== 'all' && <cfg.icon size={11} />}
              {t === 'all' ? 'Tous types' : cfg.label}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[...Array(5)].map((_,i) => (
            <div key={i} style={{ height: 72, borderRadius: 12, background: 'linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes notifSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
          description="Vous recevrez des alertes pour les deadlines AOs, les approbations de livrables et les mises à jour de workflow."
        />
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes notifSpin{to{transform:rotate(360deg)}}`}</style>
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default;
            const bg = n.severity ? SEV_COLOR[n.severity] : 'rgba(255,255,255,.02)';
            return (
              <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                  borderRadius: 12, cursor: 'pointer', transition: 'all .15s ease',
                  background: n.is_read ? 'rgba(255,255,255,.015)' : bg || 'rgba(255,255,255,.03)',
                  border: `1px solid ${n.is_read ? 'rgba(148,163,184,.05)' : 'rgba(148,163,184,.1)'}`,
                  opacity: n.is_read ? .7 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? 'rgba(255,255,255,.015)' : (bg || 'rgba(255,255,255,.03)'); e.currentTarget.style.transform = 'none'; }}
              >
                {/* Unread dot */}
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.is_read ? 'transparent' : cfg.color, marginTop: 6, flexShrink: 0, boxShadow: n.is_read ? 'none' : `0 0 6px ${cfg.color}` }} />

                {/* Icon */}
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${cfg.color}10`, border: `1px solid ${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <cfg.icon size={15} color={cfg.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: '.83rem', fontWeight: n.is_read ? 600 : 700, color: n.is_read ? '#94a3b8' : '#f1f5f9', lineHeight: 1.3 }}>{n.title}</div>
                    <span style={{ fontSize: '.68rem', color: '#334155', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '.76rem', color: '#475569', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {n.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ fontSize: '.67rem', padding: '1px 7px', borderRadius: 99, background: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}20`, fontWeight: 700 }}>
                      {cfg.label}
                    </span>
                    {n.link && <span style={{ fontSize: '.68rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}><ChevronRight size={10} /> Voir</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
