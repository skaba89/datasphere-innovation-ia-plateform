import { useState } from 'react';
import { CheckCircle2, Copy, Loader2, Mail, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { EmailPreview } from '../api/domainTypes';

interface Props {
  deliverableId: number;
  deliverableTitle: string;
  onClose: () => void;
}

export default function EmailPreviewModal({ deliverableId, deliverableTitle, onClose }: Props) {
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'html' | 'text' | 'info'>('html');
  const token = tokenStorage.get();

  useState(() => {
    apiRequest<EmailPreview>(`/deliverables/${deliverableId}/email-preview`, {}, token)
      .then(setPreview)
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  });

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const tabBtn = (t: typeof tab): React.CSSProperties => ({
    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
    background: tab === t ? 'rgba(250,204,21,0.12)' : 'none',
    color: tab === t ? '#facc15' : '#94a3b8',
    borderBottom: `2px solid ${tab === t ? '#facc15' : 'transparent'}`,
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '100%', maxWidth: 780, maxHeight: '90vh',
        background: '#0d1f35',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 22px',
          borderBottom: '1px solid rgba(148,163,184,0.1)',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}>
          <Mail size={18} color="#facc15" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>Email client — aperçu</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deliverableTitle}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Génération de l'email…
          </div>
        )}

        {error && (
          <div style={{ padding: '20px', color: '#fca5a5', textAlign: 'center', fontSize: '0.84rem' }}>{error}</div>
        )}

        {preview && (
          <>
            {/* Subject + meta */}
            <div style={{ padding: '14px 22px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(148,163,184,0.08)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.76rem', color: '#64748b', width: 40 }}>Objet</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>{preview.subject}</span>
                <button onClick={() => copy(preview.subject, 'subject')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem' }}>
                  {copied === 'subject' ? <CheckCircle2 size={12} color="#22c55e" /> : <Copy size={12} />}
                  Copier
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: '#64748b' }}>
                <span><strong style={{ color: '#94a3b8' }}>De :</strong> {preview.from_name}</span>
                <span><strong style={{ color: '#94a3b8' }}>À :</strong> {preview.to_name} &lt;{preview.to_email}&gt;</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(148,163,184,0.08)', flexShrink: 0 }}>
              <button style={tabBtn('html')} onClick={() => setTab('html')}>Aperçu HTML</button>
              <button style={tabBtn('text')} onClick={() => setTab('text')}>Texte brut</button>
              <button style={tabBtn('info')} onClick={() => setTab('info')}>Informations</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {tab === 'html' && (
                <div style={{ padding: '0' }}>
                  <iframe
                    srcDoc={preview.html_body}
                    style={{ width: '100%', height: 420, border: 'none', background: '#ffffff' }}
                    title="Email preview"
                  />
                </div>
              )}
              {tab === 'text' && (
                <div style={{ padding: '20px 22px', position: 'relative' }}>
                  <button
                    onClick={() => copy(preview.text_body, 'text')}
                    style={{
                      position: 'absolute', top: 14, right: 14,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#94a3b8',
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem',
                    }}
                  >
                    {copied === 'text' ? <CheckCircle2 size={12} color="#22c55e" /> : <Copy size={12} />}
                    Copier
                  </button>
                  <pre style={{
                    fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8',
                    lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 8,
                  }}>
                    {preview.text_body}
                  </pre>
                </div>
              )}
              {tab === 'info' && (
                <div style={{ padding: '20px 22px' }}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {[
                      { label: 'Pièce jointe prévue', value: preview.attachments_note },
                      { label: 'Destinataire', value: `${preview.to_name} <${preview.to_email}>` },
                      { label: 'Expéditeur', value: preview.from_name },
                      { label: 'Livrable ID', value: `#${preview.deliverable_id}` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(148,163,184,0.08)' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: '0.86rem', color: '#e2e8f0' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 8, fontSize: '0.8rem', color: '#fde68a' }}>
                    💡 Copiez le texte brut dans votre client email (Outlook, Gmail, Thunderbird) ou utilisez l'aperçu HTML pour enregistrer la pièce jointe.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(148,163,184,0.08)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={() => copy(preview.text_body, 'footer-text')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.82rem' }}
              >
                {copied === 'footer-text' ? <CheckCircle2 size={13} color="#22c55e" /> : <Copy size={13} />}
                Copier le texte
              </button>
              <button
                onClick={onClose}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'rgba(250,204,21,0.9)', color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
