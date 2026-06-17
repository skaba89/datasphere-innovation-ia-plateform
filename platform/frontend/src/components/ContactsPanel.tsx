import { useEffect, useState } from 'react';
import { ExternalLink, Mail, Plus, RefreshCw, Search, Trash2, UserCheck, Users, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { apiRequest, tokenStorage } from '../api/client';
import type { Contact, Organization } from '../api/domainTypes';
import ConfirmModal from './ConfirmModal';
// ── Form component ────────────────────────────────────────────────────────────

function ContactForm({
  const { lang } = useI18n();
  orgId,
  orgName,
  initial,
  onSave,
  onCancel,
}: {
  orgId: number;
  orgName: string;
  initial?: Partial<Contact>;
  onSave: (c: Contact) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    job_title: initial?.job_title ?? '',
    professional_email: initial?.professional_email ?? '',
    linkedin_url: initial?.linkedin_url ?? '',
    source: initial?.source ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function submit() {
    setSaving(true); setError(null);
    try {
      const path = initial?.id ? `/contacts/${initial.id}` : '/contacts';
      const method = initial?.id ? 'PATCH' : 'POST';
      const body = initial?.id ? form : { ...form, organization_id: orgId };
      const saved = await apiRequest<Contact>(path, {
        method,
        body: JSON.stringify(body),
      }, token);
      onSave(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setSaving(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 8, color: '#f1f5f9', fontSize: '0.84rem', outline: 'none',
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 4 }}>
        Organisation : <strong style={{ color: '#94a3b8' }}>{orgName}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Prénom</label>
          <input style={inp} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Mamadou" />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Nom</label>
          <input style={inp} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Diallo" />
        </div>
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>{lang === 'en' ? 'Job title' : 'Fonction'}</label>
        <input style={inp} value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Directeur IT" />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>{lang === 'en' ? 'Professional email' : 'Email professionnel'}</label>
        <input style={inp} type="email" value={form.professional_email} onChange={e => setForm(f => ({ ...f, professional_email: e.target.value }))} placeholder="contact@client.com" />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>LinkedIn</label>
        <input style={inp} value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Source</label>
          <input style={inp} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="LinkedIn, Réseau, Événement…" />
        </div>
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes sur ce contact…" />
      </div>
      {error && <div style={{ color: '#fca5a5', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.82rem' }}>
          Annuler
        </button>
        <button onClick={submit} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#3b82f6', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
          {saving ? 'Enregistrement…' : initial?.id ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ContactsPanel() {
  const { lang } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const token = tokenStorage.get();

  async function loadAll() {
    setLoading(true);
    try {
      const [cs, os] = await Promise.all([
        apiRequest<Contact[]>(`/contacts${filterOrgId ? `?organization_id=${filterOrgId}` : ''}${search ? `${filterOrgId ? '&' : '?'}search=${encodeURIComponent(search)}` : ''}`, {}, token),
        apiRequest<Organization[]>('/organizations', {}, token),
      ]);
      setContacts(cs);
      setOrgs(os);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [filterOrgId, search]);

  async function deleteContact(id: number) {
    setConfirmDeleteId(id);
  }

  async function doDeleteContact(id: number) {
    await apiRequest(`/contacts/${id}`, { method: 'DELETE' }, token);
    setContacts(cs => cs.filter(c => c.id !== id));
    setConfirmDeleteId(null);
  }

  function getOrgName(id: number): string {
    return orgs.find(o => o.id === id)?.name ?? `Org #${id}`;
  }

  const formOrgId = editContact?.organization_id ?? selectedOrgId ?? (orgs[0]?.id ?? 0);
  const formOrgName = getOrgName(formOrgId);

  return (
    <div>
      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Supprimer ce contact ?"
        description="Cette action est irréversible. Le contact sera définitivement supprimé."
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={() => confirmDeleteId !== null && doDeleteContact(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color="#3b82f6" />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{lang === 'en' ? 'Contacts' : 'Contacts'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>
            {contacts.length}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={13} color="#64748b" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher nom, email…"
              style={{ width: '100%', paddingLeft: 30, padding: '8px 12px 8px 30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: '0.82rem', outline: 'none' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={12} /></button>}
          </div>
          {/* Org filter */}
          <select
            value={filterOrgId}
            onChange={e => setFilterOrgId(e.target.value ? parseInt(e.target.value) : '')}
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: '0.82rem', outline: 'none' }}
          >
            <option value="">Toutes les organisations</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <button onClick={loadAll} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
        <button onClick={() => { setEditContact(null); setSelectedOrgId(orgs[0]?.id ?? null); setShowForm(true); }} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
          <Plus size={14} /> Ajouter un contact
        </button>
      </div>

      {/* Form panel */}
      {showForm && (
        <div style={{ marginBottom: 20, padding: '20px', background: 'rgba(15,30,54,0.9)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={15} color="#3b82f6" />
            {editContact ? 'Modifier le contact' : 'Nouveau contact'}
          </div>
          {!editContact && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Organisation</label>
              <select
                value={selectedOrgId ?? ''}
                onChange={e => setSelectedOrgId(parseInt(e.target.value))}
                style={{ padding: '8px 12px', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#f1f5f9', fontSize: '0.84rem', outline: 'none' }}
              >
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <ContactForm
            orgId={formOrgId}
            orgName={formOrgName}
            initial={editContact ?? undefined}
            onSave={(c) => { loadAll(); setShowForm(false); setEditContact(null); }}
            onCancel={() => { setShowForm(false); setEditContact(null); }}
          />
        </div>
      )}

      {/* Contacts list */}
      {contacts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
          <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{lang === 'en' ? 'No contacts found' : 'Aucun contact trouvé'}</div>
          <div style={{ fontSize: '0.84rem' }}>{lang === 'en' ? 'Add your first CRM contacts.' : 'Ajoutez vos premiers contacts CRM.'}</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {contacts.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '14px 16px',
            background: 'rgba(15,30,54,0.85)',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: 12,
          }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, color: '#93c5fd', fontSize: '0.9rem',
              fontFamily: 'monospace',
            }}>
              {(c.first_name?.[0] ?? '?').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 3 }}>
                {c.first_name} {c.last_name}
                {c.job_title && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>{c.job_title}</span>}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                <span style={{ fontWeight: 600, color: '#94a3b8' }}>
                  🏢 {getOrgName(c.organization_id)}
                </span>
                {c.professional_email && (
                  <a href={`mailto:${c.professional_email}`} style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#93c5fd', textDecoration: 'none' }}>
                    <Mail size={11} />{c.professional_email}
                  </a>
                )}
                {c.linkedin_url && (
                  <a href={c.linkedin_url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#64748b', textDecoration: 'none' }}>
                    <ExternalLink size={11} />LinkedIn
                  </a>
                )}
                {c.source && <span>via {c.source}</span>}
              </div>
              {c.notes && <div style={{ marginTop: 5, fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>{c.notes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setEditContact(c); setShowForm(true); }} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem' }}>
                ✏️
              </button>
              <button onClick={() => deleteContact(c.id)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#fca5a5', fontSize: '0.75rem' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
