/**
 * DashboardCharts — Graphiques analytiques pour le dashboard
 * Utilise recharts (disponible dans l'environnement)
 */

import { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { apiRequest } from '../api/client';

interface MonthData {
  month: string;
  ao_detectes: number;
  wf_completes: number;
  livrables: number;
  gagnes: number;
  taux_succes: number;
}

interface TimelineData {
  months: MonthData[];
  totals: { ao_detectes: number; wf_completes: number; livrables: number; gagnes: number };
}

const gold = '#facc15';
const blue = '#3b82f6';
const green = '#22c55e';
const purple = '#8b5cf6';

export function DashboardCharts({ token }: { token: string | null }) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiRequest<TimelineData>('/analytics/timeline', {}, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center', color: '#334155', fontSize: '.82rem' }}>
      Chargement des graphiques…
    </div>
  );

  if (!data) return null;

  const hasData = data.months.some(m => m.ao_detectes > 0 || m.wf_completes > 0);

  return (
    <section style={{ background: 'rgba(12,20,37,.92)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 16, padding: '20px 22px', marginBottom: 20 }}>
      {/* Header KPIs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
          Activité 12 mois
        </h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'AOs détectés', value: data.totals.ao_detectes, color: blue },
            { label: 'Workflows', value: data.totals.wf_completes, color: purple },
            { label: 'Livrables', value: data.totals.livrables, color: gold },
            { label: 'Gagnés', value: data.totals.gagnes, color: green },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '.66rem', color: '#475569', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#334155', fontSize: '.82rem', background: 'rgba(0,0,0,.15)', borderRadius: 10 }}>
          Les graphiques s'alimenteront avec vos données réelles (AOs importés, workflows lancés).
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* AOs & Workflows over time */}
          <div>
            <div style={{ fontSize: '.74rem', color: '#64748b', marginBottom: 10, fontWeight: 700 }}>AOs détectés vs Workflows complétés</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.months} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="wfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={purple} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, fontSize: '.78rem' }} />
                <Area type="monotone" dataKey="ao_detectes" name="AOs" stroke={blue} fill="url(#aoGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="wf_completes" name="Workflows" stroke={purple} fill="url(#wfGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Livrables & Gagnés */}
          <div>
            <div style={{ fontSize: '.74rem', color: '#64748b', marginBottom: 10, fontWeight: 700 }}>Livrables générés vs AOs gagnés</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.months} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, fontSize: '.78rem' }} />
                <Bar dataKey="livrables" name="Livrables" fill={gold} radius={[4, 4, 0, 0]} opacity={0.8} />
                <Bar dataKey="gagnes" name="Gagnés" fill={green} radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
