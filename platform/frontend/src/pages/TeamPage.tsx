import { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Plus, RefreshCw, Shield, UserCheck, UserX, Users, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { User } from '../api/domainTypes';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: 'Admin', color: '#facc15', icon: Crown },
  manager: { label: 'Manager', color: '#3b82f6', icon: Shield },
  consultant: { label: 'Consultant', color: '#22c55e', icon: UserCheck },
  auditor: { label: 'Auditeur', color: '#a78bfa', icon: Shield },
  client: { label: 'Client', color: '#38bdf8', icon: Users },
  viewer: { label: 'Observateur', color: '#64748b', icon: Users },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function TeamPage() {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'consultant' });
  const [inviting, setInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const token = tokenStorage.get();

  async function load() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<User[]>('/team', {}, token);
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement équipe');
    } finally {
      setLoading(false);
    }
  }

  async function invite() {
    if (inviting) return;
    setInviting(true);
    setError(null);
    try {
      const created = await apiRequest<User>('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ ...form, email: form.email.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(), is_active: true }),
      }, token);
      setMembers((m) => [created, ...m]);
      setShowInvite(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', role: 'consultant' });
      setSuccess(`${created.email} invité(e) avec succès.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setInviting(false);
    }
  }

  async function deactivate(id: number) {
    if (updatingId) return;
    if (!confirm('Désactiver ce membre ? Il ne pourra plus se connecter.')) return;
    setUpdatingId(id);
    setError(null);
    try {
      await apiRequest(`/team/${id}/deactivate`, { method: 'POST' }, token);
      setMembers((m) => m.map((u) => u.id === id ? { ...u, is_active: false } : u));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur désactivation membre');
    } finally {
      setUpdatingId(null);
    }
  }

  async function changeRole(id: number, role: string) {
    if (updatingId) return;
    setUpdatingId(id);
    setError(null);
    try {
      await apiRequest(`/team/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }, token);
      setMembers((m) => m.map((u) => u.id === id ? { ...u, role: role as User['role'] } : u));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur modification rôle');
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="app-shell team-page">
      <section className="panel team-header">
        <div>
          <p className="eyebrow">Équipe</p>
          <h1>Gestion de l'équipe</h1>
          <p className="subtitle">Invitez les utilisateurs, ajustez les rôles et désactivez les accès si nécessaire.</p>
        </div>
        <div className="team-header-actions">
          <button onClick={load} disabled={loading} className="team-secondary-button" type="button" title="Actualiser">
            <RefreshCw size={12} className={loading ? 'is-spinning' : ''} />
            Actualiser
          </button>
          <button onClick={() => setShowInvite(true)} className="team-primary-button" type="button">
            <Plus size={14} /> Inviter un membre
          </button>
        </div>
      </section>

      {success && <div className="team-alert success"><CheckCircle2 size={16} /> {success}</div>}
      {error && <div className="team-alert error">{error}</div>}

      {showInvite && (
        <section className="panel team-invite-panel" aria-busy={inviting}>
          <div className="team-invite-header">
            <strong>Inviter un nouveau membre</strong>
            <button onClick={() => setShowInvite(false)} disabled={inviting} type="button" aria-label="Fermer"><X size={15} /></button>
          </div>
          <div className="team-form-grid">
            <label>Prénom<input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Mamadou" disabled={inviting} /></label>
            <label>Nom<input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Diallo" disabled={inviting} /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="consultant@datasphere.fr" disabled={inviting} /></label>
            <label>Mot de passe provisoire<input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 8 caractères" disabled={inviting} /></label>
            <label className="team-role-field">Rôle<select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} disabled={inviting}>
              <option value="client">Client — lecture livrables</option>
              <option value="auditor">Auditeur — audit et lecture</option>
              <option value="consultant">Consultant — création et soumission</option>
              <option value="manager">Manager — gestion missions et livrables</option>
              <option value="admin">Admin — accès complet</option>
            </select></label>
          </div>
          <div className="team-form-actions">
            <button onClick={() => setShowInvite(false)} disabled={inviting} className="team-secondary-button" type="button">Annuler</button>
            <button onClick={invite} disabled={inviting || !form.email.trim() || !form.password} className="team-primary-button" type="button">
              {inviting ? 'Invitation…' : "Envoyer l'invitation"}
            </button>
          </div>
        </section>
      )}

      <section className="team-member-list" aria-busy={loading}>
        {members.map((m) => {
          const rc = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.viewer;
          const RoleIcon = rc.icon;
          const isUpdating = updatingId === m.id;
          return (
            <article key={m.id} className={`team-member-card ${m.is_active ? '' : 'is-disabled'}`}>
              <div className="team-avatar" style={{ background: `${rc.color}15`, borderColor: `${rc.color}25`, color: rc.color }}>
                {(m.first_name?.[0] ?? m.email[0]).toUpperCase()}
              </div>
              <div className="team-member-main">
                <strong>{m.first_name ? `${m.first_name} ${m.last_name ?? ''}`.trim() : m.email}{!m.is_active && <span> • Désactivé</span>}</strong>
                <p>{m.email} · Depuis {fmtDate(m.created_at)}</p>
              </div>
              <div className="team-role-badge" style={{ background: `${rc.color}15`, borderColor: `${rc.color}25`, color: rc.color }}>
                <RoleIcon size={12} /> {rc.label}
              </div>
              {m.is_active && (
                <div className="team-member-actions">
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} disabled={Boolean(updatingId)}>
                    <option value="client">Client</option>
                    <option value="auditor">Auditeur</option>
                    <option value="consultant">Consultant</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => deactivate(m.id)} disabled={Boolean(updatingId)} title="Désactiver" type="button">
                    {isUpdating ? <RefreshCw size={13} className="is-spinning" /> : <UserX size={13} />}
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {members.length === 0 && !loading && <p className="team-empty-state">Aucun membre pour le moment.</p>}
      </section>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .is-spinning { animation: spin 1s linear infinite; }`}</style>
    </main>
  );
}
