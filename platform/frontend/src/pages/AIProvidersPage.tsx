/**
 * AIProvidersPage — Configuration des providers LLM premium
 */
import { useEffect, useState } from 'react';
import {
  Brain, CheckCircle2, ChevronRight, Clock, Cpu, Eye, EyeOff,
  Globe, RefreshCw, Sparkles, TrendingUp, Zap, AlertTriangle, Star,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface ProviderStatus {
  name: string;
  label: string;
  available: boolean;
  is_free: boolean;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'premium' | 'good' | 'basic';
  models: string[];
  cost: string;
  priority: number;
}

interface TestResult { provider: string; ok: boolean; latency_ms: number; response: string; error?: string; }

const PROVIDER_META: Record<string, { icon: string; desc: string; docs: string; badgeColor: string }> = {
  glm:        { icon: '🇨🇳', desc: 'ZhipuAI GLM-4-Flash · 100% gratuit · Excellent multilingue', docs: 'https://open.bigmodel.cn', badgeColor: '#22c55e' },
  groq:       { icon: '⚡', desc: 'Llama 3 & Mixtral sur silicium dédié · Ultra-rapide · Gratuit',  docs: 'https://console.groq.com', badgeColor: '#22c55e' },
  gemini:     { icon: '💎', desc: 'Gemini 2.0 Flash · Google AI · Embeddings gratuits inclus',      docs: 'https://aistudio.google.com', badgeColor: '#22c55e' },
  openrouter: { icon: '🔀', desc: 'Agrégateur · Accès à 100+ modèles · Modèles gratuits disponibles', docs: 'https://openrouter.ai', badgeColor: '#3b82f6' },
  mistral:    { icon: '🇫🇷', desc: 'Mistral Large · Souveraineté européenne · Excellent en français', docs: 'https://mistral.ai', badgeColor: '#f59e0b' },
  openai:     { icon: '🤖', desc: 'GPT-4o · Référence mondiale · Premium',                          docs: 'https://platform.openai.com', badgeColor: '#8b5cf6' },
  anthropic:  { icon: '🧠', desc: 'Claude 3.5 Sonnet · Raisonnement avancé · Premium',             docs: 'https://console.anthropic.com', badgeColor: '#8b5cf6' },
  qwen:       { icon: '🌐', desc: 'Alibaba Qwen · Forte capacité asiatique',                       docs: 'https://dashscope.aliyun.com', badgeColor: '#f59e0b' },
};

const SPEED_CONFIG = {
  fast:   { color: '#22c55e', label: 'Rapide',  icon: '⚡' },
  medium: { color: '#f59e0b', label: 'Moyen',   icon: '🔥' },
  slow:   { color: '#64748b', label: 'Lent',    icon: '🐢' },
};
const QUALITY_CONFIG = {
  premium: { color: '#facc15', label: 'Premium', stars: 5 },
  good:    { color: '#3b82f6', label: 'Bon',     stars: 4 },
  basic:   { color: '#64748b', label: 'Basique', stars: 3 },
};

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={9} fill={i <= count ? '#facc15' : 'transparent'} color={i <= count ? '#facc15' : '#334155'} />
      ))}
    </div>
  );
}

