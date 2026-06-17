/**
 * TenderSourcesPage — Sources multiples pour les Appels d'Offres
 *
 * - Recherche simultanée sur BOAMP, TED, Maximilien, IA Web
 * - Import en 1 clic avec extraction CRM automatique
 * - Prévisualisation des entités CRM à créer
 * - Extraction CRM en masse sur les AOs existants
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Search, Globe, Download, Building2, Users, TrendingUp,
  RefreshCw, CheckCircle, AlertCircle, Loader2, Eye, Zap, Filter,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import { useI18n } from '../i18n';

const SOURCES_META: Record<string, { icon: string; color: string; label: string }> = {
  boamp:      { icon: '🇫🇷', color: '#3b82f6', label: 'BOAMP' },
  ted:        { icon: '🇪🇺', color: '#6366f1', label: 'TED Europe' },
  ai_web:     { icon: '🤖', color: '#8b5cf6', label: 'IA Web' },
  maximilien: { icon: '🗼', color: '#f59e0b', label: 'Maximilien' },
  megalis:    { icon: '⛵', color: '#06b6d4', label: 'Mégalis' },
  place:      { icon: '🏛️', color: '#22c55e', label: 'PLACE' },
  pdf:        { icon: '📄', color: '#ef4444', label: 'PDF' },
  manual:     { icon: '✏️', color: '#64748b', label: 'Manuel' },
};

type TenderRaw = {
  source: string; source_id: string; title: string; buyer_name: string;
  submission_deadline?: string; source_url?: string; category?: string;
  summary?: string; estimated_budget?: number;
};

type CRMPreview = {
  organization: { name: string; sector: string; type: string; already_exists: boolean };
  contact: { first_name?: string; professional_email?: string } | null;
  opportunity: { title: string; priority: string; probability: number };
};

export default function TenderSourcesPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();

  const [query, setQuery]           = useState('');
  const [activeSources, setActive]  = useState<string[]>(['boamp', 'ted', 'ai_web']);
  const [results, setResults]       = useState<Record<string, TenderRaw[]>>({});
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [searching, setSearching]   = useState(false);
  const [importing, setImporting]   = useState(false);
  const [bulkExtracting, setBulk]   = useState(false);
  const [msg, setMsg]               = useState<{ok:boolean;text:string}|null>(null);
  const [preview, setPreview]       = useState<{tender_id:number;data:CRMPreview}|null>(null);
  const [sourcesList, setSources]   = useState<any[]>([]);
  const [tab, setTab]               = useState<'search'|'extract'>('search');

  // Charger les sources disponibles
  useEffect(() => {
    apiRequest<any[]>('/tender-sources', {}, token).then(setSources).catch(() => {});
  }, []);

  async function search() {
    if (!query.trim()) return;
    setSearching(true); setResults({}); setSelected(new Set()); setMsg(null);
    try {
      const data = await apiRequest<any>(
        `/tender-sources/search?q=${encodeURIComponent(query)}&sources=${activeSources.join(',')}&limit=15`,
        {}, token,
      );
      setResults(data.results || {});
      const total = data.total || 0;
      setMsg({ ok: true, text: `${total} résultat${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}` });
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 100) });
    } finally { setSearching(false); }
  }

  async function importSelected() {
    const toImport: TenderRaw[] = [];
    Object.values(results).flat().forEach(t => {
      if (selected.has(`${t.source}__${t.source_id || t.title}`)) toImport.push(t);
    });
    if (!toImport.length) { setMsg({ ok: false, text: 'Sélectionnez au moins un AO' }); return; }

    setImporting(true); setMsg(null);
    try {
      const data = await apiRequest<any>('/tender-sources/import', {
        method: 'POST',
        body: JSON.stringify({ tenders: toImport, auto_extract_crm: true }),
      }, token);
      setMsg({ ok: true, text: `✅ ${data.imported} AO(s) importé(s) + CRM enrichi automatiquement` });
      setSelected(new Set());
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 100) });
    } finally { setImporting(false); }
  }

  async function bulkExtract() {
    setBulk(true); setMsg(null);
    try {
      const data = await apiRequest<any>('/tender-sources/crm-bulk-extract', {
        method: 'POST',
        body: JSON.stringify({ limit: 100 }),
      }, token);
      setMsg({ ok: true, text: `✅ ${data.processed} AOs traités — ${data.org_created} orgs, ${data.contact_created} contacts, ${data.opp_created} opportunités créé(e)s` });
    } catch (e) {
      setMsg({ ok: false, text: String(e).slice(0, 100) });
    } finally { setBulk(false); }
  }

  function toggleSource(s: string) {
    setActive(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  function selectAll() {
    const all = Object.values(results).flat().map(t => `${t.source}__${t.source_id || t.title}`);
    setSelected(new Set(all));
  }

  const totalResults = Object.values(results).flat().length;

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(12px,3vw,32px)', maxWidth: 1200, display: 'grid', gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>
          Appels d'offres
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, margin: 0, letterSpacing: '-.04em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={24} color="#facc15" />
          Sources multiples
        </h1>
        <p style={{ color: '#64748b', fontSize: '.84rem', margin: '6px 0 0' }}>
          BOAMP · TED Europe · Maximilien · IA Web · PDF · Manuel — extraction CRM automatique
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(148,163,184,.1)', paddingBottom: 12 }}>
        {[
          { key: 'search', label: '🔍 Recherche multi-sources' },
          { key: 'extract', label: '🤖 Extraction CRM automatique' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key as any)} style={{
            padding: '8px 16px', borderRadius: 9, border: `1px solid ${tab===key?'rgba(250,204,21,.3)':'rgba(148,163,184,.1)'}`,
            background: tab===key ? 'rgba(250,204,21,.08)' : 'none',
            color: tab===key ? '#facc15' : '#64748b', cursor: 'pointer',
            fontSize: '.82rem', fontWeight: tab===key ? 700 : 500,
          }}>{label}</button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{ padding: '11px 16px', borderRadius: 10, fontSize: '.84rem',
          background: msg.ok ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
          color: msg.ok ? '#86efac' : '#fca5a5' }}>
          {msg.text}
        </div>
      )}

      {/* ── TAB: Recherche ─────────────────────────────────────────────────── */}
      {tab === 'search' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Sources selector */}
          <div style={{ background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: '.76rem', fontWeight: 700, color: '#64748b', marginBottom: 10 }}>Sources actives</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(SOURCES_META).filter(([k]) => k !== 'manual').map(([key, meta]) => (
                <button key={key} onClick={() => toggleSource(key)} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${activeSources.includes(key) ? meta.color + '50' : 'rgba(148,163,184,.12)'}`,
                  background: activeSources.includes(key) ? meta.color + '12' : 'none',
                  color: activeSources.includes(key) ? meta.color : '#475569',
                  fontSize: '.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all .15s',
                }}>
                  <span>{meta.icon}</span> {meta.label}
                  {activeSources.includes(key) && <CheckCircle size={11} />}
                </button>
              ))}
            </div>
          </div>

          {/* Barre de recherche */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Ex: data engineering, architecture SI, DINUM, Snowflake…"
                style={{ width: '100%', padding: '12px 14px 12px 42px', boxSizing: 'border-box', borderRadius: 11, border: '1px solid rgba(148,163,184,.15)', background: 'rgba(12,22,45,.9)', color: '#f1f5f9', fontSize: '.9rem', outline: 'none' }}
              />
            </div>
            <button onClick={search} disabled={searching || !query.trim()} style={{
              padding: '12px 22px', borderRadius: 11, border: 'none',
              background: searching ? '#334155' : '#facc15',
              color: '#060d1a', fontWeight: 800, cursor: searching ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, fontSize: '.9rem',
            }}>
              {searching ? <Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> : <Search size={16} />}
              {searching ? 'Recherche…' : 'Rechercher'}
            </button>
          </div>

          {/* Résultats */}
          {totalResults > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.8rem', color: '#64748b' }}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''} / {totalResults}</span>
                <button onClick={selectAll} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.75rem' }}>
                  Tout sélectionner
                </button>
                <button onClick={() => setSelected(new Set())} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.75rem' }}>
                  Tout désélectionner
                </button>
                {selected.size > 0 && (
                  <button onClick={importSelected} disabled={importing} style={{
                    marginLeft: 'auto', padding: '7px 16px', borderRadius: 9, border: 'none',
                    background: '#facc15', color: '#060d1a', fontWeight: 800, cursor: 'pointer',
                    fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Download size={13} />
                    {importing ? 'Import…' : `Importer ${selected.size} AO${selected.size > 1 ? 's' : ''} + CRM`}
                  </button>
                )}
              </div>

              {/* Résultats par source */}
              {Object.entries(results).filter(([, v]) => v.length > 0).map(([sourceId, tenders]) => {
                const meta = SOURCES_META[sourceId] || { icon: '📋', color: '#64748b', label: sourceId };
                return (
                  <div key={sourceId} style={{ background: 'rgba(10,18,38,.85)', border: `1px solid ${meta.color}20`, borderRadius: 14, overflow: 'hidden' }}>
                    {/* Source header */}
                    <div style={{ padding: '10px 16px', background: `${meta.color}08`, display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${meta.color}15` }}>
                      <span style={{ fontSize: '1rem' }}>{meta.icon}</span>
                      <span style={{ fontWeight: 800, fontSize: '.82rem', color: meta.color }}>{meta.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${meta.color}15`, color: meta.color }}>
                        {tenders.length} résultat{tenders.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Tenders */}
                    {tenders.map((t, i) => {
                      const key = `${t.source}__${t.source_id || t.title}`;
                      const isSel = selected.has(key);
                      return (
                        <div key={i} onClick={() => toggleSelect(key)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                          borderBottom: i < tenders.length - 1 ? '1px solid rgba(148,163,184,.04)' : 'none',
                          cursor: 'pointer', background: isSel ? `${meta.color}06` : 'transparent',
                          transition: 'background .1s',
                        }}>
                          {/* Checkbox */}
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSel ? meta.color : 'rgba(148,163,184,.3)'}`, background: isSel ? meta.color : 'none', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSel && <CheckCircle size={12} color="#fff" />}
                          </div>
                          {/* Contenu */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#e2e8f0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.title}
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              {t.buyer_name && (
                                <span style={{ fontSize: '.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Building2 size={10} /> {t.buyer_name}
                                </span>
                              )}
                              {t.submission_deadline && (
                                <span style={{ fontSize: '.72rem', color: '#f59e0b' }}>
                                  📅 {new Date(t.submission_deadline).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                              {t.estimated_budget && (
                                <span style={{ fontSize: '.72rem', color: '#22c55e' }}>
                                  💰 {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(t.estimated_budget)}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Lien */}
                          {t.source_url && (
                            <a href={t.source_url} target="_blank" rel="noopener noreferrer"
                               onClick={e => e.stopPropagation()}
                               style={{ color: '#475569', padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(148,163,184,.1)', fontSize: '.7rem', textDecoration: 'none', flexShrink: 0 }}>
                              Voir ↗
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* État vide */}
          {!searching && totalResults === 0 && query && (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14 }}>
              <Search size={28} color="#1e293b" style={{ marginBottom: 12 }} />
              <p style={{ color: '#475569', margin: 0 }}>Aucun résultat. Essayez avec d'autres mots-clés ou activez plus de sources.</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Extraction CRM ────────────────────────────────────────────── */}
      {tab === 'extract' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Explication */}
          <div style={{ background: 'rgba(139,92,246,.05)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Zap size={18} color="#8b5cf6" />
              <span style={{ fontWeight: 800, color: '#c4b5fd', fontSize: '.9rem' }}>Agent CRM automatique</span>
            </div>
            <p style={{ margin: 0, fontSize: '.82rem', color: '#64748b', lineHeight: 1.6 }}>
              L'agent analyse chaque AO et extrait automatiquement :<br/>
              <strong style={{ color: '#94a3b8' }}>• Organisation</strong> (acheteur + secteur + type) →{' '}
              <strong style={{ color: '#94a3b8' }}>• Contact</strong> (email, téléphone si disponible) →{' '}
              <strong style={{ color: '#94a3b8' }}>• Opportunité</strong> (avec score Go/No-Go + deadline)
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            {[
              { icon: <Building2 size={18} color="#3b82f6"/>, label: 'Organisations CRM', desc: 'Acheteurs extraits des AOs' },
              { icon: <Users size={18} color="#22c55e"/>, label: 'Contacts', desc: 'Emails / téléphones détectés' },
              { icon: <TrendingUp size={18} color="#facc15"/>, label: 'Opportunités', desc: 'Pipeline automatique' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{ padding: '14px 18px', background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 12 }}>
                <div style={{ marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
                <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={bulkExtract} disabled={bulkExtracting} style={{
              padding: '11px 20px', borderRadius: 10, border: 'none',
              background: bulkExtracting ? '#334155' : 'linear-gradient(135deg,#8b5cf6,#6366f1)',
              color: '#fff', fontWeight: 800, cursor: bulkExtracting ? 'not-allowed' : 'pointer',
              fontSize: '.86rem', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {bulkExtracting ? <Loader2 size={15} style={{ animation: 'spin .7s linear infinite' }} /> : <Zap size={15} />}
              {bulkExtracting ? 'Extraction en cours…' : 'Extraire CRM depuis tous les AOs'}
            </button>
          </div>

          {/* Comment ça marche */}
          <div style={{ background: 'rgba(10,18,38,.8)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>Comment ça marche</div>
            {[
              ['1. Scan des AOs', 'L\'agent parcourt tous vos AOs avec un acheteur renseigné'],
              ['2. Détection doublons', 'Si l\'organisation existe déjà dans le CRM, elle n\'est pas recréée'],
              ['3. Extraction entités', 'Nom acheteur → Organisation, emails/téléphones → Contact'],
              ['4. Création opportunité', 'Une opportunité est créée avec le score Go/No-Go et la deadline'],
              ['5. Pipeline automatique', 'Le CRM se remplit au fur et à mesure que vous importez des AOs'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#8b5cf6', minWidth: 140 }}>{title}</span>
                <span style={{ fontSize: '.76rem', color: '#64748b' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
