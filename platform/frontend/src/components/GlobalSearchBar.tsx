import { useEffect, useRef, useState } from 'react';
import { Building2, FileText, Search, Target, Users, X, Zap } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { SearchResultItem, SearchResults } from '../api/domainTypes';

const TYPE_ICONS: Record<string, React.ElementType> = {
  organization: Building2,
  opportunity:  Target,
  tender:       FileText,
  deliverable:  FileText,
  contact:      Users,
  agent_action: Zap,
};

const TYPE_LABELS: Record<string, string> = {
  organizations: 'Organisations',
  opportunities: 'Opportunités',
  tenders:       'Appels d\'offres',
  deliverables:  'Livrables',
  contacts:      'Contacts',
  actions:       'Actions',
};

const TYPE_COLORS: Record<string, string> = {
  organization: '#facc15',
  opportunity:  '#3b82f6',
  tender:       '#8b5cf6',
  deliverable:  '#22c55e',
  contact:      '#06b6d4',
  agent_action: '#f97316',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function GlobalSearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = tokenStorage.get();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(''); setResults(null); setError(null); }
  }, [open]);

  function handleInput(val: string) {
    setQuery(val);
    setError(null);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiRequest<SearchResults>(`/search?q=${encodeURIComponent(val)}&limit=6`, {}, token);
        setResults(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de recherche');
        setResults(null);
      } finally { setLoading(false); }
    }, 250);
  }

  const allItems: Array<SearchResultItem & { category: string }> = [];
  if (results) {
    for (const [cat, items] of Object.entries(results.results)) {
      items.forEach(item => allItems.push({ ...item, category: cat }));
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(148,163,184,0.15)',
          color: '#64748b', fontSize: '0.82rem',
          transition: 'all 0.15s',
        }}
      >
        <Search size={14} />
        <span>Rechercher…</span>
        <kbd style={{
          marginLeft: 4, padding: '1px 6px', borderRadius: 5, fontSize: '0.7rem',
          background: 'rgba(148,163,184,0.1)', color: '#475569', border: '1px solid rgba(148,163,184,0.2)',
          fontFamily: 'monospace',
        }}>⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '80px 24px 24px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 620,
            background: '#0d1f35',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: 16,
            boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}>
            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
              {loading
                ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #facc15', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                : <Search size={16} color="#64748b" style={{ flexShrink: 0 }} />
              }
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Chercher organisation, AO, livrable, contact…"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#f1f5f9', fontSize: '0.95rem', fontFamily: 'DM Sans, sans-serif',
                }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}>
                  <X size={14} />
                </button>
              )}
              <kbd style={{ padding: '2px 7px', borderRadius: 5, fontSize: '0.72rem', background: 'rgba(148,163,184,0.1)', color: '#475569', border: '1px solid rgba(148,163,184,0.2)', fontFamily: 'monospace', flexShrink: 0 }}>Esc</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 450, overflowY: 'auto' }}>
              {!query && (
                <div style={{ padding: '20px 18px', color: '#475569', fontSize: '0.84rem', textAlign: 'center' }}>
                  Tapez au moins 2 caractères pour rechercher dans toute la plateforme.
                </div>
              )}
              {error && (
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, color: '#fca5a5', fontSize: '.82rem' }}>
                  <span>⚠</span> {error}
                </div>
              )}
              {query.length >= 2 && !loading && !error && results?.total === 0 && (
                <div style={{ padding: '20px 18px', color: '#475569', fontSize: '0.84rem', textAlign: 'center' }}>
                  Aucun résultat pour <strong style={{ color: '#94a3b8' }}>« {query} »</strong>
                </div>
              )}

              {results && Object.entries(results.results).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ padding: '10px 18px 5px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {TYPE_LABELS[cat] ?? cat} ({items.length})
                  </div>
                  {items.map(item => {
                    const Icon = TYPE_ICONS[item.type] ?? FileText;
                    const color = TYPE_COLORS[item.type] ?? '#94a3b8';
                    return (
                      <div
                        key={`${cat}-${item.id}`}
                        onClick={() => setOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '10px 18px', cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: `${color}15`, border: `1px solid ${color}25`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={14} color={color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.86rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.subtitle}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#475569', fontFamily: 'monospace', flexShrink: 0, padding: '2px 6px', borderRadius: 5, background: `${color}10` }}>
                          {item.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(148,163,184,0.08)', display: 'flex', gap: 16, fontSize: '0.73rem', color: '#475569' }}>
              <span>↑↓ Naviguer</span>
              <span>↵ Sélectionner</span>
              <span>Esc Fermer</span>
              {results && <span style={{ marginLeft: 'auto' }}>{results.total} résultat{results.total > 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
