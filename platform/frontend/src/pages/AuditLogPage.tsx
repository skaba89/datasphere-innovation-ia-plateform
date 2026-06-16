import { useI18n } from '../i18n/index';
/**
 * AuditLogPage — Journal d'audit premium avec search, filtres, export CSV
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, ChevronLeft, ChevronRight,
  Download, Filter, RefreshCw, Search, Shield, User,
  Clock, Terminal,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface AuditLog {
  id: number;
  user_id?: number;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: number;
  details?: string;
  ip_address?: string;
  status: 'success' | 'failure' | 'warning';
  created_at: string;
}

const ACTION_COLOR: Record<string, string> = {
  create: '#22c55e', update: '#3b82f6', delete: '#ef4444',
  login:  '#facc15', logout: '#64748b', export: '#8b5cf6',
  approve:'#22c55e', reject: '#ef4444', generate: '#f59e0b',
};

const STATUS_CONFIG = {
  success: { color: '#22c55e', bg: 'rgba(34,197,94,.08)',  border: 'rgba(34,197,94,.2)',  label: 'Succès'     },
  failure: { color: '#ef4444', bg: 'rgba(239,68,68,.08)',  border: 'rgba(239,68,68,.2)',  label: 'Échec'      },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)', label: 'Avertissement' },
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [logs, setLogs]         = useState<AuditLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [actionFilter, setAction] = useState('all');
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(actionFilter !== 'all' && { action: actionFilter }),
      });
      const data = await apiRequest<{items:AuditLog[];total:number} | AuditLog[]>(`/audit-logs?${params}`, {}, token);
      if (Array.isArray(data)) { setLogs(data); setTotal(data.length); }
      else { setLogs(data.items ?? []); setTotal(data.total ?? 0); }
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, actionFilter, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [search, statusFilter, actionFilter]);

  function exportCSV() {
    const headers = ['ID','Email','Action','Ressource','Statut','IP','Date'];
    const rows = logs.map(l => [
      l.id, l.user_email ?? '', l.action, `${l.resource_type ?? ''}#${l.resource_id ?? ''}`,
      l.status, l.ip_address ?? '', l.created_at,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const actions = ['all', ...new Set(logs.map(l => l.action.split('_')[0]))].slice(0, 10);

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px)', maxWidth: 1100, display: 'grid', gap: 20 }}>
      <style>{`@keyframes auditSpin{to{transform:rotate(360deg)}} @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>Sécurité</div>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, letterSpacing: '-.04em', margin: 0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={24} color="#facc15" /> Journal d&apos;audit
          </h1>
          <p style={{ color: '#64748b', fontSize: '.84rem', margin: 0 }}>
            {total.toLocaleString('fr-FR')} événements enregistrés · Rétention 90 jours
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'auditSpin .7s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(250,204,21,.2)', background: 'rgba(250,204,21,.06)', color: '#facc15', cursor: 'pointer', fontSize: '.82rem', fontWeight: 700 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher action, email, ressource…"
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: 'rgba(255,255,255,.03)', color: '#f1f5f9', fontSize: '.83rem', outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: '#0a1628', color: '#94a3b8', fontSize: '.82rem', cursor: 'pointer' }}>
          <option value="all">Tous statuts</option>
          <option value="success">Succès</option>
          <option value="failure">Échec</option>
          <option value="warning">Avertissement</option>
        </select>
        <select value={actionFilter} onChange={e => setAction(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: '#0a1628', color: '#94a3b8', fontSize: '.82rem', cursor: 'pointer' }}>
          <option value="all">Toutes actions</option>
          {actions.filter(a => a !== 'all').map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 16, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
        {/* Scroll wrapper mobile */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 140px 90px 90px', gap: 0, padding: '10px 16px', borderBottom: '1px solid rgba(148,163,184,.06)', background: 'rgba(255,255,255,.02)', minWidth: 700 }}>
          {['ID','Utilisateur · Action · Ressource','Statut','Date','IP','Détails'].map(h => (
            <div key={h} style={{ fontSize: '.66rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'grid', gap: 6 }}>
            {[...Array(8)].map((_,i) => (
              <div key={i} style={{ height: 44, borderRadius: 8, background: 'linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#334155' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', opacity: .2 }} />
            <p style={{ margin: 0, fontSize: '.86rem' }}>Aucun événement trouvé</p>
          </div>
        ) : (
          <div>
            {logs.map((log, i) => {
              const sc = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.success;
              const actionKey = log.action.split('_')[0];
              const aColor = ACTION_COLOR[actionKey] ?? '#64748b';
              return (
                <div key={log.id} style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr 120px 140px 90px 90px', gap: 0,
                  padding: '11px 16px', alignItems: 'center', minWidth: 680,
                  borderBottom: i < logs.length - 1 ? '1px solid rgba(148,163,184,.04)' : 'none',
                  transition: 'background .12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '.7rem', color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>#{log.id}</span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <User size={10} color="#475569" />
                      <span style={{ fontSize: '.77rem', fontWeight: 600, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{log.user_email ?? 'système'}</span>
                      <span style={{ fontSize: '.72rem', fontFamily: "'JetBrains Mono', monospace", color: aColor, background: `${aColor}10`, padding: '1px 6px', borderRadius: 5, fontWeight: 700 }}>{log.action}</span>
                    </div>
                    {log.resource_type && (
                      <span style={{ fontSize: '.68rem', color: '#334155' }}>{log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ''}</span>
                    )}
                  </div>

                  <div style={{ padding: '2px 8px', borderRadius: 99, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: '.68rem', fontWeight: 700, display: 'inline-block', width: 'fit-content' }}>
                    {sc.label}
                  </div>

                  <span style={{ fontSize: '.71rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} /> {timeAgo(log.created_at)}
                  </span>

                  <span style={{ fontSize: '.7rem', color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{log.ip_address ?? '—'}</span>

                  <span style={{ fontSize: '.7rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details ? log.details.slice(0, 25) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        </div>{/* end scroll wrapper */}
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,.06)', background: 'rgba(255,255,255,.01)' }}>
            <span style={{ fontSize: '.76rem', color: '#475569' }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} sur {total.toLocaleString('fr-FR')}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: page === 0 ? '#1e293b' : '#64748b', cursor: page === 0 ? 'not-allowed' : 'pointer' }}>
                <ChevronLeft size={14} />
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const p = Math.max(0, Math.min(page - 2 + i, totalPages - 5 + i));
                return (
                  <button key={p} onClick={() => setPage(p)} style={{
                    width: 32, height: 32, borderRadius: 8, border: `1px solid ${p === page ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.1)'}`,
                    background: p === page ? 'rgba(250,204,21,.1)' : 'none',
                    color: p === page ? '#facc15' : '#64748b', cursor: 'pointer', fontSize: '.78rem', fontWeight: p === page ? 800 : 500,
                  }}>{p + 1}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: page >= totalPages - 1 ? '#1e293b' : '#64748b', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
