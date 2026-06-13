import { useI18n } from '../i18n';
import { useWorkflowSSE } from '../hooks/useWorkflowSSE';
import { useEffect, useState, useCallback } from 'react';
import { FileText, Search, Zap, Plus, RefreshCw } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';
import { TenderWorkspace } from '../components/TenderWorkspace';
import TenderPDFUpload from '../components/TenderPDFUpload';
import WorkflowPanel from '../components/WorkflowPanel';

interface TenderOption  { id: number; title: string; status?: string; }
interface BOAMPResult   { title: string; reference: string; buyer_name: string; summary: string; qualification_score: number; recommendation: string; source_url: string; }

const S = {
  btn: (active?: boolean): React.CSSProperties => ({
    display:'flex',alignItems:'center',gap:7,padding:'8px 14px',borderRadius:9,border:`1px solid ${active?'rgba(250,204,21,.4)':'rgba(148,163,184,.15)'}`,
    background:active?'rgba(250,204,21,.1)':'none',color:active?'#facc15':'#64748b',
    cursor:'pointer',fontWeight:700,fontSize:'.82rem',whiteSpace:'nowrap' as const,
  }),
  primary: { display:'flex',alignItems:'center',gap:7,padding:'9px 16px',borderRadius:9,border:'none',background:'#facc15',color:'#060e18',cursor:'pointer',fontWeight:800,fontSize:'.84rem' } as React.CSSProperties,
};

