import { useI18n } from '../i18n';
import { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Plus, RefreshCw, Shield, UserCheck, UserX, Users, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { User } from '../api/domainTypes';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admin:      { label: 'Admin',       color: '#facc15', icon: Crown },
  manager:    { label: 'Manager',     color: '#3b82f6', icon: Shield },
  consultant: { label: 'Consultant',  color: '#22c55e', icon: UserCheck },
  viewer:     { label: 'Observateur', color: '#64748b', icon: Users },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function TeamPage() {
  const { t, lang } = useI18n();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'consultant' });
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<User[]>('/team', {}, token);
      setMembers(data);
    } finally { setLoading(false); }
  }

  async function invite() {
    setInviting(true); setError(null);
    try {
      const created = await apiRequest<User>('/team/invite', {
        method: 'POST', body: JSON.stringify({ ...form, is_active: true }),
      }, token);
      setMembers(m => [created, ...m]);
      setShowInvite(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', role: 'consultant' });
      setSuccess(`${created.email} invité(e) avec succès.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setInviting(false); }
  }

  async function deactivate(id: number) {
    if (!confirm('Désactiver ce membre ? Il ne pourra plus se connecter.')) return;
    await apiRequest(`/team/${id}/deactivate`, { method: 'POST' }, token);
    setMembers(m => m.map(u => u.id === id ? { ...u, is_active: false } : u));
  }

  async function changeRole(id: number, role: string) {
    await apiRequest(`/team/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }, token);
    setMembers(m => m.map(u => u.id === id ? { ...u, role: role as User['role'] } : u));
  }

  useEffect(() => { load(); }, []);

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 8, color: '#f1f5f9', fontSize: '0.84rem', outline: 'none',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ fontFamily: 'var(--font-head,Syne,sans-serif)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>
        Équipe
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-head,Syne,sans-serif)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', flex: 1 }}>
          Gestion de l'équipe
        </h1>
        <button onClick={load} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
        <button onClick={() => setShowInvite(true)} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '9px 18px', borderRadius: 10, border: 'none', background: '#facc15', cursor: 'pointer', color: '#0f172a', fontWeight: 700, fontSize: '0.84rem' }}>
          <Plus size={14} /> Inviter un membre
        </button>
      </div>

      {success && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, color: '#86efac', fontSize: '0.84rem', marginBottom: 20 }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {success}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div style={{ marginBottom: 24, padding: '20px', background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Inviter un nouveau membre</div>
            <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px,100%), 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Prénom</label>
              <input style={inp} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Mamadou" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Nom</label>
              <input style={inp} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Diallo" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="consultant@datasphere.fr" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Mot de passe provisoire</label>
              <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 caractères" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Rôle</label>
            <select style={{ ...inp, width: '50%' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="viewer">Observateur — lecture seule</option>
              <option value="consultant">Consultant — création et soumission</option>
              <option value="manager">Manager — gestion missions et livrables</option>
              <option value="admin">Admin — accès complet</option>
            </select>
          </div>
          {error && <div style={{ color: '#fca5a5', fontSize: '0.82rem', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowInvite(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.82rem' }}>
              Annuler
            </button>
            <button onClick={invite} disabled={inviting || !form.email || !form.password} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#facc15', cursor: 'pointer', color: '#0f172a', fontWeight: 700, fontSize: '0.82rem' }}>
              {inviting ? 'Invitation…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '.83rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #facc15', borderTopColor: 'transparent', animation: 'ds-spin .75s linear infinite' }} />
            Chargement de l'équipe…
            <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {!loading && members.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: 'rgba(12,20,37,.9)', border: '1px dashed rgba(148,163,184,.12)', borderRadius: 14 }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 10, opacity: .4 }}>👥</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun membre pour le moment</div>
            <p style={{ fontSize: '.78rem', opacity: .7, margin: 0 }}>Invitez votre équipe pour commencer.</p>
          </div>
        )}
        {members.map(m => {
          const rc = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.viewer;
          const RoleIcon = rc.icon;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              background: m.is_active ? 'rgba(15,30,54,0.85)' : 'rgba(100,116,139,0.08)',
              border: `1px solid ${m.is_active ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.15)'}`,
              borderRadius: 12,
              opacity: m.is_active ? 1 : 0.6,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: `${rc.color}15`, border: `1px solid ${rc.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: rc.color, fontSize: '1rem', fontFamily: 'monospace',
              }}>
                {(m.first_name?.[0] ?? m.email[0]).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 3 }}>
                  {m.first_name ? `${m.first_name} ${m.last_name ?? ''}`.trim() : m.email}
                  {!m.is_active && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#64748b' }}>• Désactivé</span>}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {m.email} · Depuis {fmtDate(m.created_at)}
                </div>
              </div>
              {/* Role badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: `${rc.color}15`, border: `1px solid ${rc.color}25`, color: rc.color, fontSize: '0.78rem', fontWeight: 700 }}>
                <RoleIcon size={12} /> {rc.label}
              </div>
              {/* Actions */}
              {m.is_active && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.id, e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '0.76rem', cursor: 'pointer' }}
                  >
                    <option value="viewer">Observateur</option>
                    <option value="consultant">Consultant</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => deactivate(m.id)} title="Désactiver" style={{ padding: '5px 9px', borderRadius: 7, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#fca5a5' }}>
                    <UserX size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
