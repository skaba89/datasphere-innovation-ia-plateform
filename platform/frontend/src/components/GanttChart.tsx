import { useEffect, useState } from 'react';
import { Activity, Clock, RefreshCw } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface ActionBar {
  id: number;
  action_type: string;
  title: string;
  status: string;
  requires_human_approval: boolean;
  approved_by: string | null;
  start: string;
  end: string;
  duration_minutes: number;
}

interface AssignmentRow {
  assignment_id: number;
  agent_name: string;
  context: string;
  objective: string;
  status: string;
  priority: string;
  created_at: string;
  actions: ActionBar[];
  total_actions: number;
  done_actions: number;
}

const STATUS_COLORS: Record<string, string> = {
  done:       '#22c55e',
  approved:   '#3b82f6',
  auto_ready: '#8b5cf6',
  suggested:  '#64748b',
  failed:     '#ef4444',
  in_progress:'#f97316',
};

const PRIORITY_COLORS: Record<string, string> = {
  Haute:   '#ef4444',
  Normale: '#3b82f6',
  Basse:   '#64748b',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const ROW_H = 44;
const LABEL_W = 200;
const CHART_W = 680;
const CHART_TOTAL = LABEL_W + CHART_W + 40;

export default function GanttChart() {
  const [data, setData] = useState<{ assignments: AssignmentRow[]; generated_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    try {
      const d = await apiRequest<any>('/analytics/gantt', {}, token);
      setData(d);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading && !data) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: '0.84rem' }}>
      Chargement du Gantt…
    </div>
  );

  const assignments = data?.assignments ?? [];
  if (assignments.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
      <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucune affectation</div>
      <div style={{ fontSize: '0.84rem' }}>Créez des affectations dans l'onglet Profils consultants.</div>
    </div>
  );

  // Compute time range across all assignments
  const allDates = assignments.flatMap(a =>
    a.actions.flatMap(ac => [new Date(ac.start).getTime(), new Date(ac.end).getTime()])
  ).concat(assignments.map(a => new Date(a.created_at).getTime()));

  const minMs = Math.min(...allDates);
  const maxMs = Math.max(...allDates);
  const rangeMs = Math.max(maxMs - minMs, 3600_000); // at least 1h

  function toX(iso: string): number {
    return LABEL_W + 10 + ((new Date(iso).getTime() - minMs) / rangeMs) * (CHART_W - 20);
  }

  const svgH = assignments.length * ROW_H + 40;

  // Time axis ticks
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const ms = minMs + (rangeMs / (tickCount - 1)) * i;
    return { ms, x: LABEL_W + 10 + (i / (tickCount - 1)) * (CHART_W - 20), label: fmtDate(new Date(ms).toISOString()) };
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Activity size={18} color="#8b5cf6" />
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Gantt des missions</span>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
          {assignments.length} affectation{assignments.length > 1 ? 's' : ''}
        </span>
        <button onClick={load} disabled={loading} style={{
          marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center',
          padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)',
          background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem',
        }}>
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Actualiser
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: '#94a3b8' }}>
            <div style={{ width: 12, height: 10, borderRadius: 3, background: c }} />
            {s}
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', background: 'rgba(7,17,31,0.7)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)', padding: '12px 4px' }}>
        <svg width={CHART_TOTAL} height={svgH} style={{ display: 'block' }}>
          {/* Time axis */}
          <line x1={LABEL_W} y1={28} x2={LABEL_W + CHART_W} y2={28} stroke="rgba(148,163,184,0.15)" />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={24} x2={t.x} y2={svgH} stroke="rgba(148,163,184,0.08)" />
              <text x={t.x} y={18} textAnchor="middle" fill="#475569" fontSize="10" fontFamily="monospace">{t.label}</text>
            </g>
          ))}

          {/* Rows */}
          {assignments.map((row, ri) => {
            const y = 36 + ri * ROW_H;
            const pColor = PRIORITY_COLORS[row.priority] ?? '#64748b';
            const completePct = row.total_actions > 0 ? Math.round(row.done_actions / row.total_actions * 100) : 0;

            return (
              <g key={row.assignment_id}>
                {/* Row background */}
                <rect x={0} y={y} width={CHART_TOTAL} height={ROW_H - 2} fill={ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'} />

                {/* Label column */}
                <text x={6} y={y + 14} fill="#e2e8f0" fontSize="11" fontFamily="DM Sans, system-ui" fontWeight="700">
                  {row.agent_name.length > 22 ? row.agent_name.slice(0, 21) + '…' : row.agent_name}
                </text>
                <text x={6} y={y + 26} fill="#64748b" fontSize="9" fontFamily="DM Sans, system-ui">
                  {row.context.length > 28 ? row.context.slice(0, 27) + '…' : row.context}
                </text>
                {/* Progress mini bar */}
                <rect x={6} y={y + 30} width={90} height={5} rx={2} fill="rgba(148,163,184,0.12)" />
                <rect x={6} y={y + 30} width={completePct * 0.9} height={5} rx={2} fill={pColor} />
                <text x={100} y={y + 36} fill={pColor} fontSize="9" fontFamily="monospace">{completePct}%</text>

                {/* Separator */}
                <line x1={LABEL_W - 4} y1={y} x2={LABEL_W - 4} y2={y + ROW_H - 2} stroke="rgba(148,163,184,0.1)" />

                {/* Action bars */}
                {row.actions.map((action, ai) => {
                  const x1 = toX(action.start);
                  const x2 = Math.max(toX(action.end), x1 + 6);
                  const barW = x2 - x1;
                  const barY = y + 8 + (ai % 2) * 14;
                  const barH = 12;
                  const color = STATUS_COLORS[action.status] ?? '#64748b';

                  return (
                    <g key={action.id}>
                      <title>{`${action.title}\n${action.action_type} — ${action.status}\n${action.duration_minutes}min`}</title>
                      <rect x={x1} y={barY} width={Math.max(barW, 6)} height={barH}
                        rx={3} fill={color} opacity={0.85} />
                      {barW > 30 && (
                        <text x={x1 + 4} y={barY + 9} fill="#fff" fontSize="8" fontFamily="monospace">
                          {action.action_type.replace('_', ' ').slice(0, Math.floor(barW / 6))}
                        </text>
                      )}
                      {action.requires_human_approval && !action.approved_by && (
                        <circle cx={x1 + Math.max(barW, 6) - 5} cy={barY + barH / 2} r={3} fill="#f97316" />
                      )}
                    </g>
                  );
                })}

                {row.actions.length === 0 && (
                  <text x={LABEL_W + 20} y={y + 22} fill="#475569" fontSize="10" fontFamily="DM Sans, system-ui" fontStyle="italic">
                    Aucune action planifiée
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 10, fontSize: '0.74rem', color: '#475569', display: 'flex', gap: 14 }}>
        <span>🟠 Point orange = approbation humaine requise</span>
        <span>Généré : {data?.generated_at ? new Date(data.generated_at).toLocaleString('fr-FR') : '—'}</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
