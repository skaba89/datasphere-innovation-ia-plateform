/**
 * AgentLiveFeed — Flux temps réel des actions agents
 *
 * Affiche les dernières actions agents en temps réel :
 *   - Rafraîchissement auto toutes les 10s
 *   - Mise à jour SSE sur chaque workflow event
 *   - Filtres : toutes / en_cours / validations_requises
 *   - Actions inline : approuver
 */

import { useEffect, useState } from 'react';
import { Bot, CheckCircle, Clock, Loader2, RefreshCw, ThumbsUp, Zap } from 'lucide-react';
import { apiRequest } from '../api/client';

interface AgentAction {
  id:                      number;
  action_type:             string;
  status:                  string;
  output_summary?:         string;
  requires_human_approval: boolean;
  created_at:              string;
  assignment?: {
    agent?: { name: string; slug: string };
    objective?: string;
  };
}

const STATUS_COLOR: Record<string, string> = {
  suggested:  '#64748b',
  auto_ready: '#3b82f6',
  executing:  '#8b5cf6',
  awaiting:   '#facc15',
  done:       '#22c55e',
  failed:     '#ef4444',
  skipped:    '#475569',
};

const STATUS_LABEL: Record<string, string> = {
  suggested:  'Planifiée',
  auto_ready: 'Prête',
  executing:  'En cours…',
  awaiting:   'Validation requise',
  done:       'Terminée',
  failed:     'Échouée',
  skipped:    'Ignorée',
};

const ACTION_EMOJI: Record<string, string> = {
  context_analysis:     '🔍',
  tender_requirements_review: '📋',
  deliverable_plan:     '📐',
  compliance_matrix:    '✅',
  commercial_proposal:  '💼',
  human_review:         '👁️',
  go_no_go_analysis:    '⚖️',
  staffing_plan:        '👥',
};

function timeAgo(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const m   = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (m < 1)   return 'à l\'instant';
  if (m < 60)  return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.floor(m / 60)}h`;
  return d.toLocaleDateString('fr-FR');
}

export default function AgentLiveFeed({
  token, tenderId,
}: {
  token: string | null;
  tenderId?: number;
}) {
  const [actions,  setActions]  = useState<AgentAction[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all' | 'active' | 'awaiting'>('all');
  const [approving, setApproving] = useState<number | null>(null);

  async function load() {
    try {
      const params = tenderId ? `?tender_id=${tenderId}&limit=20` : '?limit=20';
      const data = await apiRequest<AgentAction[]>(`/agents/actions/list${params}`, {}, token);
      setActions(data ?? []);
    } catch {
      setActions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [tenderId, token]);

  async function approve(id: number) {
    setApproving(id);
    try {
      await apiRequest(`/agents/actions/${id}/approve`, { method: 'POST' }, token);
      await load();
    } finally {
      setApproving(null);
    }
  }

  const filtered = actions.filter(a => {
    if (filter === 'active')   return ['executing', 'auto_ready'].includes(a.status);
    if (filter === 'awaiting') return a.status === 'awaiting';
    return true;
  });

  const awaitingCount = actions.filter(a => a.status === 'awaiting').length;
  const activeCount   = actions.filter(a => ['executing', 'auto_ready'].includes(a.status)).length;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { key: 'all',      label: `Toutes (${actions.length})` },
          { key: 'active',   label: `En cours (${activeCount})` },
          { key: 'awaiting', label: `Validation (${awaitingCount})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: '4px 10px', borderRadius: 7, fontWeight: 700, fontSize: '.72rem',
              border: `1px solid ${filter === f.key ? 'rgba(250,204,21,.35)' : 'rgba(148,163,184,.12)'}`,
              background: filter === f.key ? 'rgba(250,204,21,.06)' : 'none',
              color: filter === f.key ? '#facc15' : '#64748b', cursor: 'pointer',
            }}>
            {f.label}
            {f.key === 'awaiting' && awaitingCount > 0 && (
              <span style={{ marginLeft: 4, background: '#ef4444', color: 'white', borderRadius: 99, padding: '0 4px', fontSize: '.65rem' }}>
                !
              </span>
            )}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 7, border: '1px solid rgba(148,163,184,.1)', background: 'none', color: '#475569', cursor: 'pointer' }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Loader2 size={16} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <Bot size={24} color="#334155" style={{ margin: '0 auto 8px', display: 'block' }} />
          <p style={{ color: '#475569', fontSize: '.78rem', margin: 0 }}>
            {filter === 'awaiting' ? 'Aucune validation en attente' :
             filter === 'active'   ? 'Aucune action en cours' :
             'Aucune action agent récente'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(action => {
            const color   = STATUS_COLOR[action.status] || '#64748b';
            const emoji   = ACTION_EMOJI[action.action_type] || '⚙️';
            const agName  = action.assignment?.agent?.name || 'Agent';
            const isLive  = action.status === 'executing';

            return (
              <div key={action.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 9,
                background: action.status === 'awaiting' ? 'rgba(250,204,21,.03)' : 'rgba(255,255,255,.015)',
                border: `1px solid ${action.status === 'awaiting' ? 'rgba(250,204,21,.12)' : 'rgba(148,163,184,.06)'}`,
              }}>
                {/* Icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `${color}10`, border: `1.5px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {isLive ? (
                    <Loader2 size={14} color={color} style={{ animation: 'spin .7s linear infinite' }} />
                  ) : emoji}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#e2e8f0' }}>
                      {action.action_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      fontSize: '.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                      background: `${color}15`, color,
                    }}>
                      {STATUS_LABEL[action.status] || action.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '.72rem', color: '#64748b' }}>
                    <Bot size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    {agName}
                    {action.assignment?.objective && (
                      <span style={{ marginLeft: 6, color: '#475569' }}>
                        · {action.assignment.objective.slice(0, 50)}
                      </span>
                    )}
                  </div>
                  {action.output_summary && (
                    <p style={{ margin: '4px 0 0', fontSize: '.73rem', color: '#64748b', lineHeight: 1.5 }}>
                      {action.output_summary.slice(0, 120)}…
                    </p>
                  )}
                </div>

                {/* Time + actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: '.65rem', color: '#475569' }}>
                    {timeAgo(action.created_at)}
                  </span>
                  {action.status === 'awaiting' && action.requires_human_approval && (
                    <button onClick={() => approve(action.id)} disabled={approving === action.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(34,197,94,.25)', background: 'rgba(34,197,94,.06)', color: '#86efac', cursor: 'pointer', fontWeight: 700, fontSize: '.7rem' }}>
                      {approving === action.id ? <Loader2 size={10} style={{ animation: 'spin .7s linear infinite' }} /> : <ThumbsUp size={10} />}
                      Valider
                    </button>
                  )}
                  {action.status === 'done' && (
                    <CheckCircle size={14} color="#22c55e" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
