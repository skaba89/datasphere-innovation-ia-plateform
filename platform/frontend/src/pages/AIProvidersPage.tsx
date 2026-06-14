import { useEffect, useState } from 'react';
import {
  CheckCircle, ExternalLink, Loader2, RefreshCw, Settings,
  TestTube, XCircle, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface Provider {
  name:        string;
  label:       string;
  active:      boolean;
  configured:  boolean;
  free:        boolean;
  cost_tier:   string;
  recommended: boolean;
  models:      string[];
  signup_url?: string;
  notes?:      string;
}

interface TestResult {
  ok:        boolean;
  latency_ms?: number;
  error?:    string;
  model?:    string;
}

const TIER_COLOR: Record<string, string> = {
  free:     '#22c55e',
  low:      '#3b82f6',
  medium:   '#f59e0b',
  high:     '#ef4444',
};

export default function AIProvidersPage() {
  const token   = tokenStorage.get();
  const [providers,  setProviders]  = useState<Provider[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [testing,    setTesting]    = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [active,     setActive]     = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const [all, act] = await Promise.all([
        apiRequest<Provider[]>('/providers', {}, token),
        apiRequest<{ provider: string }>('/providers/active', {}, token),
      ]);
      setProviders(all ?? []);
      setActive(act?.provider ?? '');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function testProvider(name: string) {
    setTesting(name);
    try {
      const t0   = Date.now();
      const res  = await apiRequest<{ ok: boolean; model?: string; error?: string }>(
        `/providers/${name}/test`, { method: 'POST' }, token
      );
      setTestResults(prev => ({
        ...prev,
        [name]: { ...res, latency_ms: Date.now() - t0 },
      }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [name]: { ok: false, error: String(e) } }));
    } finally {
      setTesting(null);
    }
  }

  if (!token) return (
    <main className="app-shell"><section className="panel"><p>Connecte-toi d'abord.</p></section></main>
  );

  const safeProviders = Array.isArray(providers) ? providers : [];
  const free    = safeProviders.filter(p => p.free);
  const premium = safeProviders.filter(p => !p.free);

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="eyebrow">Intelligence Artificielle</p>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <Zap size={20} color="#facc15" />
              Providers LLM
            </h1>
            <p style={{ color: '#64748b', fontSize: '.82rem', margin: '4px 0 0' }}>
              {safeProviders.filter(p => p.configured).length}/{safeProviders.length} configurés — Provider actif : <strong style={{ color: '#facc15' }}>{active || 'simulation'}</strong>
            </p>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem' }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
      </section>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* Free providers */}
          {free.length > 0 && (
            <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '.82rem', color: '#22c55e' }}>✨ Gratuits</span>
                <span style={{ fontSize: '.7rem', color: '#64748b' }}>Recommandés pour démarrer</span>
              </div>
              {free.map(p => <ProviderCard key={p.name} p={p} active={active} testing={testing} testResult={testResults[p.name]} onTest={testProvider} />)}
            </section>
          )}

          {/* Premium providers */}
          {premium.length > 0 && (
            <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '.82rem', color: '#f59e0b' }}>💳 Payants</span>
                <span style={{ fontSize: '.7rem', color: '#64748b' }}>Performances supérieures</span>
              </div>
              {premium.map(p => <ProviderCard key={p.name} p={p} active={active} testing={testing} testResult={testResults[p.name]} onTest={testProvider} />)}
            </section>
          )}

          {/* Config guide */}
          <section className="panel" style={{ padding: '16px 20px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '.82rem', fontWeight: 800, color: '#64748b' }}>
              <Settings size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              CONFIGURATION — Variables d'environnement Render
            </h3>
            <div style={{ fontFamily: 'monospace', fontSize: '.76rem', color: '#94a3b8', lineHeight: 2 }}>
              <div><span style={{ color: '#22c55e' }}>GROQ_API_KEY</span>=gsk_...   <span style={{ color: '#475569' }}># Gratuit · Rapide · Recommandé</span></div>
              <div><span style={{ color: '#60a5fa' }}>GEMINI_API_KEY</span>=AIza... <span style={{ color: '#475569' }}># Google · Gratuit tier disponible</span></div>
              <div><span style={{ color: '#a78bfa' }}>OPENAI_API_KEY</span>=sk-...  <span style={{ color: '#475569' }}># GPT-4o · Payant</span></div>
              <div><span style={{ color: '#f97316' }}>ANTHROPIC_API_KEY</span>=sk-ant-... <span style={{ color: '#475569' }}># Claude 3.5 · Payant</span></div>
              <div><span style={{ color: '#34d399' }}>MISTRAL_API_KEY</span>=...    <span style={{ color: '#475569' }}># Français · Payant</span></div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '.73rem', color: '#475569' }}>
              Le provider actif est sélectionné automatiquement dans l'ordre de priorité (Groq → Gemini → OpenAI → ...).
            </p>
          </section>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function ProviderCard({ p, active, testing, testResult, onTest }: {
  p:          Provider;
  active:     string;
  testing:    string | null;
  testResult?: TestResult;
  onTest:     (name: string) => void;
}) {
  const isActive = p.name === active;
  const tierC    = TIER_COLOR[p.cost_tier] || '#64748b';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px',
      borderBottom: '1px solid rgba(148,163,184,.05)',
      background: isActive ? 'rgba(250,204,21,.02)' : 'transparent',
    }}>
      {/* Status dot */}
      <div style={{ paddingTop: 4 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: p.configured ? '#22c55e' : '#334155',
          boxShadow: p.configured ? '0 0 8px #22c55e66' : 'none',
          flexShrink: 0,
        }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '.88rem', color: isActive ? '#facc15' : '#e2e8f0' }}>
            {p.label}
            {isActive && <span style={{ marginLeft: 6, fontSize: '.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(250,204,21,.15)', color: '#facc15' }}>ACTIF</span>}
          </span>
          {p.recommended && <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,.12)', color: '#93c5fd' }}>⭐ Recommandé</span>}
          <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${tierC}15`, color: tierC }}>
            {p.free ? 'GRATUIT' : p.cost_tier?.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: '.73rem', color: '#64748b' }}>
          {p.models?.slice(0, 2).join(' · ')}
          {p.notes && <span style={{ marginLeft: 6, color: '#475569' }}>— {p.notes}</span>}
        </div>
        {testResult && (
          <div style={{ marginTop: 6, fontSize: '.72rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            {testResult.ok ? (
              <><CheckCircle size={12} color="#22c55e" /> <span style={{ color: '#22c55e' }}>OK {testResult.latency_ms}ms</span> {testResult.model && <span style={{ color: '#475569' }}>· {testResult.model}</span>}</>
            ) : (
              <><XCircle size={12} color="#ef4444" /> <span style={{ color: '#fca5a5' }}>{testResult.error?.slice(0, 80)}</span></>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        {p.signup_url && !p.configured && (
          <a href={p.signup_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'rgba(255,255,255,.03)', color: '#64748b', textDecoration: 'none', fontSize: '.72rem', fontWeight: 600 }}>
            <ExternalLink size={11} /> API Key
          </a>
        )}
        {p.configured && (
          <button onClick={() => onTest(p.name)} disabled={testing === p.name}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(59,130,246,.25)', background: 'rgba(59,130,246,.06)', color: '#93c5fd', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}>
            {testing === p.name ? <Loader2 size={11} style={{ animation: 'spin .7s linear infinite' }} /> : <TestTube size={11} />}
            Tester
          </button>
        )}
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.configured ? '#22c55e' : '#334155', flexShrink: 0 }} title={p.configured ? 'Configuré' : 'Non configuré'} />
      </div>
    </div>
  );
}