export default function TenderPage() {
  const { t, lang } = useI18n();
  const accessKey = tokenStorage.get();

  // Real-time workflow updates via SSE (remplace le polling 5s)
  useWorkflowSSE({
    token: accessKey,
    onEvent: (event) => {
      if (event.type === 'workflow.step_done' || event.type === 'workflow.step_awaiting' || event.type === 'workflow.completed') {
        loadTenders(); // Refresh on any workflow update
      }
    },
  });
  const [user, setUser]       = useState<CurrentUser|null>(null);
  const [tenders, setTenders] = useState<TenderOption[]>([]);
  const [defaultOppId, setDefaultOppId]     = useState(0);
  const [activeTenderId, setActiveTenderId] = useState<number|null>(null);
  const [showPDF,      setShowPDF]      = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [page,    setPage]    = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [perPage] = useState(20);
  const [total,   setTotal]   = useState(0);
  const [showBOAMP,    setShowBOAMP]    = useState(false);

  const loadTenders = useCallback(() => {
    if (!accessKey) return;
    apiRequest<TenderOption[]>('/tenders?limit=50', {}, accessKey)
      .then(list => { setTenders(list??[]); if(list?.length && !activeTenderId) setActiveTenderId(list[0].id); })
      .catch(()=>{});
  }, [accessKey]);

  useEffect(() => {
    if (!accessKey) return;
    apiRequest<CurrentUser>('/auth/me',{},accessKey).then(setUser).catch(()=>{});
    apiRequest<{id:number}[]>('/opportunities',{},accessKey).then(o=>{if(o.length) setDefaultOppId(o[0].id);}).catch(()=>{});
    loadTenders();
  }, [accessKey, loadTenders]);

  const activeTender = tenders.find(t => t.id === activeTenderId);

  if (!accessKey) return (
    <main className="app-shell"><section className="panel"><h1>{t('tenders.title')}</h1><p>Connecte-toi d'abord.</p></section></main>
  );

  return (
    <main className="app-shell">

      {/* PDF Upload modal */}
      {showPDF && (
        <div style={{position:'fixed',inset:0,zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.7)',backdropFilter:'blur(4px)',padding:16}}>
          <TenderPDFUpload opportunityId={defaultOppId||1}
            onCreated={()=>{setShowPDF(false);loadTenders();}}
            onClose={()=>setShowPDF(false)} />
        </div>
      )}

      {/* Header */}
      <section className="panel">
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <div>
            <p className="eyebrow">Module stratégique</p>
            <h1>{t('tenders.title')}</h1>
            <p className="subtitle">Veille BOAMP · Qualification IA · Workflow automatisé · Livrable</p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
            <button style={S.btn(showBOAMP)} onClick={()=>{setShowBOAMP(v=>!v);setShowWorkflow(false);}}>
              <Search size={14}/> Chercher des AOs
            </button>
            <button style={S.btn()} onClick={()=>setShowPDF(true)}>
              <FileText size={14}/> Importer PDF
            </button>
            <button style={S.btn(showWorkflow)} onClick={()=>{setShowWorkflow(v=>!v);setShowBOAMP(false);}}>
              <Zap size={14}/> Workflow IA
            </button>
          </div>
        </div>
      </section>


      {/* Batch action bar — appears when AOs are selected */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 18px', borderRadius: 10,
          background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.2)',
        }}>
          <span style={{ fontWeight: 800, color: '#facc15', fontSize: '.82rem' }}>
            {selectedIds.size} AO{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => {
              selectedIds.forEach(async id => {
                await apiRequest(`/workflow/${id}/start`, { method: 'POST', body: JSON.stringify({ force_reset: false }) }, accessKey);
              });
              setSelectedIds(new Set());
              loadTenders();
            }} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)', color: '#93c5fd', cursor: 'pointer', fontWeight: 700, fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} /> Lancer workflows
            </button>
            <button onClick={() => {
              Promise.all([...selectedIds].map(id =>
                apiRequest(`/export/excel/tenders/csv`, {}, accessKey)
              ));
              setSelectedIds(new Set());
            }} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(34,197,94,.25)', background: 'rgba(34,197,94,.06)', color: '#86efac', cursor: 'pointer', fontWeight: 700, fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={12} /> Exporter CSV
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.75rem' }}>
              ✕ Désélectionner
            </button>
          </div>
          <button onClick={() => {
            if (tenders.every(t => selectedIds.has(t.id))) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(tenders.map(t => t.id)));
            }
          }} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.72rem' }}>
            {tenders.every(t => selectedIds.has(t.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>
      )}

      {/* BOAMP Search Panel */}
      {showBOAMP && (
        <BOAMPPanel token={accessKey} onImported={(id)=>{ setActiveTenderId(id); loadTenders(); setShowBOAMP(false); setShowWorkflow(true); }} />
      )}

      {/* Workflow Panel */}
      {showWorkflow && (
        <section className="panel" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(148,163,184,.08)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:'.78rem',color:'#64748b',fontWeight:700}}>AO cible :</span>
            {tenders.length === 0 ? (
              <span style={{fontSize:'.78rem',color:'#475569'}}>Aucun AO — importez-en un d'abord via BOAMP ou PDF.</span>
            ) : (
              <select value={activeTenderId??''} onChange={e=>setActiveTenderId(Number(e.target.value))}
                style={{padding:'6px 12px',borderRadius:8,background:'rgba(255,255,255,.05)',border:'1px solid rgba(148,163,184,.15)',color:'#e2e8f0',fontSize:'.82rem',minWidth:240}}>
                {tenders.map(t => (
                  <option key={t.id} value={t.id}>#{t.id} — {t.title}{t.status?` · ${t.status}`:''}</option>
                ))}
              </select>
            )}
            <button onClick={loadTenders} style={{...S.btn(),padding:'6px 8px'}}><RefreshCw size={12}/></button>
          </div>
          {activeTenderId && (
            <WorkflowPanel tenderId={activeTenderId} tenderTitle={activeTender?.title} token={accessKey} />
          )}
        </section>
      )}

      {/* Tenders list + editor */}
      <TenderWorkspace token={accessKey} />

      {/* Pagination */}
      {total > perPage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
            ← Précédent
          </button>
          {Array.from({ length: Math.ceil(total / perPage) }, (_, i) => i + 1).slice(
            Math.max(0, page - 3), Math.min(Math.ceil(total / perPage), page + 2)
          ).map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${p === page ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.15)'}`, background: p === page ? 'rgba(250,204,21,.08)' : 'none', color: p === page ? '#facc15' : '#94a3b8', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(Math.ceil(total / perPage), p + 1))} disabled={page >= Math.ceil(total / perPage)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: page >= Math.ceil(total / perPage) ? '#334155' : '#94a3b8', cursor: page >= Math.ceil(total / perPage) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '.78rem' }}>
            Suivant →
          </button>
          <span style={{ fontSize: '.72rem', color: '#475569', marginLeft: 8 }}>
            {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} sur {total}
          </span>
        </div>
      )}
    </main>
  );
}

// ── BOAMP Search Panel ────────────────────────────────────────────────────────

