import { useEffect, useRef, useState } from 'react';
import {
  Building2, FileText, Loader2, Search, Target, TrendingUp,
  Users, X, ArrowRight, Clock,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface SearchResult {
  entity_type: 'organization' | 'opportunity' | 'tender' | 'deliverable' | 'contact';
  id: number;
  title: string;
  subtitle?: string;
  meta?: string;
  score?: number;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

const ENTITY_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  organization: { icon: Building2,  color: '#60a5fa', label: 'Organisation' },
  opportunity:  { icon: TrendingUp, color: '#a78bfa', label: 'Opportunité' },
  tender:       { icon: Target,     color: '#facc15', label: 'Appel d\'offres' },
  deliverable:  { icon: FileText,   color: '#34d399', label: 'Livrable' },
  contact:      { icon: Users,      color: '#f97316', label: 'Contact' },
};

export default function SearchPage() {
  const token                   = tokenStorage.get();
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [recent,   setRecent]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ds_search_history') || '[]'); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function saveRecent(q: string) {
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 8);
    setRecent(updated);
    try { localStorage.setItem('ds_search_history', JSON.stringify(updated)); } catch {}
  }

  async function search(q: string) {
    if (!q || q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const data = await apiRequest<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=20`, {}, token);
      setResults(data?.results ?? []);
      setTotal(data?.total ?? 0);
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
      setResults([]); setSearched(false);
    }
  }

  // Group results by entity type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.entity_type]) acc[r.entity_type] = [];
    acc[r.entity_type].push(r);
    return acc;
  }, {});

  const entityOrder = ['tender', 'deliverable', 'opportunity', 'organization', 'contact'];

  if (!token) return (
    <main className="app-shell"><section className="panel"><p>Connecte-toi d'abord.</p></section></main>
  );

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="panel">
        <p className="eyebrow">Recherche globale</p>
        <div style={{ position: 'relative', marginTop: 8 }}>
          <Search size={18} color="#64748b" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => onInput(e.target.value)}
            placeholder="Rechercher un AO, livrable, client, contact…"
            style={{
              width: '100%', padding: '14px 16px 14px 48px',
              background: 'rgba(255,255,255,.05)',
              border: '1.5px solid rgba(250,204,21,.25)',
              borderRadius: 12, color: '#f1f5f9', fontSize: '1rem',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); }}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: '#64748b', fontSize: '.78rem' }}>
            <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} />
            Recherche en cours…
          </div>
        )}
        {searched && !loading && (
          <p style={{ marginTop: 10, fontSize: '.8rem', color: '#64748b' }}>
            {total === 0
              ? `Aucun résultat pour « ${query} »`
              : `${total} résultat${total > 1 ? 's' : ''} pour « ${query} »`}
          </p>
        )}
      </section>

      {/* Recent searches */}
      {!searched && recent.length > 0 && (
        <section className="panel">
          <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: '#64748b', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> Recherches récentes
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recent.map(r => (
              <button key={r} onClick={() => { setQuery(r); search(r); }}
                style={{
                  padding: '4px 12px', borderRadius: 8,
                  border: '1px solid rgba(148,163,184,.15)',
                  background: 'rgba(255,255,255,.03)',
                  color: '#94a3b8', cursor: 'pointer', fontSize: '.78rem',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                <Clock size={11} /> {r}
              </button>
            ))}
            <button onClick={() => { setRecent([]); localStorage.removeItem('ds_search_history'); }}
              style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'none', color: '#475569', cursor: 'pointer', fontSize: '.72rem' }}>
              Effacer
            </button>
          </div>
        </section>
      )}

      {/* Suggestions (no query) */}
      {!searched && !query && (
        <section className="panel" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: '#64748b', margin: '0 0 14px' }}>
            Chercher dans
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {entityOrder.map(type => {
              const meta = ENTITY_META[type];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <button key={type} onClick={() => { inputRef.current?.focus(); }}
                  style={{
                    padding: '12px', borderRadius: 10,
                    border: `1px solid ${meta.color}20`,
                    background: `${meta.color}06`,
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  <Icon size={15} color={meta.color} />
                  <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#94a3b8' }}>
                    {meta.label}s
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Results grouped by entity */}
      {searched && results.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {entityOrder.filter(t => grouped[t]?.length).map(type => {
            const meta   = ENTITY_META[type];
            const items  = grouped[type] ?? [];
            const Icon   = meta.icon;
            return (
              <section key={type} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 20px',
                  borderBottom: '1px solid rgba(148,163,184,.06)',
                  background: `${meta.color}04`,
                }}>
                  <Icon size={14} color={meta.color} />
                  <span style={{ fontWeight: 800, fontSize: '.82rem', color: meta.color }}>
                    {meta.label}s
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: '.7rem', fontWeight: 700,
                    padding: '1px 6px', borderRadius: 4,
                    background: `${meta.color}15`, color: meta.color,
                  }}>
                    {items.length}
                  </span>
                </div>

                {/* Items */}
                {items.map((r, idx) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 20px',
                    borderBottom: idx < items.length - 1 ? '1px solid rgba(148,163,184,.05)' : 'none',
                    cursor: 'pointer', transition: 'background .1s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${meta.color}04`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: `${meta.color}10`, border: `1px solid ${meta.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </div>
                      {r.subtitle && (
                        <div style={{ fontSize: '.73rem', color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.subtitle}
                        </div>
                      )}
                    </div>
                    {r.meta && (
                      <span style={{ fontSize: '.72rem', color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {r.meta}
                      </span>
                    )}
                    <ArrowRight size={14} color="#334155" style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* No results */}
      {searched && results.length === 0 && !loading && (
        <section className="panel" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <Search size={32} color="#334155" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: '#64748b', margin: '0 0 6px', fontWeight: 700 }}>
            Aucun résultat pour « {query} »
          </p>
          <p style={{ color: '#475569', fontSize: '.8rem', margin: 0 }}>
            Essayez un autre mot-clé, ou vérifiez l'orthographe.
          </p>
        </section>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
