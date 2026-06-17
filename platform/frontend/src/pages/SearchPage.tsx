import EmptyState from '../components/EmptyState';
import { useI18n } from '../i18n/index';
/**
 * SearchPage — Recherche globale enrichie
 * Debounce 300ms · Highlight termes · RAG sémantique · Navigation directe
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Brain, Building2, Clock, FileText,
  Loader2, Search, Target, TrendingUp, Users, X, Zap,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface SearchResult {
  entity_type: 'organization' | 'opportunity' | 'tender' | 'deliverable' | 'contact';
  id: number;
  title: string;
  subtitle?: string;
  meta?: string;
  score?: number;
  status?: string;
}
interface SearchResponse { query: string; total: number; results: SearchResult[]; }
interface RagTender { id: number; title: string; buyer?: string; score: number; source: string; go_score?: number; }
interface RagResult  { deliverables: any[]; tenders: RagTender[]; }

const ENTITY_META: Record<string, { icon: React.ElementType; color: string; label: string; nav: string }> = {
  organization: { icon: Building2,  color: '#60a5fa', label: 'Organisation', nav: 'crm'       },
  opportunity:  { icon: TrendingUp, color: '#a78bfa', label: 'Opportunité',  nav: 'commercial' },
  tender:       { icon: Target,     color: '#facc15', label: "Appel d'offres", nav: 'tenders' },
  deliverable:  { icon: FileText,   color: '#34d399', label: 'Livrable',     nav: 'deliverables' },
  contact:      { icon: Users,      color: '#f97316', label: 'Contact',      nav: 'crm'       },
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#64748b', review: '#f59e0b', approved: '#22c55e',
  submitted: '#3b82f6', won: '#22c55e', lost: '#ef4444',
  go: '#22c55e', 'no-go': '#ef4444',
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length >= 2);
  if (!words.length) return text;
  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} style={{ background: 'rgba(250,204,21,.25)', color: '#facc15', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
      : part
  );
}

export default function SearchPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [ragResult,setRag]      = useState<RagResult | null>(null);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [showRag,  setShowRag]  = useState(false);
  const [recent,   setRecent]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ds_search_history') || '[]'); } catch { return []; }
  });
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function saveRecent(q: string) {
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 8);
    setRecent(updated);
    try { localStorage.setItem('ds_search_history', JSON.stringify(updated)); } catch {}
  }

  async function search(q: string) {
    if (!q || q.length < 2) { setResults([]); setSearched(false); setRag(null); return; }
    setLoading(true);
    try {
      const [data, ragData] = await Promise.allSettled([
        apiRequest<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=20`, {}, token),
        apiRequest<RagResult>(`/rag/search?q=${encodeURIComponent(q)}&limit=4`, {}, token),
      ]);
      if (data.status === 'fulfilled') {
        setResults(data.value?.results ?? []);
        setTotal(data.value?.total ?? 0);
      }
      if (ragData.status === 'fulfilled') setRag(ragData.value);
      setSearched(true);
      saveRecent(q);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function onInput(val: string) {
    setQuery(val);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    if (val.length >= 2) {
      debounceRef.current = setTimeout(() => search(val), 300);
    } else {
      setResults([]); setSearched(false); setRag(null);
    }
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.entity_type]) acc[r.entity_type] = [];
    acc[r.entity_type].push(r);
    return acc;
  }, {});

  const entityOrder = ['tender', 'deliverable', 'opportunity', 'organization', 'contact'];
  const hasRagResults = (ragData: RagResult | null): boolean => !!(ragData && (ragData.deliverables?.length || ragData.tenders?.length));

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(20px,3vw,40px) clamp(12px,3vw,24px)', display: 'grid', gap: 16 }}>

      {/* Barre de recherche */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading
            ? <Loader2 size={18} color="#facc15" style={{ animation: 'srchSpin .7s linear infinite' }} />
            : <Search size={18} color="#64748b" />}
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => onInput(e.target.value)}
          placeholder="Rechercher un AO, livrable, client, contact…"
          style={{
            width: '100%', padding: '15px 48px 15px 50px', boxSizing: 'border-box',
            background: 'rgba(12,22,45,.9)',
            border: `1.5px solid ${query.length >= 2 ? 'rgba(250,204,21,.35)' : 'rgba(148,163,184,.15)'}`,
            borderRadius: 14, color: '#f1f5f9', fontSize: '1rem', outline: 'none',
            backdropFilter: 'blur(16px)',
            boxShadow: query.length >= 2 ? '0 0 0 3px rgba(250,204,21,.08)' : 'none',
            transition: 'all .18s ease',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setSearched(false); setRag(null); inputRef.current?.focus(); }}
            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Meta résultats */}
      {searched && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '.8rem', color: '#475569' }}>
          <span>{total} résultat{total > 1 ? 's' : ''} pour <strong style={{ color: '#94a3b8' }}>« {query} »</strong></span>
          {hasRagResults(ragResult) && (
            <button onClick={() => setShowRag(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, border: `1px solid ${showRag ? 'rgba(139,92,246,.4)' : 'rgba(139,92,246,.2)'}`, background: showRag ? 'rgba(139,92,246,.1)' : 'none', color: '#c4b5fd', cursor: 'pointer', fontSize: '.74rem', fontWeight: 700 }}>
              <Brain size={11} /> {showRag ? 'Masquer' : 'Voir'} résultats IA
            </button>
          )}
        </div>
      )}

      {/* RAG sémantique */}
      {showRag && ragResult && hasRagResults(ragResult) && (
        <div style={{ background: 'rgba(139,92,246,.05)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Brain size={14} color="#8b5cf6" />
            <span style={{ fontWeight: 800, fontSize: '.84rem', color: '#c4b5fd' }}>Suggestions IA (RAG sémantique)</span>
          </div>
          {ragResult.tenders?.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {ragResult.tenders.slice(0, 4).map((t: RagTender) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(148,163,184,.07)' }}>
                  <Target size={13} color="#facc15" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    {t.buyer && <div style={{ fontSize: '.7rem', color: '#475569' }}>{t.buyer}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '.68rem', color: '#64748b', fontFamily: 'monospace' }}>{Math.round(t.score * 100)}% match</span>
                    <span style={{ fontSize: '.66rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(139,92,246,.1)', color: '#a78bfa' }}>{t.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recherches récentes */}
      {!searched && recent.length > 0 && (
        <div style={{ background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> Recherches récentes
            </span>
            <button onClick={() => { setRecent([]); localStorage.removeItem('ds_search_history'); }}
              style={{ fontSize: '.7rem', color: '#334155', background: 'none', border: 'none', cursor: 'pointer' }}>
              Effacer
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recent.map(r => (
              <button key={r} onClick={() => { setQuery(r); search(r); }}
                style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: 4, transition: 'all .1s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(250,204,21,.2)'; e.currentTarget.style.color = '#facc15'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,.12)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <Clock size={10} /> {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions vides */}
      {!searched && !query && (
        <div style={{ background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '18px 20px' }}>
          <p style={{ fontSize: '.76rem', fontWeight: 700, color: '#475569', marginBottom: 12 }}>Chercher dans</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {entityOrder.map(type => {
              const meta = ENTITY_META[type];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <button key={type} onClick={() => inputRef.current?.focus()}
                  style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${meta.color}18`, background: `${meta.color}05`, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}10`; e.currentTarget.style.borderColor = `${meta.color}30`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${meta.color}05`; e.currentTarget.style.borderColor = `${meta.color}18`; }}
                >
                  <Icon size={14} color={meta.color} />
                  <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#94a3b8' }}>{meta.label}s</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(139,92,246,.04)', border: '1px solid rgba(139,92,246,.1)' }}>
            <Brain size={13} color="#8b5cf6" />
            <span style={{ fontSize: '.75rem', color: '#64748b' }}>
              La recherche inclut une <strong style={{ color: '#c4b5fd' }}>analyse sémantique IA</strong> pour trouver des documents similaires même avec des termes approchants.
            </span>
          </div>
        </div>
      )}

      {/* Résultats groupés */}
      {searched && results.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {entityOrder.filter(t => grouped[t]?.length).map(type => {
            const meta  = ENTITY_META[type];
            const items = grouped[type] ?? [];
            const Icon  = meta.icon;
            return (
              <div key={type} style={{ background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, overflow: 'hidden', backdropFilter: 'blur(16px)' }}>
                {/* Header groupe */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderBottom: '1px solid rgba(148,163,184,.06)', background: `${meta.color}04` }}>
                  <Icon size={13} color={meta.color} />
                  <span style={{ fontWeight: 800, fontSize: '.8rem', color: meta.color }}>{meta.label}s</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: `${meta.color}15`, color: meta.color }}>{items.length}</span>
                </div>
                {/* Résultats */}
                {items.map((r, idx) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
                    borderBottom: idx < items.length - 1 ? '1px solid rgba(148,163,184,.04)' : 'none',
                    cursor: 'pointer', transition: 'background .1s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = `${meta.color}05`}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Icône */}
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${meta.color}10`, border: `1px solid ${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color={meta.color} />
                    </div>
                    {/* Contenu avec highlight */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {highlight(r.title, query)}
                      </div>
                      {r.subtitle && (
                        <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlight(r.subtitle, query)}
                        </div>
                      )}
                    </div>
                    {/* Status + meta */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {r.status && (
                        <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${STATUS_COLOR[r.status] || '#64748b'}12`, color: STATUS_COLOR[r.status] || '#64748b', border: `1px solid ${STATUS_COLOR[r.status] || '#64748b'}25` }}>
                          {r.status}
                        </span>
                      )}
                      {r.meta && <span style={{ fontSize: '.7rem', color: '#334155' }}>{r.meta}</span>}
                    </div>
                    <ArrowRight size={13} color="#334155" style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 0 résultats */}
      {searched && results.length === 0 && !loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14 }}>
          <Search size={32} color="#1e293b" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700, color: '#475569', marginBottom: 6, fontSize: '.9rem' }}><EmptyState
              icon="🔍"
              title={lang === "en" ? "No results" : "Aucun résultat"}
              description="Essayez avec des mots-clés différents : nom d'acheteur, référence AO, type de livrable…"
              compact
            /> pour « {query} »</p>
          <p style={{ color: '#334155', fontSize: '.8rem', margin: 0 }}>Essayez un autre mot-clé ou vérifiez l'orthographe.</p>
          {hasRagResults(ragResult) && (
            <button onClick={() => setShowRag(true)} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,.2)', background: 'none', color: '#c4b5fd', cursor: 'pointer', fontSize: '.78rem', fontWeight: 700 }}>
              <Brain size={12} /> Voir les suggestions IA similaires
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes srchSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
