/**
 * TenderPDFUpload — Import AO depuis un fichier PDF
 *
 * Features:
 *   - Drag & drop ou clic pour sélectionner
 *   - Extraction automatique (objet, acheteur, budget, délais, exigences)
 *   - Création automatique du tender avec les données extraites
 *   - Score de confiance de l'extraction
 *   - Preview des champs avant création
 */

import { useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle, ChevronRight,
  FileText, Loader, Upload, X,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import { API_BASE } from '../api/config';

interface Props {
  opportunityId: number;
  opportunityTitle?: string;
  onCreated?: (tenderId: number) => void;
  onClose?: () => void;
}

interface ExtractionResult {
  filename:          string;
  file_size_kb:      number;
  total_pages:       number;
  confidence:        number;
  objet?:            string;
  organisme?:        string;
  budget_text?:      string;
  delai_text?:       string;
  deadline_text?:    string;
  procedure?:        string;
  requirements:      string[];
  technical_keywords: string[];
  detected_lots:     string[];
  sections_found:    string[];
  success:           boolean;
  error?:            string;
}

interface CreationResult {
  tender:               { id: number; title: string; reference: string; buyer_name: string };
  requirements_created: number;
  extraction:           { pages: number; confidence: number; technical_keywords: string[] };
}

export default function TenderPDFUpload({ opportunityId, opportunityTitle, onCreated, onClose }: Props) {
  const token = tokenStorage.get();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'idle' | 'extracting' | 'preview' | 'creating' | 'done'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [created, setCreated] = useState<CreationResult | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont supportés.');
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 25 MB).');
      return;
    }
    setFile(f);
    setError(null);
    setStep('extracting');

    try {
      const form = new FormData();
      form.append('file', f);
      // API_BASE imported from '../api/config'
      const res = await fetch(`${API_BASE}/pdf-ao/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Erreur extraction' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json() as ExtractionResult;
      setExtraction(data);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur extraction PDF');
      setStep('idle');
    }
  }

  async function handleCreate() {
    if (!file) return;
    setStep('creating');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('opportunity_id', String(opportunityId));
      // API_BASE imported from '../api/config'
      const res = await fetch(`${API_BASE}/pdf-ao/analyze-and-create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Erreur création' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json() as CreationResult;
      setCreated(data);
      setStep('done');
      onCreated?.(data.tender.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création AO');
      setStep('preview');
    }
  }

  const confColor = (c: number) => c >= 0.8 ? '#86efac' : c >= 0.5 ? '#fde68a' : '#fca5a5';
  const confLabel = (c: number) => c >= 0.8 ? 'Haute' : c >= 0.5 ? 'Moyenne' : 'Faible';

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const s = {
    wrap: {
      background: '#0c1829',
      border: '1px solid rgba(148,163,184,.12)',
      borderRadius: 18, padding: 'clamp(18px,3vw,28px)',
      maxWidth: 640,
    } as React.CSSProperties,
    dropzone: (active: boolean): React.CSSProperties => ({
      border: `2px dashed ${active ? '#facc15' : 'rgba(148,163,184,.2)'}`,
      borderRadius: 14, padding: 'clamp(24px,5vw,40px)',
      textAlign: 'center', cursor: 'pointer',
      background: active ? 'rgba(250,204,21,.04)' : 'rgba(255,255,255,.02)',
      transition: 'all .2s',
    }),
    field: {
      background: 'rgba(0,0,0,.25)', border: '1px solid rgba(148,163,184,.08)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 8,
    } as React.CSSProperties,
    badge: (ok: boolean): React.CSSProperties => ({
      display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '.7rem', fontWeight: 700,
      background: ok ? 'rgba(34,197,94,.1)' : 'rgba(148,163,184,.08)',
      color: ok ? '#86efac' : '#64748b',
      border: `1px solid ${ok ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.1)'}`,
      marginRight: 4, marginBottom: 4,
    }),
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <FileText size={18} color="#facc15" />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '.95rem' }}>
            Import AO depuis PDF
          </div>
          {opportunityTitle && (
            <div style={{ fontSize: '.74rem', color: '#475569', marginTop: 2 }}>→ {opportunityTitle}</div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#fca5a5', fontSize: '.82rem', marginBottom: 14, alignItems: 'center' }}>
          <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5' }}><X size={12} /></button>
        </div>
      )}

      {/* ── Step: Idle / Drop zone ── */}
      {step === 'idle' && (
        <div
          style={s.dropzone(drag)}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={28} color={drag ? '#facc15' : '#475569'} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
            {drag ? 'Relâcher pour analyser' : 'Glissez votre PDF ici'}
          </div>
          <div style={{ fontSize: '.78rem', color: '#475569' }}>
            ou cliquez pour sélectionner — Max 25 MB
          </div>
          <div style={{ marginTop: 10, fontSize: '.72rem', color: '#334155' }}>
            Extraction automatique : objet, acheteur, budget, délais, exigences techniques
          </div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* ── Step: Extracting ── */}
      {step === 'extracting' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Loader size={24} color="#facc15" style={{ animation: 'ds-spin .8s linear infinite', margin: '0 auto 14px' }} />
          <div style={{ fontWeight: 700, color: '#94a3b8' }}>Analyse du PDF en cours…</div>
          <div style={{ fontSize: '.78rem', color: '#475569', marginTop: 6 }}>{file?.name}</div>
          <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && extraction && (
        <div>
          {/* Extraction meta */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '.78rem', color: '#64748b' }}>{file?.name}</span>
            <span style={{ fontSize: '.72rem', color: '#64748b' }}>{extraction.total_pages} pages · {extraction.file_size_kb} KB</span>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: confColor(extraction.confidence) }}>
              Confiance : {confLabel(extraction.confidence)} ({Math.round(extraction.confidence * 100)}%)
            </span>
          </div>

          {/* Extracted fields */}
          {[
            { label: 'Objet',         value: extraction.objet },
            { label: 'Acheteur',      value: extraction.organisme },
            { label: 'Budget',        value: extraction.budget_text },
            { label: 'Délai',         value: extraction.delai_text },
            { label: 'Date limite',   value: extraction.deadline_text },
            { label: 'Procédure',     value: extraction.procedure },
          ].filter(f => f.value).map(({ label, value }) => (
            <div key={label} style={s.field}>
              <div style={{ fontSize: '.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3, fontFamily: 'monospace' }}>{label}</div>
              <div style={{ fontSize: '.84rem', color: '#e2e8f0', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}

          {/* Keywords */}
          {extraction.technical_keywords.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '.7rem', color: '#64748b', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'monospace' }}>
                Mots-clés techniques ({extraction.technical_keywords.length})
              </div>
              {extraction.technical_keywords.map(k => (
                <span key={k} style={s.badge(true)}>{k}</span>
              ))}
            </div>
          )}

          {/* Requirements count */}
          {extraction.requirements.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(250,204,21,.05)', border: '1px solid rgba(250,204,21,.12)', borderRadius: 10, marginBottom: 14, fontSize: '.82rem', color: '#fde68a' }}>
              <strong>{extraction.requirements.length} exigence{extraction.requirements.length > 1 ? 's' : ''}</strong> détectée{extraction.requirements.length > 1 ? 's' : ''} — elles seront ajoutées automatiquement à l'AO.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => { setStep('idle'); setFile(null); setExtraction(null); }}
              style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.83rem' }}>
              ← Recommencer
            </button>
            <button onClick={handleCreate}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Créer l'AO <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Creating ── */}
      {step === 'creating' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Loader size={24} color="#facc15" style={{ animation: 'ds-spin .8s linear infinite', margin: '0 auto 14px' }} />
          <div style={{ fontWeight: 700, color: '#94a3b8' }}>Création de l'appel d'offres…</div>
          <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === 'done' && created && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <CheckCircle size={32} color="#86efac" style={{ margin: '0 auto 14px' }} />
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.1rem', marginBottom: 8 }}>
            AO créé avec succès !
          </div>
          <div style={{ fontSize: '.84rem', color: '#94a3b8', marginBottom: 18, lineHeight: 1.6 }}>
            <strong style={{ color: '#f1f5f9' }}>{created.tender.title}</strong><br/>
            Réf. {created.tender.reference} · {created.requirements_created} exigences importées
          </div>
          {onClose && (
            <button onClick={onClose}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800 }}>
              Voir l'AO →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
