/**
 * DeliverablePage — Bibliothèque complète des livrables
 * Liste, lecture, édition inline, export PDF/HTML/MD, versioning
 */

import { useI18n } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle, ChevronDown, ChevronUp, Download,
  Edit3, FileText, Plus, RefreshCw, Save, X,
  Sparkles, Loader2, Brain, GitMerge, Filter, History, Paperclip,
} from 'lucide-react';
import DeliverableVersionsPanel from '../components/DeliverableVersionsPanel';
import FileAttachments from '../components/FileAttachments';
import EmailPreviewModal from '../components/EmailPreviewModal';
import { apiRequest, tokenStorage } from '../api/client';
import { API_BASE } from '../api/config';

interface Deliverable {
  id: number; title: string; deliverable_type: string;
  status: string; version: number; content_markdown?: string;
  created_at: string; updated_at: string;
  tender_id?: number; opportunity_id?: number;
}

const TYPE_LABEL: Record<string, string> = {
  technical_proposal: 'Mémoire technique', note_cadrage: 'Note de cadrage',
  commercial_proposal: 'Proposition commerciale', report: 'Rapport',
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', review: '#fde68a', approved: '#86efac', rejected: '#fca5a5',
};

export default function DeliverablePage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing,  setEditing]  = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [generating, setGenerating] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState<number | null>(null);
  const [showAttachments, setShowAttachments] = useState<number | null>(null);
  const [emailPreview, setEmailPreview] = useState<{id:number;title:string} | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('technical_proposal');

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<Deliverable[]>('/deliverables?limit=50', {}, token)
      .then(list => setDeliverables(list ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      await apiRequest(`/deliverables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content_markdown: editContent }),
      }, token);
      setEditing(null);
      setMsg('✅ Livrable sauvegardé');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(`❌ ${String(e).slice(0, 80)}`); }
    finally { setSaving(false); }
  }

  async function generateWithAI(id: number) {
    if (!token) return;
    setGenerating(id);
    try {
      const d = deliverables.find(x => x.id === id);
      const result = await apiRequest<{content:string;provider:string}>(`/deliverables/${id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ tender_id: d?.tender_id }),
      }, token);
      setMsg(`✅ Contenu généré via ${result.provider}`);
      load();
    } catch(e) {
      setMsg(`❌ Erreur génération : ${String(e).slice(0,80)}`);
    } finally {
      setGenerating(null);
      setTimeout(() => setMsg(''), 4000);
    }
  }

  async function createDeliverable() {
    if (!newTitle.trim() || !token) return;
    try {
      await apiRequest('/deliverables', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), deliverable_type: newType, status: 'draft' }),
      }, token);
      setShowNewForm(false); setNewTitle(''); setNewType('technical_proposal');
      setMsg('✅ Livrable créé'); load(); setTimeout(() => setMsg(''), 3000);
    } catch(e) { setMsg(`❌ ${String(e).slice(0,80)}`); }
  }

  async function approve(id: number) {
    await apiRequest(`/deliverables/${id}/approve`, { method: 'POST' }, token);
    setMsg('✅ Livrable approuvé');
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  function exportUrl(id: number, fmt: string) {
    return `${API_BASE}/deliverables/${id}/export/${fmt}?token=${token}`;
  }

  if (!token) return (
    <main className="app-shell"><section className="panel"><h1>{t('deliverables.title')}</h1><p>Connecte-toi d'abord.</p></section></main>
  );

  const byStatus = (s: string) => deliverables.filter(d => d.status === s);

  return (
    <main className="app-shell">
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Livrables gouvernés</p>
            <h1>Bibliothèque de livrables</h1>
            <p className="subtitle">Mémoires techniques, propositions commerciales, notes de cadrage. Générés par IA, validés par vous.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {[['draft','Brouillons'],['review','En révision'],['approved','Approuvés']].map(([s,l]) => (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                style={{ padding: '4px 12px', borderRadius: 99, border: `1px solid ${STATUS_COLOR[s]}${filterStatus===s?'60':'30'}`, background: `${STATUS_COLOR[s]}${filterStatus===s?'18':'08'}`, color: STATUS_COLOR[s], fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>
                {byStatus(s).length} {l}
              </button>
            ))}
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: '#0c1425', color: '#94a3b8', fontSize: '.74rem', cursor: 'pointer' }}>
              <option value="all">Tous types</option>
              {Object.entries(TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={load} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#475569', cursor: 'pointer' }}>
              <RefreshCw size={13} />
            </button>
            <button onClick={() => setShowNewForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.78rem' }}>
              <Plus size={13} /> Nouveau
            </button>
          </div>
        </div>
      </section>

      {msg && (
        <div style={{ padding: '10px 18px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`, color: msg.startsWith('✅') ? '#86efac' : '#fca5a5', fontSize: '.84rem', marginBottom: 4 }}>
          {msg}
        </div>
      )}

      {showNewForm && (
        <section className="panel" style={{ background: 'rgba(250,204,21,.03)', border: '1px solid rgba(250,204,21,.12)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '.88rem', fontWeight: 800 }}>Nouveau livrable</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '.74rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Titre</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Mémoire Technique — Mission Data SACEM"
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.84rem', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ fontSize: '.74rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)}
                style={{ padding: '9px 12px', background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.84rem' }}>
                {Object.entries(TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button onClick={createDeliverable} disabled={!newTitle.trim()}
              style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem', opacity: !newTitle.trim() ? .5 : 1 }}>
              Créer
            </button>
            <button onClick={() => setShowNewForm(false)}
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer' }}>
              <X size={13} />
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <section className="panel" style={{ textAlign: 'center', color: '#475569', padding: 40 }}>Chargement…</section>
      ) : deliverables.length === 0 ? (
        <section className="panel" style={{ textAlign: 'center', padding: 48 }}>
          <FileText size={36} color="#334155" style={{ marginBottom: 12 }} />
          <p style={{ color: '#475569', fontSize: '.88rem', marginBottom: 8 }}>Aucun livrable pour l'instant.</p>
          <p style={{ color: '#334155', fontSize: '.78rem' }}>Lance un workflow AO → l'étape 7 génère automatiquement le mémoire technique.</p>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {deliverables.filter(d =>
            (filterStatus === 'all' || d.status === filterStatus) &&
            (filterType === 'all' || d.deliverable_type === filterType)
          ).map(d => {
            const isExp = expanded === d.id;
            const isEd  = editing === d.id;
            return (
              <section key={d.id} className="panel" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${STATUS_COLOR[d.status] ?? '#334155'}25` }}>
                {/* Header */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
                     onClick={() => { setExpanded(isExp ? null : d.id); setEditing(null); }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: '.92rem', color: '#e2e8f0' }}>{d.title}</span>
                      <span style={{ fontSize: '.68rem', padding: '1px 7px', borderRadius: 99, background: `${STATUS_COLOR[d.status]}15`, color: STATUS_COLOR[d.status], border: `1px solid ${STATUS_COLOR[d.status]}30`, fontWeight: 700, textTransform: 'capitalize' as const }}>
                        {d.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: '.74rem', color: '#475569', flexWrap: 'wrap' }}>
                      <span>{TYPE_LABEL[d.deliverable_type] ?? d.deliverable_type}</span>
                      <span>v{d.version}</span>
                      {d.tender_id && <span>AO #{d.tender_id}</span>}
                      <span>{new Date(d.updated_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {/* Export buttons */}
                    <a href={`${API_BASE}/deliverables/${d.id}/export/pdf`} target="_blank" rel="noopener noreferrer"
                       title="Exporter PDF"
                       style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'rgba(239,68,68,.06)', color: '#fca5a5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      <Download size={11} /> PDF
                    </a>
                    <a href={`${API_BASE}/deliverables/${d.id}/export/markdown`} target="_blank" rel="noopener noreferrer"
                       title="Télécharger Markdown"
                       download
                       style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'rgba(14,165,233,.06)', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      <Download size={11} /> MD
                    </a>
                    <a href={`/api/v1/deliverables/${d.id}/export/docx`} target="_blank" rel="noopener noreferrer"
                       title="Télécharger Word"
                       download
                       style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(37,99,235,.3)', background: 'rgba(37,99,235,.06)', color: '#93c5fd', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      <Download size={11} /> DOCX
                    </a>

                    {/* Edit */}
                    <button onClick={() => { setEditing(isEd ? null : d.id); setEditContent(d.content_markdown ?? ''); setExpanded(d.id); }}
                      style={{ padding: '5px 9px', borderRadius: 7, border: `1px solid ${isEd ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.15)'}`, background: isEd ? 'rgba(250,204,21,.08)' : 'none', color: isEd ? '#facc15' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      <Edit3 size={11} /> Éditer
                    </button>
                    {/* Email Preview */}
                    {d.status === 'approved' && (
                      <button onClick={() => setEmailPreview({ id: d.id, title: d.title })}
                        style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(14,165,233,.25)', background: 'rgba(14,165,233,.06)', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                        ✉ Email
                      </button>
                    )}
                    {/* Versions */}
                    <button onClick={() => setShowVersions(showVersions === d.id ? null : d.id)}
                      style={{ padding: '5px 9px', borderRadius: 7, border: `1px solid ${showVersions===d.id?'rgba(139,92,246,.3)':'rgba(148,163,184,.15)'}`, background: showVersions===d.id?'rgba(139,92,246,.08)':'none', color: showVersions===d.id?'#c4b5fd':'#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      <History size={11} /> v{d.version}
                    </button>
                    {/* Pièces jointes */}
                    <button onClick={() => setShowAttachments(showAttachments === d.id ? null : d.id)}
                      style={{ padding: '5px 9px', borderRadius: 7, border: `1px solid ${showAttachments===d.id?'rgba(34,197,94,.3)':'rgba(148,163,184,.15)'}`, background: showAttachments===d.id?'rgba(34,197,94,.08)':'none', color: showAttachments===d.id?'#86efac':'#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      <Paperclip size={11} /> Fichiers
                    </button>
                    {/* Générer IA */}
                    {d.status === 'draft' && (
                      <button onClick={() => generateWithAI(d.id)} disabled={generating === d.id}
                        style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(250,204,21,.25)', background: 'rgba(250,204,21,.06)', color: '#facc15', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                        {generating === d.id
                          ? <><Loader2 size={11} style={{ animation: 'ds-spin .7s linear infinite' }} /> IA…</>
                          : <><Sparkles size={11} /> Générer IA</>}
                      </button>
                    )}
                    {/* Approve */}
                    {d.status !== 'approved' && (
                      <button onClick={() => approve(d.id)}
                        style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(34,197,94,.25)', background: 'rgba(34,197,94,.06)', color: '#86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                        <CheckCircle size={11} /> Approuver
                      </button>
                    )}
                  </div>

                  <div style={{ color: '#475569', marginLeft: 4 }}>
                    {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExp && (
                  <div style={{ borderTop: '1px solid rgba(148,163,184,.08)', padding: '0 18px 18px' }}>
                    {isEd ? (
                      <div style={{ marginTop: 14 }}>
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={20}
                          style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,.25)', border: '1.5px solid rgba(250,204,21,.2)', borderRadius: 10, color: '#f1f5f9', fontSize: '.84rem', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const, lineHeight: 1.6 }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditing(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '.82rem' }}>
                            <X size={13} /> Annuler
                          </button>
                          <button onClick={() => saveEdit(d.id)} disabled={saving}
                            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                            {saving ? <RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> : <Save size={13} />}
                            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 14 }}>
                        {d.content_markdown ? (
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '.82rem', color: '#94a3b8', lineHeight: 1.7, background: 'rgba(0,0,0,.15)', padding: '14px 16px', borderRadius: 10, maxHeight: 500, overflow: 'auto' }}>
                            {d.content_markdown.slice(0, 3000)}{d.content_markdown.length > 3000 ? '\n\n[... Cliquez Éditer pour voir la suite ...]' : ''}
                          </pre>
                        ) : (
                          <p style={{ color: '#334155', fontSize: '.82rem', padding: '14px 0' }}>Aucun contenu — cliquez Éditer pour rédiger.</p>
                        )}
                      </div>
                    )}

                    {/* Historique des versions */}
                    {showVersions === d.id && (
                      <div style={{ marginTop: 16, borderTop: '1px solid rgba(148,163,184,.08)', paddingTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <History size={13} color="#c4b5fd" />
                          <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#c4b5fd' }}>Historique des versions</span>
                        </div>
                        <DeliverableVersionsPanel
                          deliverableId={d.id}
                          currentVersion={d.version}
                          onRestored={() => { load(); setShowVersions(null); }}
                        />
                      </div>
                    )}

                    {/* Pièces jointes */}
                    {showAttachments === d.id && (
                      <div style={{ marginTop: 16, borderTop: '1px solid rgba(148,163,184,.08)', paddingTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Paperclip size={13} color="#86efac" />
                          <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#86efac' }}>Pièces jointes</span>
                        </div>
                        <FileAttachments resourceType="deliverable" resourceId={d.id} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {/* Email Preview Modal */}
      {emailPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <EmailPreviewModal
            deliverableId={emailPreview.id}
            deliverableTitle={emailPreview.title}
            onClose={() => setEmailPreview(null)}
          />
        </div>
      )}
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );
}