function BOAMPPanel({ token, onImported }: { token: string|null; onImported: (id:number)=>void }) {
  const [query,   setQuery]   = useState('data');
  const [results, setResults] = useState<BOAMPResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string|null>(null);
  const [msg, setMsg] = useState('');

  async function search() {
    setLoading(true); setMsg(''); setResults([]);
    try {
      const r = await apiRequest<BOAMPResult[]>(`/tender-watch/search?q=${encodeURIComponent(query)}&limit=20`, {}, token);
      setResults(r??[]);
      if (!r?.length) setMsg('Aucun AO trouvé. Essayez avec d\'autres mots-clés.');
    } catch(e) { setMsg('Erreur BOAMP — vérifiez la connexion.'); }
    finally { setLoading(false); }
  }

  async function importAO(ao: BOAMPResult) {
    setImporting(ao.reference); setMsg('');
    try {
      // Get first opportunity
      const opps = await apiRequest<{id:number}[]>('/opportunities?limit=1', {}, token);
      const oppId = opps?.[0]?.id;
      if (!oppId) { setMsg('Créez d\'abord une opportunité dans le CRM.'); setImporting(null); return; }

      const tender = await apiRequest<{id:number}>('/tenders', {
        method: 'POST',
        body: JSON.stringify({
          opportunity_id: oppId,
          title: ao.title,
          reference: ao.reference,
          buyer_name: ao.buyer_name,
          summary: ao.summary,
          source_url: ao.source_url,
          status: 'draft',
        }),
      }, token);
      setMsg(`✅ AO importé — lancement du workflow automatique`);
      onImported(tender.id);
    } catch(e) { setMsg(`❌ Erreur import : ${String(e).slice(0,80)}`); }
    finally { setImporting(null); }
  }

  const scoreColor = (s:number) => s>=70?'#86efac':s>=50?'#fde68a':'#fca5a5';

  return (
    <section className="panel">
      <div style={{marginBottom:16}}>
        <p className="eyebrow">Veille automatique</p>
        <h2 style={{marginBottom:8}}>Rechercher des appels d'offres BOAMP</h2>
        <p style={{fontSize:'.82rem',color:'#64748b'}}>Powered by BOAMP Open Data — aucune clé API requise</p>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <input value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&search()}
          placeholder="data engineer, IA, cloud, Snowflake, Python…"
          style={{flex:1,padding:'9px 14px',background:'rgba(255,255,255,.05)',border:'1.5px solid rgba(148,163,184,.15)',borderRadius:9,color:'#f1f5f9',fontSize:'.86rem',outline:'none'}} />
        <button onClick={search} disabled={loading} style={S.primary}>
          {loading ? <RefreshCw size={14} style={{animation:'ds-spin .7s linear infinite'}}/> : <Search size={14}/>}
          {loading?'Recherche…':'Rechercher'}
        </button>
      </div>

      {/* Quick filters */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        {['data engineer','intelligence artificielle','cloud AWS','Snowflake','data platform','transformation digitale'].map(kw=>(
          <button key={kw} onClick={()=>{setQuery(kw);}}
            style={{padding:'3px 10px',borderRadius:99,border:'1px solid rgba(148,163,184,.12)',background:query===kw?'rgba(250,204,21,.1)':'none',color:query===kw?'#facc15':'#475569',cursor:'pointer',fontSize:'.72rem',fontWeight:600}}>
            {kw}
          </button>
        ))}
      </div>

      {msg && <div style={{padding:'10px 14px',borderRadius:9,background:msg.startsWith('✅')?'rgba(34,197,94,.06)':'rgba(239,68,68,.06)',border:`1px solid ${msg.startsWith('✅')?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)'}`,color:msg.startsWith('✅')?'#86efac':'#fca5a5',fontSize:'.82rem',marginBottom:12}}>{msg}</div>}

      {results.length > 0 && (
        <div style={{display:'grid',gap:8}}>
          <div style={{fontSize:'.78rem',color:'#475569',marginBottom:4}}>{results.length} appel(s) d'offres trouvé(s)</div>
          {results.map((ao, i) => (
            <div key={i} style={{border:'1px solid rgba(148,163,184,.1)',borderRadius:12,padding:'14px 16px',background:'rgba(12,20,37,.85)'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10,justifyContent:'space-between',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'.88rem',color:'#e2e8f0',marginBottom:4,lineHeight:1.3}}>{ao.title}</div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:'.74rem',color:'#475569',marginBottom:6}}>
                    <span>{ao.buyer_name}</span>
                    {ao.reference && <span>Réf : {ao.reference}</span>}
                  </div>
                  {ao.summary && <div style={{fontSize:'.78rem',color:'#64748b',lineHeight:1.5,marginBottom:8}}>{ao.summary.slice(0,200)}{ao.summary.length>200?'…':''}</div>}
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:'.74rem',fontWeight:700,padding:'2px 8px',borderRadius:99,background:`${scoreColor(ao.qualification_score)}15`,color:scoreColor(ao.qualification_score)}}>
                      Score {ao.qualification_score}/100
                    </span>
                    <span style={{fontSize:'.72rem',color:'#475569'}}>{ao.recommendation}</span>
                    {ao.source_url && <a href={ao.source_url} target="_blank" rel="noopener noreferrer" style={{fontSize:'.72rem',color:'#facc15',textDecoration:'none'}}>↗ BOAMP</a>}
                  </div>
                </div>
                <button onClick={()=>importAO(ao)} disabled={importing===ao.reference}
                  style={{padding:'8px 14px',borderRadius:9,border:'none',background:ao.qualification_score>=60?'#facc15':'rgba(148,163,184,.1)',color:ao.qualification_score>=60?'#060e18':'#64748b',cursor:'pointer',fontWeight:800,fontSize:'.78rem',flexShrink:0,display:'flex',alignItems:'center',gap:6,opacity:importing===ao.reference?.6:1}}>
                  {importing===ao.reference?<RefreshCw size={12} style={{animation:'ds-spin .7s linear infinite'}}/>:<Plus size={13}/>}
                  Importer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </section>
  );
}
