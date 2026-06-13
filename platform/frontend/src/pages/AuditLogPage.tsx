import { useI18n } from '../i18n';
import { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../api/config';
import {
  Search, Download, RefreshCw, ChevronLeft, ChevronRight,
  Filter, Shield, Clock, User, Tag,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface AuditLog {
  id: number;
  created_at: string;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  resource_label: string | null;
  user_email: string | null;
  actor_name: string | null;
  detail: string | null;
  status: string;
}

const ACTION_COLORS: Record<string, string> = {
  create:   '#86efac',
  update:   '#93c5fd',
  delete:   '#fca5a5',
  approve:  '#a78bfa',
  login:    '#fde68a',
  logout:   '#94a3b8',
  export:   '#67e8f9',
};

const STATUS_COLORS: Record<string, string> = {
  success: 'rgba(34,197,94,.12)',
  error:   'rgba(239,68,68,.12)',
  warning: 'rgba(245,158,11,.12)',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  
  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (filterAction) p.set('action', filterAction);
    if (filterType) p.set('resource_type', filterType);
    if (search) p.set('user', search);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return p;
  }, [filterAction, filterType, search, dateFrom, dateTo]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = buildParams();
      params.set('skip', String(p * PAGE_SIZE));
      params.set('limit', String(PAGE_SIZE));
      const [data, countData] = await Promise.all([
        apiRequest<AuditLog[]>(`/audit-logs?${params}`, {}, token),
        apiRequest<{ total: number }>(`/audit-logs/count?${buildParams()}`, {}, token),
      ]);
      setLogs(data);
      setTotal(countData.total);
    } finally {
      setLoading(false);
    }
  }, [buildParams, token]);

  useEffect(() => {
    setPage(0);
    load(0);
  }, [filterAction, filterType, search, dateFrom, dateTo]);

  const changePage = (p: number) => { setPage(p); load(p); };

  const exportCSV = () => {
    const params = buildParams();
    window.open(`${API_BASE}/audit-logs/export/csv?${params}&token_header=${token}`, '_blank');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const actionColor = (a: string) => ACTION_COLORS[a?.toLowerCase()] || '#94a3b8';
  const statusBg = (s: string) => STATUS_COLORS[s] || 'rgba(148,163,184,.08)';

  const s = {
    page: { padding: 'clamp(14px,3vw,28px) clamp(12px,3vw,32px)', maxWidth: 1200, margin: '0 auto' } as React.CSSProperties,
    card: { background: 'rgba(15,30,54,.85)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
    input: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: '.82rem', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    select: { background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: '.82rem', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Shield size={20} color="#facc15" />
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-.02em' }}>
            Journal d'audit
          </h1>
          <p style={{ fontSize: '.8rem', color: '#64748b', marginTop: 2 }}>
            {total.toLocaleString('fr-FR')} événement{total > 1 ? 's' : ''} — traçabilité complète
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => load(page)} style={{ ...s.input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', paddingInline: 12 }}>
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(250,204,21,.1)', color: '#facc15', cursor: 'pointer', fontSize: '.8rem', fontWeight: 700 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...s.card, padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px' }}>
          <Search size={14} color="#64748b" />
          <input
            style={{ ...s.input, flex: 1 }}
            placeholder="Rechercher par utilisateur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select style={s.select} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          {['create', 'update', 'delete', 'approve', 'login', 'logout', 'export'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select style={s.select} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          {['tender', 'deliverable', 'opportunity', 'contact', 'agent_action', 'user', 'organization'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="#64748b" />
          <input type="date" style={s.input} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Date début" />
          <span style={{ color: '#64748b', fontSize: '.8rem' }}>→</span>
          <input type="date" style={s.input} value={dateTo} onChange={e => setDateTo(e.target.value)} title="Date fin" />
        </div>
        {(search || filterAction || filterType || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setFilterAction(''); setFilterType(''); setDateFrom(''); setDateTo(''); }}
            style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: '#fca5a5', cursor: 'pointer', fontSize: '.76rem' }}
          >
            Effacer filtres
          </button>
        )}
      </div>

      {/* Table */}
      <div style={s.card}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,.1)', background: 'rgba(255,255,255,.02)' }}>
                {['Date', 'Action', 'Ressource', 'Utilisateur', 'Détail', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '.84rem' }}>Aucun événement trouvé.</td></tr>
              )}
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(148,163,184,.06)', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={11} color="#475569" />
                      <span style={{ fontFamily: 'monospace', fontSize: '.73rem', color: '#94a3b8' }}>{log.created_at ? fmt(log.created_at) : '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '.7rem', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(255,255,255,.05)', color: actionColor(log.action), border: `1px solid ${actionColor(log.action)}40` }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {log.resource_type && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag size={11} color="#64748b" />
                        <span style={{ fontSize: '.77rem', color: '#94a3b8' }}>
                          {log.resource_type}
                          {log.resource_id ? <span style={{ color: '#475569' }}>#{log.resource_id}</span> : null}
                        </span>
                        {log.resource_label && <span style={{ fontSize: '.74rem', color: '#64748b' }}>— {log.resource_label.slice(0, 32)}</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={11} color="#64748b" />
                      <span style={{ fontSize: '.77rem', color: '#94a3b8' }}>{log.actor_name || log.user_email || '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 14px', maxWidth: 260 }}>
                    <span style={{ fontSize: '.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {log.detail || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '.68rem', fontWeight: 600, fontFamily: 'monospace', background: statusBg(log.status), color: log.status === 'success' ? '#86efac' : log.status === 'error' ? '#fca5a5' : '#fde68a' }}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,.08)', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '.76rem', color: '#64748b' }}>
              Page {page + 1} / {totalPages} · {total} entrées
            </span>
            <button onClick={() => changePage(page - 1)} disabled={page === 0} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? '#475569' : '#94a3b8' }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => changePage(page + 1)} disabled={page >= totalPages - 1} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: page >= totalPages - 1 ? '#475569' : '#94a3b8' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
