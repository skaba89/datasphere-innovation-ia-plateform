/**
 * ScoreBreakdown — Détail visuel du score Go/No-Go
 * Affiche les 5 critères pondérés avec barres de progression colorées.
 */

import { useEffect, useState } from 'react';
import { Loader2, Target } from 'lucide-react';
import { apiRequest } from '../api/client';

interface Criterion {
  key:    string;
  label:  string;
  weight: number;
  score:  number;
  color:  string;
}

interface ScoreData {
  tender_id:      number;
  title:          string;
  decision:       string | null;
  final_score:    number;
  criteria:       Criterion[];
  recommendation: string;
}

export default function ScoreBreakdown({
  tenderId, token,
}: {
  tenderId: number;
  token:    string | null;
}) {
  const [data,    setData]    = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!tenderId || !token) return;
    apiRequest<ScoreData>(`/analytics/tender/${tenderId}/score-breakdown`, {}, token)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [tenderId, token]);

  if (loading) return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <Loader2 size={18} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
    </div>
  );

  if (error || !data) return (
    <p style={{ color: '#64748b', fontSize: '.78rem', padding: 12 }}>Score non disponible</p>
  );

  const scoreColor = data.final_score >= 80 ? '#22c55e' : data.final_score >= 65 ? '#facc15' : data.final_score >= 50 ? '#f97316' : '#ef4444';
  const decisionBg = data.decision === 'go' ? 'rgba(34,197,94,.08)' : data.decision === 'no_go' ? 'rgba(239,68,68,.08)' : 'rgba(148,163,184,.06)';
  const decisionBorder = data.decision === 'go' ? 'rgba(34,197,94,.25)' : data.decision === 'no_go' ? 'rgba(239,68,68,.2)' : 'rgba(148,163,184,.12)';

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Score global */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(${scoreColor} ${data.final_score * 3.6}deg, rgba(148,163,184,.1) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%', background: 'rgba(12,20,37,.95)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
              {data.final_score}
            </span>
            <span style={{ fontSize: '.55rem', color: '#64748b', fontWeight: 600 }}>/100</span>
          </div>
        </div>
        <div>
          <div style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 99, marginBottom: 6,
            background: decisionBg, border: `1px solid ${decisionBorder}`,
            fontSize: '.72rem', fontWeight: 800,
            color: data.decision === 'go' ? '#22c55e' : data.decision === 'no_go' ? '#ef4444' : '#64748b',
          }}>
            {data.decision === 'go' ? '✓ GO' : data.decision === 'no_go' ? '✗ NO GO' : '— EN ATTENTE'}
          </div>
          <p style={{ margin: 0, fontSize: '.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
            {data.recommendation}
          </p>
        </div>
      </div>

      {/* Critères */}
      <div style={{ display: 'grid', gap: 10 }}>
        {data.criteria.map(c => (
          <div key={c.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '.75rem' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                {c.label}
                <span style={{ color: '#475569', marginLeft: 4 }}>({c.weight}%)</span>
              </span>
              <span style={{ fontWeight: 800, color: c.score >= 75 ? '#22c55e' : c.score >= 55 ? '#facc15' : '#ef4444' }}>
                {c.score}/100
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(148,163,184,.08)', borderRadius: 99 }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${c.score}%`,
                background: c.color,
                opacity: 0.85,
                transition: 'width .6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
