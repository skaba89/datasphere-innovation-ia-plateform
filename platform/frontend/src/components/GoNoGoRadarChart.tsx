import { useEffect, useState } from 'react';
import { apiRequest, tokenStorage } from '../api/client';

interface Criterion {
  id: number;
  name: string;
  score: number;
  weight: number;
  max_score: number;
}

interface Props {
  tenderId: number;
  size?: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#facc15', '#ef4444', '#06b6d4', '#ec4899'];

function polarToCart(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad - Math.PI / 2),
    y: cy + r * Math.sin(angleRad - Math.PI / 2),
  };
}

export default function GoNoGoRadarChart({ tenderId, size = 320 }: Props) {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const token = tokenStorage.get();

  useEffect(() => {
    apiRequest<Criterion[]>(`/tender-governance/tenders/${tenderId}/go-no-go`, {}, token)
      .then(setCriteria)
      .catch(() => setCriteria([]))
      .finally(() => setLoading(false));
  }, [tenderId]);

  if (loading) return <div style={{ textAlign: 'center', color: '#64748b', padding: 20, fontSize: '0.84rem' }}>Chargement du radar…</div>;
  if (criteria.length < 3) return (
    <div style={{ textAlign: 'center', color: '#64748b', padding: 20, fontSize: '0.84rem' }}>
      Ajoutez au moins 3 critères pour afficher le radar.
    </div>
  );

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const n = criteria.length;
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n);

  // Grid levels
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Score points (normalized to 0–1)
  const scorePoints = criteria.map((c, i) => {
    const ratio = Math.min(1, (c.score || 0) / (c.max_score || 10));
    return polarToCart(cx, cy, r * ratio, angles[i]);
  });

  const outerPoints = criteria.map((_, i) => polarToCart(cx, cy, r, angles[i]));

  const scorePath = scorePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // Weighted score percentage
  const totalWeight = criteria.reduce((s, c) => s + (c.weight || 1), 0);
  const weightedScore = criteria.reduce((s, c) => s + ((c.score || 0) * (c.weight || 1)), 0);
  const maxWeighted = criteria.reduce((s, c) => s + ((c.max_score || 10) * (c.weight || 1)), 0);
  const pct = maxWeighted > 0 ? Math.round(weightedScore / maxWeighted * 100) : 0;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id={`radar-fill-${tenderId}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.25" />
          </radialGradient>
        </defs>

        {/* Grid rings */}
        {levels.map((lv) => {
          const pts = angles.map(a => polarToCart(cx, cy, r * lv, a));
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          return (
            <path key={lv} d={d} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
          );
        })}

        {/* Axis lines */}
        {outerPoints.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
        ))}

        {/* Score polygon */}
        <path d={scorePath} fill={`url(#radar-fill-${tenderId})`} stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />

        {/* Score dots */}
        {scorePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={COLORS[i % COLORS.length]} stroke="#0d1f35" strokeWidth="2" />
        ))}

        {/* Axis labels */}
        {criteria.map((c, i) => {
          const labelR = r + 28;
          const lp = polarToCart(cx, cy, labelR, angles[i]);
          const score = c.score ?? 0;
          const max = c.max_score ?? 10;
          const shorter = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name;
          return (
            <g key={i}>
              <text
                x={lp.x} y={lp.y - 4}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="DM Sans, system-ui, sans-serif"
                fontWeight="600"
              >
                {shorter}
              </text>
              <text
                x={lp.x} y={lp.y + 10}
                textAnchor="middle"
                fill={COLORS[i % COLORS.length]}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="700"
              >
                {score}/{max}
              </text>
            </g>
          );
        })}

        {/* Centre score */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#facc15" fontSize="22" fontFamily="monospace" fontWeight="800">{pct}%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="DM Sans, system-ui">score pondéré</text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        {criteria.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: '#94a3b8' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.name}</span>
            <span style={{ color: '#64748b' }}>×{c.weight}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
