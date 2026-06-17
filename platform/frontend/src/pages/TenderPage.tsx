import { useI18n } from '../i18n';
import { useWorkflowSSE } from '../hooks/useWorkflowSSE';
import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Search, Zap, Plus, RefreshCw, BookOpen, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import ScoreBreakdown from '../components/ScoreBreakdown';
import AgentPipelinePanel from '../components/AgentPipelinePanel';
import WorkflowTimeline from '../components/WorkflowTimeline';
import type { CurrentUser } from '../api/authTypes';
import { TenderWorkspace } from '../components/TenderWorkspace';
import TenderPDFUpload from '../components/TenderPDFUpload';
import WorkflowPanel from '../components/WorkflowPanel';
import GoNoGoAdvisorPanel from '../components/GoNoGoAdvisorPanel';
import TenderAutoImportPanel from '../components/TenderAutoImportPanel';

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


// Wrapper local : charge le workflow d'un AO et le passe à WorkflowTimeline
function TenderWorkflowTimeline({ tenderId, token }: { tenderId: number; token: string | null }) {
  const { t } = useI18n();
  const [workflow, setWorkflow] = React.useState<any>(null);
  const [loading, setLoading]   = React.useState(true);

  React.useEffect(() => {
    if (!tenderId) return;
    apiRequest<any>(`/workflow/tender/${tenderId}`, {}, token)
      .then(w => setWorkflow(w))
      .catch(() => setWorkflow(null))
      .finally(() => setLoading(false));
  }, [tenderId, token]);

  if (loading) return <div style={{color:'#475569',fontSize:'.82rem',padding:16}}>Chargement du workflow…</div>;
  if (!workflow) return <div style={{color:'#475569',fontSize:'.82rem',padding:16}}>Aucun workflow trouvé pour cet AO.<br/>Lancez-le via le panneau {t('tenders.workflow_btn')}.</div>;

  return <WorkflowTimeline workflow={workflow} token={token} onUpdate={() => {
    apiRequest<any>(`/workflow/tender/${tenderId}`, {}, token).then(w => setWorkflow(w)).catch(() => {});
  }} />;
}

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
  const [expandedScore, setExpandedScore] = useState<number | null>(null);
  const [assigning,   setAssigning]   = useState<number | null>(null);
  const [pipelineId,  setPipelineId]   = useState<number | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [perPage] = useState(20);
  const [total,   setTotal]   = useState(0);
  const [showBOAMP,    setShowBOAMP]    = useState(false);
  const [showMemoire,  setShowMemoire]  = useState(false);
  const [showGoNoGo,   setShowGoNoGo]   = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showAutoImport, setShowAutoImport] = useState(false);
  const [memoireContent, setMemoireContent] = useState('');
  const [memoireLoading, setMemoireLoading] = useState(false);
  const [memoireGenerated, setMemoireGenerated] = useState(false);
  const [memoireProvider, setMemoireProvider] = useState('');

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

  async function generateMemoire() {
    if (!activeTenderId || !accessKey) return;
    setMemoireLoading(true); setMemoireGenerated(false);
    try {
      const result = await apiRequest<{content:string;provider:string;word_count:number}>(`/tenders/${activeTenderId}/memoire`, { method: 'POST' }, accessKey);
      setMemoireContent(result.content);
      setMemoireProvider(result.provider);
      setMemoireGenerated(true);
    } catch(e) { alert('Erreur génération mémoire : ' + String(e)); }
    finally { setMemoireLoading(false); }
  }

  function downloadMemoire(format: 'docx' | 'pdf') {
    if (!activeTenderId || !memoireContent) return;
    const url = `/api/v1/tenders/${activeTenderId}/memoire/export-${format}`;
    const form = document.createElement('form');
    form.method = 'POST'; form.action = url; form.target = '_blank';
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden'; tokenInput.name = 'token'; tokenInput.value = accessKey ?? '';
    const contentInput = document.createElement('input');
    contentInput.type = 'hidden'; contentInput.name = 'content'; contentInput.value = memoireContent;
    const titleInput = document.createElement('input');
    titleInput.type = 'hidden'; titleInput.name = 'tender_title'; titleInput.value = activeTender?.title ?? '';
    form.appendChild(tokenInput); form.appendChild(contentInput); form.appendChild(titleInput);
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  }

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
            <p className="eyebrow">{t('tenders.module')}</p>
            <h1>{t('tenders.title')}</h1>
            <p className="subtitle">{t('tenders.subtitle')}</p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
            <button style={S.btn(showBOAMP)} onClick={()=>{setShowBOAMP(v=>!v);setShowWorkflow(false);}}>
              <Search size={14}/> {t('tenders.search_btn')}
            </button>
            <button style={S.btn()} onClick={()=>setShowPDF(true)}>
              <FileText size={14}/> {t('tenders.import_pdf')}
            </button>
            <button style={S.btn(showWorkflow)} onClick={()=>{setShowWorkflow(v=>!v);setShowBOAMP(false);setShowMemoire(false);}}>
              <Zap size={14}/> Workflow IA
            </button>
            <button style={S.btn(showMemoire)} onClick={()=>{setShowMemoire(v=>!v);setShowWorkflow(false);setShowBOAMP(false);setShowGoNoGo(false);setShowTimeline(false);setShowAutoImport(false);}}>
              <BookOpen size={14}/> {t('tenders.memoire_btn')}
            </button>
            <button style={S.btn(showGoNoGo)} onClick={()=>{setShowGoNoGo(v=>!v);setShowMemoire(false);setShowWorkflow(false);setShowBOAMP(false);setShowTimeline(false);setShowAutoImport(false);}}>
              <CheckCircle2 size={14}/> {t('tenders.gonogo_btn')}
            </button>
            <button style={S.btn(showTimeline)} onClick={()=>{setShowTimeline(v=>!v);setShowGoNoGo(false);setShowMemoire(false);setShowWorkflow(false);setShowBOAMP(false);setShowAutoImport(false);}}>
              <Zap size={14}/> {t('tenders.timeline_btn')}
            </button>
            <button style={S.btn(showAutoImport)} onClick={()=>{setShowAutoImport(v=>!v);setShowTimeline(false);setShowGoNoGo(false);setShowMemoire(false);setShowWorkflow(false);setShowBOAMP(false);}}>
              <Search size={14}/> {t('tenders.autoimport_btn')}
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
            {tenders.every(t => selectedIds.has(t.id)) ? lang === 'en' ? 'Deselect all' : 'Tout désélectionner' : lang === 'en' ? 'Select all' : 'Tout sélectionner'}
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

      {/* Mémoire Technique Panel */}
      {showMemoire && (
        <section className="panel" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(148,163,184,.08)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <BookOpen size={15} color="#facc15"/>
            <span style={{fontWeight:700,fontSize:'.88rem'}}>Mémoire Technique IA</span>
            <span style={{fontSize:'.72rem',color:'#475569',marginLeft:4}}>Génération complète 8 sections • ~60s</span>
            <div style={{marginLeft:'auto',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              {tenders.length > 0 && (
                <select value={activeTenderId??''} onChange={e=>setActiveTenderId(Number(e.target.value))}
                  style={{padding:'6px 12px',borderRadius:8,background:'rgba(255,255,255,.05)',border:'1px solid rgba(148,163,184,.15)',color:'#e2e8f0',fontSize:'.82rem',minWidth:200}}>
                  {tenders.map(t => <option key={t.id} value={t.id}>#{t.id} — {t.title.slice(0,45)}</option>)}
                </select>
              )}
              {memoireGenerated && (
                <>
                  <button onClick={()=>downloadMemoire('docx')} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 13px',borderRadius:8,border:'1px solid rgba(148,163,184,.2)',background:'none',color:'#94a3b8',cursor:'pointer',fontSize:'.78rem'}}>
                    <Download size={12}/> DOCX
                  </button>
                  <button onClick={()=>downloadMemoire('pdf')} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 13px',borderRadius:8,border:'1px solid rgba(148,163,184,.2)',background:'none',color:'#94a3b8',cursor:'pointer',fontSize:'.78rem'}}>
                    <Download size={12}/> PDF
                  </button>
                </>
              )}
              <button onClick={generateMemoire} disabled={memoireLoading||!activeTenderId}
                style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:9,border:'none',background:'#facc15',color:'#060e18',cursor:memoireLoading||!activeTenderId?'not-allowed':'pointer',fontWeight:800,fontSize:'.82rem',opacity:!activeTenderId?.5:1}}>
                {memoireLoading
                  ? <><Loader2 size={13} style={{animation:'ds-spin .8s linear infinite'}}/> Génération…</>
                  : memoireGenerated
                  ? <><RefreshCw size={13}/> Régénérer</>
                  : <><BookOpen size={13}/> Générer</>}
              </button>
            </div>
          </div>

          {memoireLoading && (
            <div style={{padding:'40px 24px',textAlign:'center'}}>
              <Loader2 size={32} color="#facc15" style={{animation:'ds-spin .8s linear infinite',marginBottom:12}}/>
              <p style={{color:'#64748b',fontSize:'.84rem'}}>Génération de la mémoire technique en cours…</p>
              <p style={{color:'#334155',fontSize:'.74rem',marginTop:4}}>Analyse du besoin · Méthodologie · Équipe · Planning · Références · Risques</p>
            </div>
          )}

          {memoireGenerated && memoireContent && !memoireLoading && (
            <div style={{padding:'20px 24px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <CheckCircle2 size={15} color="#22c55e"/>
                <span style={{fontSize:'.78rem',color:'#86efac'}}>Mémoire générée via <strong>{memoireProvider}</strong></span>
                <span style={{fontSize:'.72rem',color:'#475569',marginLeft:8}}>{memoireContent.split(/\s+/).length} mots</span>
              </div>
              <textarea
                value={memoireContent}
                onChange={e=>setMemoireContent(e.target.value)}
                rows={32}
                style={{width:'100%',padding:'16px',background:'rgba(0,0,0,.25)',border:'1px solid rgba(148,163,184,.1)',borderRadius:10,color:'#e2e8f0',fontSize:'.82rem',fontFamily:'monospace',lineHeight:1.7,resize:'vertical',boxSizing:'border-box' as const}}
              />
            </div>
          )}

          {!memoireLoading && !memoireGenerated && (
            <div style={{padding:'48px 24px',textAlign:'center'}}>
              <BookOpen size={40} color="#facc15" style={{opacity:.2,marginBottom:12}}/>
              <p style={{color:'#475569',fontSize:'.86rem',maxWidth:400,margin:'0 auto',lineHeight:1.6}}>
                Sélectionnez un AO et cliquez <strong style={{color:'#facc15'}}>Générer</strong> pour produire une mémoire technique complète en 8 sections prête à soumettre.
              </p>
              <p style={{color:'#334155',fontSize:'.74rem',marginTop:8}}>
                Compréhension du besoin · Approche méthodologique · Équipe · Planning · Références · Valeur ajoutée · Risques · Budget
              </p>
            </div>
          )}
        </section>
      )}

      {/* Go/No-Go Advisor */}
      {showGoNoGo && activeTenderId && (
        <section className="panel" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(148,163,184,.08)',display:'flex',alignItems:'center',gap:10}}>
            <CheckCircle2 size={15} color="#22c55e"/>
            <span style={{fontWeight:700,fontSize:'.88rem'}}>Go/No-Go Advisor IA</span>
            <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
              <select value={activeTenderId??''} onChange={e=>setActiveTenderId(Number(e.target.value))}
                style={{padding:'6px 12px',borderRadius:8,background:'rgba(255,255,255,.05)',border:'1px solid rgba(148,163,184,.15)',color:'#e2e8f0',fontSize:'.82rem',minWidth:200}}>
                {tenders.map(t => <option key={t.id} value={t.id}>#{t.id} — {t.title.slice(0,45)}</option>)}
              </select>
            </div>
          </div>
          <div style={{padding:'16px 20px'}}>
            <GoNoGoAdvisorPanel tenderId={activeTenderId} />
          </div>
        </section>
      )}

      {/* Workflow Timeline */}
      {showTimeline && activeTenderId && (
        <section className="panel" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(148,163,184,.08)',display:'flex',alignItems:'center',gap:10}}>
            <Zap size={15} color="#facc15"/>
            <span style={{fontWeight:700,fontSize:'.88rem'}}>Timeline Workflow</span>
            <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
              <select value={activeTenderId??''} onChange={e=>setActiveTenderId(Number(e.target.value))}
                style={{padding:'6px 12px',borderRadius:8,background:'rgba(255,255,255,.05)',border:'1px solid rgba(148,163,184,.15)',color:'#e2e8f0',fontSize:'.82rem',minWidth:200}}>
                {tenders.map(t => <option key={t.id} value={t.id}>#{t.id} — {t.title.slice(0,45)}</option>)}
              </select>
            </div>
          </div>
          <div style={{padding:'16px 20px'}}>
            <TenderWorkflowTimeline tenderId={activeTenderId} token={accessKey} />
          </div>
        </section>
      )}

      {/* Auto-Import IA */}
      {showAutoImport && (
        <TenderAutoImportPanel
          token={accessKey}
          onImported={(id) => { if(id) setActiveTenderId(id); loadTenders(); setShowAutoImport(false); setShowWorkflow(true); }}
        />
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
    } catch(e) { setMsg(lang === 'en' ? 'BOAMP error — check connection.' : 'Erreur BOAMP — vérifiez la connexion.'); }
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
