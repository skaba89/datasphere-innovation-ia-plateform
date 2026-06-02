/**
 * FileAttachments — inline file upload + list for any resource
 * Used in TenderWorkspace and DeliverablePanel.
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, Download, Trash2, FileText, Image, Archive } from 'lucide-react';
import { uploadFile, apiRequest, tokenStorage } from '../api/client';

interface FileRecord {
  id: number;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Props {
  resourceType: 'tender' | 'deliverable';
  resourceId: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

function formatSize(bytes: number | null) {
  if (!bytes) return '?';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fileIcon(mime: string | null) {
  if (!mime) return <FileText size={14} color="#94a3b8" />;
  if (mime.startsWith('image/')) return <Image size={14} color="#a78bfa" />;
  if (mime.includes('zip') || mime.includes('archive')) return <Archive size={14} color="#fde68a" />;
  if (mime.includes('pdf')) return <FileText size={14} color="#fca5a5" />;
  if (mime.includes('word') || mime.includes('doc')) return <FileText size={14} color="#93c5fd" />;
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText size={14} color="#86efac" />;
  return <FileText size={14} color="#94a3b8" />;
}

export default function FileAttachments({ resourceType, resourceId }: Props) {
  const token = tokenStorage.get();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await apiRequest<FileRecord[]>(
        `/uploads/${resourceType}s/${resourceId}`, {}, token
      );
      setFiles(data);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (open && files.length === 0) load();
  }, [open]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFile(`/uploads/${resourceType}s/${resourceId}`, file, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(fileId: number, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      await apiRequest(`/uploads/${fileId}`, { method: 'DELETE' }, token);
      setFiles(f => f.filter(x => x.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  function downloadUrl(fileId: number) {
    return `${API_BASE}/uploads/download/${fileId}`;
  }

  const s = {
    wrap: { background: 'rgba(15,30,54,.85)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  };

  return (
    <div style={s.wrap}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left' }}
      >
        <Paperclip size={14} color="#94a3b8" />
        <span style={{ fontWeight: 700, fontSize: '.84rem', flex: 1 }}>
          Pièces jointes
        </span>
        <span style={{ fontSize: '.72rem', color: '#64748b', fontFamily: 'monospace' }}>
          {files.length} fichier{files.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '.7rem', color: '#475569' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(148,163,184,.07)' }}>
          {/* Upload zone */}
          <div
            style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <input
              ref={inputRef}
              type="file"
              id={`file-upload-${resourceType}-${resourceId}`}
              onChange={handleUpload}
              style={{ display: 'none' }}
              accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.png,.jpg,.jpeg,.zip,.csv"
            />
            <label
              htmlFor={`file-upload-${resourceType}-${resourceId}`}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: '1px dashed rgba(148,163,184,.25)', cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,.03)', color: '#94a3b8', fontSize: '.78rem', transition: 'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(250,204,21,.3)'; (e.currentTarget as HTMLElement).style.color = '#facc15'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,.25)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
            >
              <Upload size={12} />
              {uploading ? 'Upload en cours…' : 'Joindre un fichier'}
            </label>
            <span style={{ fontSize: '.7rem', color: '#475569', fontFamily: 'monospace' }}>
              PDF · DOCX · XLSX · PNG · ZIP — max 20 Mo
            </span>
          </div>

          {error && (
            <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,.06)', borderBottom: '1px solid rgba(239,68,68,.15)', color: '#fca5a5', fontSize: '.77rem' }}>
              {error}
            </div>
          )}

          {/* File list */}
          {files.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '.8rem' }}>
              Aucun fichier joint.
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {files.map(f => (
                <div
                  key={f.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(148,163,184,.05)', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ flexShrink: 0 }}>{fileIcon(f.mime_type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.original_name}
                    </div>
                    <div style={{ fontSize: '.7rem', color: '#64748b', marginTop: 1, display: 'flex', gap: 8 }}>
                      <span>{formatSize(f.size_bytes)}</span>
                      {f.uploaded_by && <span>· {f.uploaded_by}</span>}
                    </div>
                  </div>
                  <a
                    href={downloadUrl(f.id)}
                    download={f.original_name}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                    title="Télécharger"
                  >
                    <Download size={11} />
                  </a>
                  <button
                    onClick={() => handleDelete(f.id, f.original_name)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,.08)', cursor: 'pointer', color: '#fca5a5', display: 'flex', alignItems: 'center' }}
                    title="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
