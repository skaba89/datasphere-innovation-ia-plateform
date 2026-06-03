import { useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { ActivityItem } from '../api/domainTypes';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  days?: number;
  limit?: number;
  compact?: boolean;
}

export default function ActivityFeed({ days = 7, limit = 20, compact = false }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ items: ActivityItem[]; total: number }>(
        `/activity/feed?days=${days}&limit=${limit}`, {}, token,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);


  if (error) {
    return (
      <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>⚠ {error}</span>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', textDecoration: 'underline', fontSize: '.78rem' }}>Réessayer</button>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{ background: 'rgba(15,30,54,0.85)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <Clock size={14} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>Activité récente</span>
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {items.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
              Aucune activité récente.
            </div>
          )}
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '9px 16px', borderBottom: '1px solid rgba(148,163,184,0.05)',
            }}>
              <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {item.actor} · {fmtTime(item.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Clock size={18} color="#facc15" />
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>Journal d'activité</span>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{total} événement{total > 1 ? 's' : ''} · {days} derniers jours</span>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', gap: 5, alignItems: 'center',
          padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)',
          background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem',
        }}>
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>

      {items.length === 0 && !loading && (
        <div style={{
          padding: '32px', textAlign: 'center',
          background: 'rgba(15,30,54,0.85)', border: '1px solid rgba(148,163,184,0.12)',
          borderRadius: 14, color: '#64748b',
        }}>
          <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucun événement récent</div>
          <div style={{ fontSize: '0.84rem' }}>Les actions de l'équipe et du scheduler apparaîtront ici.</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            padding: '12px 16px',
            background: 'rgba(15,30,54,0.85)',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: 12,
            borderLeft: `3px solid ${item.color}`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: `${item.color}12`, border: `1px solid ${item.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem',
            }}>
              {item.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title}
              </div>
              {item.detail && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.detail}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, fontSize: '0.73rem', color: '#475569', flexWrap: 'wrap' }}>
                <span>👤 {item.actor}</span>
                <span>📂 {item.resource_type}</span>
                <span style={{ marginLeft: 'auto', color: '#64748b' }}>{fmtTime(item.timestamp)}</span>
              </div>
            </div>
            <div style={{
              padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
              background: `${item.color}12`, color: item.color,
              border: `1px solid ${item.color}25`,
            }}>
              {item.action}
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
