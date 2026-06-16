import { useI18n } from '../i18n/index';
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, ChevronLeft, ChevronRight, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { PipelineColumn, PipelineItem } from '../api/domainTypes';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Prospect identifié':  '#64748b',
  'Besoin identifié':    '#94a3b8',
  'Besoin qualifié':     '#3b82f6',
  'Proposition envoyée': '#8b5cf6',
  'Négociation':         '#f97316',
  'Gagnée':              '#22c55e',
  'Perdue':              '#ef4444',
  'Abandonnée':          '#475569',
};

const PRIORITY_DOT: Record<string, string> = {
  Haute:   '#ef4444',
  Normale: '#3b82f6',
  Basse:   '#64748b',
};

function fmtValue(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k €`;
  return `${n} €`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PipelineCard({
  item,
  onMove,
  allStatuses,
  currentStatus,
}: {
  item: PipelineItem;
  onMove: (id: number, newStatus: string) => void;
  allStatuses: string[];
  currentStatus: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const idx = allStatuses.indexOf(currentStatus);
  const prev = idx > 0 ? allStatuses[idx - 1] : null;
  const next = idx < allStatuses.length - 1 ? allStatuses[idx + 1] : null;
  const pColor = PRIORITY_DOT[item.priority] ?? '#64748b';

  return (
    <div style={{
      background: 'rgba(13,31,53,0.9)',
      border: '1px solid rgba(148,163,184,0.12)',
      borderRadius: 12,
      padding: '12px 14px',
      cursor: 'default',
      transition: 'border-color 0.15s',
      position: 'relative',
    }}>
      {/* Priority + org */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: pColor, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.73rem', color: '#64748b' }}>
            <Building2 size={10} />
            {item.org_name}
          </div>
        </div>
      </div>

      {/* Values */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 2 }}>Valeur</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', color: '#facc15' }}>
            {fmtValue(item.potential_value)}
          </div>
        </div>
        <div style={{ flex: 1, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 2 }}>Pipeline</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', color: '#3b82f6' }}>
            {fmtValue(item.pipeline_value)}
          </div>
        </div>
        <div style={{ flex: 1, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: 2 }}>Proba</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', color: '#94a3b8' }}>
            {item.probability}%
          </div>
        </div>
      </div>

      {/* Move buttons */}
      <div style={{ display: 'flex', gap: 5 }}>
        {prev && (
          <button onClick={() => onMove(item.id, prev)} title={`← ${prev}`} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.15)',
            background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.7rem',
          }}>
            <ChevronLeft size={11} /> Reculer
          </button>
        )}
        {next && (
          <button onClick={() => onMove(item.id, next)} title={`→ ${next}`} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '4px 6px', borderRadius: 6, border: 'none',
            background: 'rgba(59,130,246,0.15)', cursor: 'pointer',
            color: '#93c5fd', fontSize: '0.7rem', fontWeight: 600,
          }}>
            Avancer <ChevronRight size={11} />
          </button>
        )}
      </div>

      {item.next_action && (
        <div style={{ marginTop: 7, fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: 5, alignItems: 'flex-start', borderTop: '1px solid rgba(148,163,184,0.06)', paddingTop: 7 }}>
          <ArrowRight size={10} style={{ flexShrink: 0, marginTop: 1, color: '#facc15' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.next_action}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KanbanPipeline() {
  const { t } = useI18n();
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = tokenStorage.get();

  const allStatuses = columns.map(c => c.status);
  const totalPipeline = columns.reduce((s, c) => s + c.pipeline_value, 0);

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await apiRequest<PipelineColumn[]>('/opportunities/pipeline/board', {}, token);
      setColumns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement kanban');
    } finally { setLoading(false); }
  }

  async function moveCard(oppId: number, newStatus: string) {
    try {
      await apiRequest(`/opportunities/${oppId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur déplacement');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Target size={18} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Pipeline commercial</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div style={{
            padding: '6px 14px', borderRadius: 99,
            background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)',
            fontSize: '0.8rem', fontWeight: 700, color: '#facc15', display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <TrendingUp size={12} />
            Pipeline total : {fmtValue(totalPipeline)}
          </div>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 99,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem',
          }}>
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', borderRadius: 8, fontSize: '0.84rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Kanban columns - horizontal scroll */}
      <div style={{ overflowX: 'auto', paddingBottom: 12, WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
        <div style={{ display: 'flex', gap: 14, minWidth: 'min-content' }}>
          {columns.map((col) => {
            const color = STATUS_COLORS[col.status] ?? '#64748b';
            const activeItems = col.items.filter(i => ['Gagnée', 'Perdue', 'Abandonnée'].includes(col.status) || true);
            return (
              <div key={col.status} style={{ width: 220, flexShrink: 0 }}>
                {/* Column header */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px 10px 0 0',
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  borderBottom: `2px solid ${color}`,
                  marginBottom: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color }}>
                      {col.status}
                    </span>
                    <span style={{
                      padding: '2px 7px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800,
                      background: `${color}25`, color,
                    }}>
                      {col.items.length}
                    </span>
                  </div>
                  {col.pipeline_value > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {fmtValue(col.pipeline_value)} pipeline
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div style={{
                  background: 'rgba(7,17,31,0.6)',
                  border: `1px solid ${color}20`,
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  padding: '10px 8px',
                  minHeight: 120,
                  maxHeight: 520,
                  overflowY: 'auto',
                  display: 'grid',
                  gap: 8,
                  alignContent: 'start',
                }}>
                  {col.items.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', padding: '14px 0' }}>
                      Aucune opportunité
                    </div>
                  )}
                  {col.items.map(item => (
                    <PipelineCard
                      key={item.id}
                      item={item}
                      onMove={moveCard}
                      allStatuses={allStatuses}
                      currentStatus={col.status}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