export default function AIProvidersPage() {
  const token = tokenStorage.get();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [testing, setTesting]     = useState<string | null>(null);
  const [results, setResults]     = useState<Record<string, TestResult>>({});
  const [loading, setLoading]     = useState(true);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [showTestPanel, setShowTestPanel]   = useState(false);
  const [testPrompt, setTestPrompt] = useState('Explique la medallion architecture en 3 lignes.');
  const [showKeys, setShowKeys]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiRequest<{providers: ProviderStatus[]; active: string}>('/llm/providers', {}, token)
      .then(d => { setProviders(d.providers ?? []); setActiveProvider(d.active); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function testProvider(name: string) {
    setTesting(name);
    const start = performance.now();
    try {
      const r = await apiRequest<{response:string;provider:string}>('/llm/test', {
        method: 'POST',
        body: JSON.stringify({ provider: name, prompt: testPrompt }),
      }, token);
      setResults(prev => ({ ...prev, [name]: { provider: name, ok: true, latency_ms: Math.round(performance.now() - start), response: r.response } }));
    } catch (e) {
      setResults(prev => ({ ...prev, [name]: { provider: name, ok: false, latency_ms: 0, response: '', error: String(e).slice(0, 100) } }));
    } finally { setTesting(null); }
  }

  async function testAll() {
    for (const p of providers.filter(p => p.available)) {
      await testProvider(p.name);
    }
  }

  const available  = providers.filter(p => p.available).sort((a, b) => a.priority - b.priority);
  const unavailable = providers.filter(p => !p.available);

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px)', maxWidth: 960, display: 'grid', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>Intelligence Artificielle</div>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, letterSpacing: '-.04em', margin: 0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={24} color="#facc15" /> Providers LLM
          </h1>
          <p style={{ color: '#64748b', fontSize: '.84rem', margin: 0 }}>
            {available.length} provider{available.length > 1 ? 's' : ''} actif{available.length > 1 ? 's' : ''} · Fallback automatique en cascade
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowTestPanel(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: `1px solid ${showTestPanel ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.12)'}`, background: showTestPanel ? 'rgba(250,204,21,.08)' : 'none', color: showTestPanel ? '#facc15' : '#64748b', cursor: 'pointer', fontSize: '.82rem', fontWeight: 700 }}>
            <Zap size={14} /> Benchmark
          </button>
        </div>
      </div>

      {/* Active provider banner */}
      {activeProvider && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.15)', borderRadius: 14 }}>
          <Sparkles size={16} color="#facc15" />
          <div>
            <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#fde68a', marginBottom: 2 }}>Provider actif : <strong>{activeProvider}</strong></div>
            <div style={{ fontSize: '.72rem', color: '#64748b' }}>Sélection automatique selon disponibilité des clés API · Fallback cascade</div>
          </div>
          <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,.6)' }} />
        </div>
      )}

      {/* Test panel */}
      {showTestPanel && (
        <div style={{ background: 'rgba(10,18,38,.9)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 16, padding: '20px 22px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '.88rem', fontWeight: 800 }}>Benchmark comparatif</h3>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prompt de test</label>
              <input value={testPrompt} onChange={e => setTestPrompt(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(148,163,184,.12)', color: '#f1f5f9', fontSize: '.83rem', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <button onClick={testAll} disabled={!!testing} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#facc15', color: '#060d1a', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem', opacity: testing ? .6 : 1, whiteSpace: 'nowrap' }}>
              {testing ? <RefreshCw size={14} style={{ animation: 'aiSpin .7s linear infinite' }} /> : <Zap size={14} />}
              {testing ? `Test ${testing}…` : 'Tester tous'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {available.map(p => {
              const r = results[p.name];
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.06)' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{PROVIDER_META[p.name]?.icon ?? '🤖'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r ? 6 : 0 }}>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#e2e8f0' }}>{p.label}</span>
                      {r && (
                        <>
                          <span style={{ fontSize: '.7rem', color: r.ok ? '#86efac' : '#fca5a5', fontWeight: 700 }}>{r.ok ? '✓' : '✗'}</span>
                          {r.ok && <span style={{ fontSize: '.68rem', color: '#64748b' }}>{r.latency_ms}ms</span>}
                        </>
                      )}
                      {testing === p.name && <RefreshCw size={12} color="#64748b" style={{ animation: 'aiSpin .7s linear infinite' }} />}
                    </div>
                    {r?.ok && <p style={{ margin: 0, fontSize: '.74rem', color: '#475569', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{r.response}</p>}
                    {r?.error && <p style={{ margin: 0, fontSize: '.72rem', color: '#fca5a5' }}>{r.error}</p>}
                  </div>
                  <button onClick={() => testProvider(p.name)} disabled={!!testing} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.74rem', flexShrink: 0 }}>
                    Tester
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Providers actifs */}
      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[...Array(4)].map((_,i) => <div key={i} style={{ height: 110, borderRadius: 14, background: 'linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />)}
          <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes aiSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <style>{`@keyframes aiSpin{to{transform:rotate(360deg)}}`}</style>

          {/* Actifs */}
          {available.length > 0 && (
            <div>
              <div style={{ fontSize: '.72rem', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,.6)' }} /> {available.length} provider{available.length > 1 ? 's' : ''} actif{available.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {available.map((p, i) => {
                  const meta = PROVIDER_META[p.name] ?? { icon: '🤖', desc: p.label, docs: '#', badgeColor: '#64748b' };
                  const speed = SPEED_CONFIG[p.speed] ?? SPEED_CONFIG.medium;
                  const quality = QUALITY_CONFIG[p.quality] ?? QUALITY_CONFIG.good;
                  const r = results[p.name];
                  return (
                    <div key={p.name} style={{
                      padding: '18px 20px', borderRadius: 14,
                      background: i === 0 ? 'rgba(250,204,21,.04)' : 'rgba(34,197,94,.02)',
                      border: `1px solid ${i === 0 ? 'rgba(250,204,21,.12)' : 'rgba(34,197,94,.08)'}`,
                      transition: 'all .18s ease',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                          <span style={{ fontSize: '1.4rem' }}>{meta.icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontWeight: 800, fontSize: '.9rem', color: '#f1f5f9' }}>{p.label}</span>
                              {i === 0 && <span style={{ fontSize: '.65rem', padding: '2px 7px', borderRadius: 99, background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.2)', color: '#facc15', fontWeight: 800 }}>PRIORITÉ</span>}
                              {p.is_free && <span style={{ fontSize: '.65rem', padding: '2px 7px', borderRadius: 99, background: `${meta.badgeColor}10`, border: `1px solid ${meta.badgeColor}20`, color: meta.badgeColor, fontWeight: 800 }}>GRATUIT</span>}
                            </div>
                            <p style={{ margin: 0, fontSize: '.74rem', color: '#475569', lineHeight: 1.4 }}>{meta.desc}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Stars count={quality.stars} />
                            <span style={{ fontSize: '.68rem', color: '#475569' }}>{quality.label}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                            <span style={{ fontSize: '.8rem' }}>{speed.icon}</span>
                            <span style={{ fontSize: '.68rem', color: speed.color, fontWeight: 700 }}>{speed.label}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: '.72rem', color: '#475569', fontWeight: 600 }}>Coût</span>
                            <span style={{ fontSize: '.78rem', color: p.cost === '0' ? '#86efac' : '#94a3b8', fontWeight: 700 }}>{p.cost === '0' ? 'Gratuit' : p.cost}</span>
                          </div>
                          {r && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontSize: '.72rem', color: r.ok ? '#86efac' : '#fca5a5', fontWeight: 700 }}>{r.ok ? `✓ ${r.latency_ms}ms` : '✗ Erreur'}</span>
                              <span style={{ fontSize: '.67rem', color: '#334155' }}>dernier test</span>
                            </div>
                          )}
                          <a href={meta.docs} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.74rem', color: '#475569', textDecoration: 'none', padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(148,163,184,.1)', transition: 'all .15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                            <Globe size={12} /> Docs
                          </a>
                        </div>
                      </div>
                      {p.models.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {p.models.slice(0, 4).map(m => (
                            <code key={m} style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,.04)', color: '#64748b', border: '1px solid rgba(148,163,184,.08)', fontFamily: "'JetBrains Mono', monospace" }}>{m}</code>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Non configurés */}
          {unavailable.length > 0 && (
            <div>
              <div style={{ fontSize: '.72rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
                {unavailable.length} provider{unavailable.length > 1 ? 's' : ''} non configuré{unavailable.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
                {unavailable.map(p => {
                  const meta = PROVIDER_META[p.name] ?? { icon: '🤖', desc: p.label, docs: '#', badgeColor: '#64748b' };
                  return (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 12, background: 'rgba(255,255,255,.01)', border: '1px solid rgba(148,163,184,.06)', opacity: .7 }}>
                      <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>{p.label}</div>
                        <div style={{ fontSize: '.7rem', color: '#334155' }}>Clé API manquante dans Render</div>
                      </div>
                      <a href={meta.docs} target="_blank" rel="noopener noreferrer" style={{ color: '#334155', textDecoration: 'none', flexShrink: 0 }}>
                        <ChevronRight size={14} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
