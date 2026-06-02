import React from 'react';
/**
 * SuggestionsValidationPanel — Review and validate AI-suggested entities
 * (organizations, opportunities, tenders from BOAMP/AI analysis)
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Bot, CheckCircle, XCircle, RefreshCw, Zap,
  Building2, TrendingUp, FileText, ExternalLink,
  ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface PendingOrg {
  id: number; name: string; sector: string | null;
  country: string | null; website: string | null;
  source: string; confidence_score: number | null;
  source_url: string | null; ai_notes: string | null;
  created_at: string | null;
}

interface PendingOpp {
  id: number; title: string; organization_id: number;
  sector: string | null; probability: number;
  source: string; confidence_score: number | null;
  source_url: string | null; ai_notes: string | null;
  created_at: string | null;
}

interface PendingTender {
  id: number; title: string; buyer_name: string | null;
  reference: string | null; submission_deadline: string | null;
  source: string; confidence_score: number | null;
  source_url: string | null; ai_notes: string | null;
  created_at: string | null;
}

interface Pending {
  organizations: PendingOrg[];
  opportunities: PendingOpp[];
  tenders: PendingTender[];
}

type Decision = 'accept' | 'reject' | null;
type EntityType = 'organization' | 'opportunity' | 'tender';

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#86efac' : pct >= 40 ? '#fde68a' : '#fca5a5';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '.68rem', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', color }}>
      {pct}%
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    boamp: '#93c5fd', ted: '#a78bfa', ai_suggested: '#fde68a', manual_import: '#94a3b8',
  };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '.66rem', fontFamily: 'monospace', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(148,163,184,.15)', color: colors[source] || '#94a3b8' }}>
      {source}
    </span>
  );
}

export default function SuggestionsValidationPanel() {
  const token = tokenStorage.get();
  const [data, setData] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [expandedSection, setExpandedSection] = useState<EntityType | null>('tender');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest<Pending>('/suggestions/pending', {}, token);
      setData(d);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function decide(type: EntityType, id: number, d: Decision) {
    setDecisions(prev => ({ ...prev, [`${type}:${id}`]: d }));
  }

  function decideAll(type: EntityType, ids: number[], d: Decision) {
    setDecisions(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[`${type}:${id}`] = d; });
      return next;
    });
  }

  async function submitValidation() {
    const items = Object.entries(decisions)
      .filter(([, d]) => d !== null)
      .map(([key, d]) => {
        const [type, id] = key.split(':');
        return { entity_type: type, entity_id: parseInt(id), accept: d === 'accept' };
      });
    if (items.length === 0) { setMsg({ ok: false, text: 'Aucune décision sélectionnée.' }); return; }
    setSubmitting(true);
    try {
      const result = await apiRequest<any>('/suggestions/validate', {
        method: 'POST',
        body: JSON.stringify({ items, validated_by: 'Administrateur' }),
      }, token);
      setMsg({ ok: true, text: `${result.validated} validé(s), ${result.rejected} rejeté(s).` });
      setDecisions({});
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setSubmitting(false); }
  }

  async function triggerBoamp() {
    setScanning(true);
    try {
      const r = await apiRequest<any>('/suggestions/scan/boamp', { method: 'POST', body: JSON.stringify({ days_back: 3, max_results: 15, min_score: 0.4 }) }, token);
      setMsg({ ok: true, text: `BOAMP: ${r.created_tenders || 0} AO suggérés, ${r.created_opportunities || 0} opportunités.` });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur BOAMP' });
    } finally { setScanning(false); }
  }

  async function handleImport() {
    if (importText.trim().length < 30) { setMsg({ ok: false, text: 'Texte trop court.' }); return; }
    setImporting(true);
    try {
      const r = await apiRequest<any>('/suggestions/import/text', { method: 'POST', body: JSON.stringify({ text: importText, source_label: 'manual_import' }) }, token);
      setMsg({ ok: true, text: `Suggestion créée : "${r.title}" (score ${Math.round((r.score || 0) * 100)}%)` });
      setImportText('');
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setImporting(false); }
  }

  const totalPending = data
    ? data.organizations.length + data.opportunities.length + data.tenders.length
    : 0;
  const totalDecided = Object.values(decisions).filter(d => d !== null).length;

  const card: React.CSSProperties = { background: 'rgba(12,20,37,.85)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 14, overflow: 'hidden' };
  const decBtn = (active: Decision, d: Decision) => ({
    padding: '5px 12px', borderRadius: 7, border: `1px solid ${d === 'accept' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
    background: active === d ? (d === 'accept' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)') : 'none',
    cursor: 'pointer', color: d === 'accept' ? '#86efac' : '#fca5a5', fontSize: '.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
  } as React.CSSProperties);

  function Section({ type, items, icon, label }: { type: EntityType; items: any[]; icon: React.ReactNode; label: string }) {
    const open = expandedSection === type;
    const decided = items.filter(i => decisions[`${type}:${i.id}`] !== undefined).length;
    return (
      <div style={card}>
        <button onClick={() => setExpandedSection(open ? null : type)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}>
          {icon}
          <span style={{ fontWeight: 700, fontSize: '.88rem', flex: 1 }}>{label}</span>
          <span style={{ fontFamily: 'monospace', fontSize: '.72rem', color: items.length > 0 ? '#fde68a' : '#475569' }}>{items.length} en attente</span>
          {decided > 0 && <span style={{ fontFamily: 'monospace', fontSize: '.68rem', color: '#86efac' }}>{decided} décidé(s)</span>}
          {open ? <ChevronUp size={13} color="#64748b" /> : <ChevronDown size={13} color="#64748b" />}
        </button>
        {open && items.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(148,163,184,.07)' }}>
            {/* Select all bar */}
            <div style={{ padding: '8px 18px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid rgba(148,163,184,.05)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '.72rem', color: '#64748b', flex: 1 }}>Sélection rapide :</span>
              <button style={decBtn('accept', 'accept')} onClick={() => decideAll(type, items.map(i => i.id), 'accept')}>
                <CheckCircle size={10} /> Tout valider
              </button>
              <button style={decBtn('reject', 'reject')} onClick={() => decideAll(type, items.map(i => i.id), 'reject')}>
                <XCircle size={10} /> Tout rejeter
              </button>
            </div>
            {items.map(item => {
              const key = `${type}:${item.id}`;
              const dec = decisions[key] ?? null;
              return (
                <div key={item.id} style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,.05)', background: dec === 'accept' ? 'rgba(34,197,94,.03)' : dec === 'reject' ? 'rgba(239,68,68,.03)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: '.86rem', marginBottom: 5 }}>
                        {item.name || item.title}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                        <SourceBadge source={item.source} />
                        <ConfidenceBadge score={item.confidence_score} />
                        {item.sector && <span style={{ fontSize: '.72rem', color: '#64748b', padding: '1px 7px', borderRadius: 99, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(148,163,184,.1)' }}>{item.sector}</span>}
                        {item.buyer_name && <span style={{ fontSize: '.72rem', color: '#94a3b8' }}>{item.buyer_name}</span>}
                        {item.submission_deadline && (
                          <span style={{ fontSize: '.72rem', color: '#fde68a', fontFamily: 'monospace' }}>
                            ⏰ {new Date(item.submission_deadline).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                      {item.ai_notes && (
                        <div style={{ fontSize: '.77rem', color: '#64748b', fontStyle: 'italic', marginBottom: 4 }}>
                          {item.ai_notes}
                        </div>
                      )}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: '.7rem', color: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={10} /> Source
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      <button style={decBtn(dec, 'accept')} onClick={() => decide(type, item.id, dec === 'accept' ? null : 'accept')}>
                        <CheckCircle size={11} /> Valider
                      </button>
                      <button style={decBtn(dec, 'reject')} onClick={() => decide(type, item.id, dec === 'reject' ? null : 'reject')}>
                        <XCircle size={11} /> Rejeter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {open && items.length === 0 && (
          <div style={{ padding: '20px 18px', color: '#475569', fontSize: '.82rem', borderTop: '1px solid rgba(148,163,184,.07)' }}>
            Aucune suggestion en attente.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}>
          <Bot size={18} color="#facc15" />
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', letterSpacing: '-.02em' }}>
              Suggestions IA
            </div>
            <div style={{ fontSize: '.74rem', color: '#64748b' }}>
              {totalPending} entité{totalPending !== 1 ? 's' : ''} en attente · {totalDecided} décision{totalDecided !== 1 ? 's' : ''} prête{totalDecided !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={triggerBoamp} disabled={scanning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'rgba(147,197,253,.1)', border: '1px solid rgba(147,197,253,.2)', color: '#93c5fd', cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '.78rem', fontWeight: 700 }}>
            <Zap size={12} style={scanning ? { animation: 'spin 1s linear infinite' } : {}} />
            {scanning ? 'Scan BOAMP…' : 'Scanner BOAMP'}
          </button>
          <button onClick={load} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', borderRadius: 9, background: msg.ok ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: msg.ok ? '#86efac' : '#fca5a5', fontSize: '.82rem' }}>
          {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '.8rem' }}>✕</button>
        </div>
      )}

      {/* Sections */}
      {data && (
        <>
          <Section type="tender" items={data.tenders} icon={<FileText size={15} color="#93c5fd" />} label="Appels d'offres suggérés" />
          <Section type="opportunity" items={data.opportunities} icon={<TrendingUp size={15} color="#fde68a" />} label="Opportunités suggérées" />
          <Section type="organization" items={data.organizations} icon={<Building2 size={15} color="#a78bfa" />} label="Organismes suggérés" />
        </>
      )}

      {/* Submit bar */}
      {totalDecided > 0 && (
        <div style={{ position: 'sticky', bottom: 16, background: 'rgba(12,20,37,.95)', border: '1px solid rgba(250,204,21,.25)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, backdropFilter: 'blur(10px)' }}>
          <span style={{ fontSize: '.84rem', color: '#fde68a', fontWeight: 600, flex: 1 }}>
            {totalDecided} décision{totalDecided !== 1 ? 's' : ''} prête{totalDecided !== 1 ? 's' : ''} à appliquer
          </span>
          <button onClick={() => setDecisions({})} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,.2)', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '.78rem' }}>
            Annuler
          </button>
          <button onClick={submitValidation} disabled={submitting}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '.85rem', fontFamily: 'Syne, sans-serif' }}>
            {submitting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
            Appliquer les décisions
          </button>
        </div>
      )}

      {/* Import from text */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <Bot size={14} color="#fde68a" />
          <span style={{ fontWeight: 700, fontSize: '.86rem' }}>Importer un AO depuis du texte</span>
        </div>
        <p style={{ fontSize: '.78rem', color: '#64748b', marginBottom: 12 }}>
          Collez un texte (email, description d'AO, page web…). L'IA extrait les champs structurés et crée une suggestion à valider.
        </p>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Collez ici le texte de l'appel d'offres ou de l'opportunité…"
          style={{ width: '100%', minHeight: 100, padding: '10px 13px', background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(148,163,184,.15)', borderRadius: 9, color: '#f1f5f9', fontSize: '.83rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleImport} disabled={importing || importText.trim().length < 30}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: importing ? 'rgba(250,204,21,.4)' : '#facc15', color: '#060e18', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '.82rem', fontFamily: 'Syne, sans-serif' }}>
            {importing ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Bot size={12} />}
            {importing ? 'Analyse en cours…' : 'Analyser et suggérer'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
