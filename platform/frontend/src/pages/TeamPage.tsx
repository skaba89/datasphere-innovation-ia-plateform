/**
 * TeamPage — Gestion des utilisateurs (admin uniquement pour les actions critiques)
 *
 * Règles métier :
 *  - Seul l'admin peut créer un compte (invitation avec mot de passe provisoire)
 *  - Tout utilisateur peut changer son propre mot de passe (via UserProfilePage)
 *  - L'admin peut forcer le changement de mot de passe d'un membre
 *  - L'admin peut changer le rôle d'un membre (sauf dernier admin)
 *  - L'admin peut désactiver ET réactiver un membre
 *  - Un admin ne peut pas se désactiver lui-même
 */

import { useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronDown, Crown, Eye, EyeOff, Filter,
  Key, Plus, RefreshCw, Shield, UserCheck, UserMinus,
  UserPlus, UserX, Users, X, AlertTriangle, Search,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import type { CurrentUser } from '../api/authTypes';

interface Member {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLES: { key: string; label: string; desc: string; color: string; Icon: React.ComponentType<{size:number}> }[] = [
  { key: 'admin',      label: 'Administrateur', desc: 'Accès complet, gestion équipe et paramètres', color: '#fca5a5', Icon: Crown     },
  { key: 'manager',    label: 'Manager',         desc: 'Gestion missions, livrables et opportunités',  color: '#fde68a', Icon: Shield    },
  { key: 'consultant', label: 'Consultant',      desc: 'Création et soumission de livrables',          color: '#93c5fd', Icon: UserCheck },
  { key: 'viewer',     label: 'Observateur',     desc: 'Lecture seule — aucune modification',          color: '#94a3b8', Icon: Eye       },
];

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.key, r]));

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  const rc = ROLE_MAP[member.role] ?? ROLE_MAP.viewer;
  const letter = (member.first_name?.[0] ?? member.email[0]).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25, flexShrink: 0,
      background: `${rc.color}18`, border: `1.5px solid ${rc.color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, color: rc.color, fontSize: size * 0.38, fontFamily: 'monospace',
      opacity: member.is_active ? 1 : 0.5,
    }}>
      {letter}
    </div>
  );
}

export default function TeamPage() {
  const token = tokenStorage.get();
  const [me, setMe]           = useState<CurrentUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'consultant' });
  const [showFormPwd, setShowFormPwd] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Force change password
  const [pwdModal, setPwdModal] = useState<Member | null>(null);
  const [newPwd, setNewPwd]     = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving]   = useState(false);
  const [pwdMsg, setPwdMsg]         = useState<{ok:boolean;text:string} | null>(null);

  // Feedback
  const [msg, setMsg] = useState<{ok:boolean;text:string} | null>(null);
  const flash = (ok: boolean, text: string) => { setMsg({ok, text}); setTimeout(() => setMsg(null), 4000); };

  async function load() {
    setLoading(true);
    try {
      const [meData, teamData] = await Promise.all([
        apiRequest<CurrentUser>('/auth/me', {}, token),
        apiRequest<Member[]>('/team', {}, token),
      ]);
      setMe(meData);
      setMembers(teamData ?? []);
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const isAdmin = me?.role === 'admin';

  // ── Actions ────────────────────────────────────────────────────────────────

  async function invite() {
    if (!form.email || !form.password) return;
    setInviting(true); setInviteError(null);
    try {
      const created = await apiRequest<Member>('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ ...form, is_active: true, must_change_password: true }),
      }, token);
      setMembers(m => [created, ...m]);
      setShowInvite(false);
      setForm({ email: '', password: '', first_name: '', last_name: '', role: 'consultant' });
      flash(true, `✅ Compte créé pour ${created.email} avec le rôle ${created.role}.`);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally { setInviting(false); }
  }

  async function changeRole(member: Member, role: string) {
    if (!isAdmin || member.id === me?.id) return;
    try {
      await apiRequest(`/team/${member.id}`, {
        method: 'PATCH', body: JSON.stringify({ role }),
      }, token);
      setMembers(m => m.map(u => u.id === member.id ? { ...u, role } : u));
      flash(true, `Rôle de ${member.email} → ${ROLE_MAP[role]?.label ?? role}`);
    } catch (e) { flash(false, e instanceof Error ? e.message : 'Erreur'); }
  }

  async function toggleActive(member: Member) {
    if (!isAdmin || member.id === me?.id) return;
    const endpoint = member.is_active
      ? `/team/${member.id}/deactivate`
      : `/team/${member.id}`;
    try {
      if (member.is_active) {
        await apiRequest(endpoint, { method: 'POST' }, token);
        setMembers(m => m.map(u => u.id === member.id ? { ...u, is_active: false } : u));
        flash(true, `${member.email} désactivé — ne peut plus se connecter.`);
      } else {
        await apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify({ is_active: true }) }, token);
        setMembers(m => m.map(u => u.id === member.id ? { ...u, is_active: true } : u));
        flash(true, `${member.email} réactivé.`);
      }
    } catch (e) { flash(false, e instanceof Error ? e.message : 'Erreur'); }
  }

  async function forceChangePwd() {
    if (!pwdModal || !newPwd || newPwd.length < 8) return;
    setPwdSaving(true); setPwdMsg(null);
    try {
      await apiRequest(`/team/${pwdModal.id}/change-password`, {
        method: 'POST', body: JSON.stringify({ new_password: newPwd }),
      }, token);
      setPwdMsg({ ok: true, text: 'Mot de passe mis à jour.' });
      setTimeout(() => { setPwdModal(null); setNewPwd(''); setPwdMsg(null); }, 1500);
    } catch (e) {
      setPwdMsg({ ok: false, text: e instanceof Error ? e.message : 'Erreur' });
    } finally { setPwdSaving(false); }
  }

  // ── Filtres ────────────────────────────────────────────────────────────────

  const filtered = members.filter(m => {
    if (filterRole !== 'all' && m.role !== filterRole) return false;
    if (filterActive === 'active' && !m.is_active) return false;
    if (filterActive === 'inactive' && m.is_active) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!m.email.toLowerCase().includes(s) &&
          !(m.first_name ?? '').toLowerCase().includes(s) &&
          !(m.last_name ?? '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const counts = {
    total:  members.length,
    active: members.filter(m => m.is_active).length,
    admin:  members.filter(m => m.role === 'admin').length,
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(148,163,184,.15)',
    borderRadius: 9, color: '#f1f5f9', fontSize: '.85rem', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: 'clamp(16px,3vw,32px) clamp(16px,4vw,40px)', maxWidth: 1000, display: 'grid', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#facc15', marginBottom: 6 }}>
            Équipe
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Gestion des utilisateurs
          </h1>
          <p style={{ color: '#64748b', fontSize: '.86rem', lineHeight: 1.5, maxWidth: 500 }}>
            Seul l'admin peut créer des comptes. Les utilisateurs gèrent leur mot de passe depuis leur profil.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'ds-spin .7s linear infinite' : 'none' }} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowInvite(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem' }}>
              <UserPlus size={14} /> Créer un compte
            </button>
          )}
        </div>
      </div>

      {/* KPI stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Membres total', value: counts.total, color: '#64748b' },
          { label: 'Actifs', value: counts.active, color: '#22c55e' },
          { label: 'Désactivés', value: counts.total - counts.active, color: '#ef4444' },
          { label: 'Admins', value: counts.admin, color: '#fca5a5' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 12, padding: '12px 18px', minWidth: 100 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 16px', borderRadius: 10, background: msg.ok ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`, color: msg.ok ? '#86efac' : '#fca5a5', fontSize: '.84rem' }}>
          {msg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {msg.text}
        </div>
      )}

      {/* Invite form — admin only */}
      {showInvite && isAdmin && (
        <div style={{ background: 'rgba(250,204,21,.04)', border: '1px solid rgba(250,204,21,.2)', borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <UserPlus size={16} color="#facc15" />
              <span style={{ fontWeight: 800, fontSize: '.95rem' }}>Créer un nouveau compte</span>
            </div>
            <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Prénom</label>
              <input style={inp} value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} placeholder="Mamadou" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Nom</label>
              <input style={inp} value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} placeholder="Diallo" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Email *</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="consultant@datasphere.fr" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Mot de passe provisoire *</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingRight: 38 }} type={showFormPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Min. 8 caractères" required />
                <button type="button" onClick={() => setShowFormPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                  {showFormPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(250,204,21,.04)', border: '1px solid rgba(250,204,21,.1)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                </svg>
                <span style={{ fontSize: '.72rem', color: '#64748b', lineHeight: 1.5 }}>
                  L&apos;utilisateur sera <strong style={{ color: '#fde68a' }}>forcé de changer ce mot de passe</strong> dès sa première connexion avant d&apos;accéder à la plateforme.
                </span>
              </div>
            </div>
          </div>

          {/* Rôle */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Rôle *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
              {ROLES.map(r => (
                <button key={r.key} type="button" onClick={() => setForm(f => ({...f, role: r.key}))} style={{
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${form.role === r.key ? `${r.color}50` : 'rgba(148,163,184,.12)'}`,
                  background: form.role === r.key ? `${r.color}08` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <r.Icon size={13} />
                    <span style={{ fontWeight: 700, fontSize: '.82rem', color: form.role === r.key ? r.color : '#94a3b8' }}>{r.label}</span>
                  </div>
                  <div style={{ fontSize: '.7rem', color: '#475569', lineHeight: 1.4 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {inviteError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 8, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.82rem', marginBottom: 12 }}>
              <AlertTriangle size={13} /> {inviteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowInvite(false); setInviteError(null); }} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.84rem' }}>
              Annuler
            </button>
            <button onClick={invite} disabled={inviting || !form.email || !form.password || form.password.length < 8}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem', opacity: (!form.email || !form.password || form.password.length < 8) ? .5 : 1 }}>
              {inviting ? <><RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> Création…</> : <><UserPlus size={13} /> Créer le compte</>}
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            style={{ ...inp, paddingLeft: 32, width: '100%' }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: '#0c1425', color: '#94a3b8', fontSize: '.84rem', cursor: 'pointer' }}>
          <option value="all">Tous les rôles</option>
          {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'active', 'inactive'] as const).map(v => (
            <button key={v} onClick={() => setFilterActive(v)} style={{
              padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${filterActive === v ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.12)'}`,
              background: filterActive === v ? 'rgba(250,204,21,.08)' : 'none',
              color: filterActive === v ? '#facc15' : '#64748b', fontSize: '.78rem', fontWeight: 600,
            }}>
              {v === 'all' ? 'Tous' : v === 'active' ? '✓ Actifs' : '✗ Désactivés'}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des membres */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: '.84rem' }}>
          <RefreshCw size={20} style={{ animation: 'ds-spin .7s linear infinite', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
          Chargement de l'équipe…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', color: '#475569', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(148,163,184,.12)', borderRadius: 14 }}>
          <Users size={32} style={{ opacity: .2, marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: '.86rem' }}>Aucun membre ne correspond aux filtres.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(m => {
            const rc = ROLE_MAP[m.role] ?? ROLE_MAP.viewer;
            const isSelf = m.id === me?.id;
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                flexWrap: 'wrap',
                background: m.is_active ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.01)',
                border: `1px solid ${isSelf ? 'rgba(250,204,21,.15)' : 'rgba(148,163,184,.08)'}`,
                borderRadius: 12, opacity: m.is_active ? 1 : 0.65,
                transition: 'border-color .15s',
              }}>
                <Avatar member={m} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#e2e8f0' }}>
                      {m.first_name ? `${m.first_name} ${m.last_name ?? ''}`.trim() : m.email}
                    </span>
                    {isSelf && (
                      <span style={{ fontSize: '.68rem', padding: '1px 7px', borderRadius: 99, background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.2)', color: '#facc15', fontWeight: 700 }}>
                        Vous
                      </span>
                    )}
                    {!m.is_active && (
                      <span style={{ fontSize: '.68rem', padding: '1px 7px', borderRadius: 99, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontWeight: 700 }}>
                        Désactivé
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '.76rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all' }}>
                    {m.email}
                    {m.first_name && <span style={{ color: '#334155' }}> · {m.email}</span>}
                    <span style={{ color: '#334155', marginLeft: 8 }}>Depuis {fmtDate(m.created_at)}</span>
                  </div>
                </div>

                {/* Role badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, background: `${rc.color}10`, border: `1px solid ${rc.color}25`, color: rc.color, fontSize: '.74rem', fontWeight: 700, flexShrink: 0 }}>
                  <rc.Icon size={11} /> {rc.label}
                </div>

                {/* Admin actions */}
                {isAdmin && !isSelf && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Changer le rôle */}
                    {m.is_active && (
                      <select value={m.role} onChange={e => changeRole(m, e.target.value)}
                        style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'rgba(255,255,255,.04)', color: '#94a3b8', fontSize: '.75rem', cursor: 'pointer' }}>
                        {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    )}

                    {/* Forcer changement MDP */}
                    {m.is_active && (
                      <button onClick={() => { setPwdModal(m); setNewPwd(''); setPwdMsg(null); }}
                        title="Forcer le changement de mot de passe"
                        style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(250,204,21,.2)', background: 'rgba(250,204,21,.06)', color: '#fde68a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                        <Key size={11} /> MDP
                      </button>
                    )}

                    {/* Activer / Désactiver */}
                    <button onClick={() => toggleActive(m)}
                      title={m.is_active ? 'Désactiver ce compte' : 'Réactiver ce compte'}
                      style={{ padding: '5px 9px', borderRadius: 7, border: `1px solid ${m.is_active ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.25)'}`, background: m.is_active ? 'rgba(239,68,68,.06)' : 'rgba(34,197,94,.06)', color: m.is_active ? '#fca5a5' : '#86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                      {m.is_active ? <><UserMinus size={11} /> Désactiver</> : <><UserPlus size={11} /> Réactiver</>}
                    </button>
                  </div>
                )}

                {/* Si non-admin ou soi-même */}
                {(!isAdmin || isSelf) && isSelf && (
                  <div style={{ fontSize: '.72rem', color: '#334155', padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.08)', background: 'rgba(255,255,255,.02)' }}>
                    Votre compte · Changez votre MDP dans <strong style={{ color: '#64748b' }}>Mon profil</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Note non-admin */}
      {!isAdmin && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', fontSize: '.8rem', color: '#64748b', lineHeight: 1.5 }}>
          <strong style={{ color: '#93c5fd' }}>Droits limités :</strong> seul un administrateur peut créer des comptes, changer les rôles ou désactiver des membres.
          Vous pouvez modifier votre propre mot de passe depuis <strong style={{ color: '#94a3b8' }}>Mon profil</strong>.
        </div>
      )}

      {/* Modal force change password */}
      {pwdModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <div style={{ background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Key size={16} color="#facc15" />
                <span style={{ fontWeight: 800, fontSize: '.95rem' }}>Forcer le mot de passe</span>
              </div>
              <button onClick={() => setPwdModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
            </div>
            <p style={{ fontSize: '.82rem', color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
              Définir un nouveau mot de passe pour <strong style={{ color: '#94a3b8' }}>{pwdModal.email}</strong>.
              L'utilisateur devra le changer à sa prochaine connexion.
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Nouveau mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input type={showNewPwd ? 'text' : 'password'} style={{ ...inp, paddingRight: 38 }}
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min. 8 caractères" />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                  {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {newPwd.length > 0 && newPwd.length < 8 && (
                <div style={{ fontSize: '.72rem', color: '#fca5a5', marginTop: 4 }}>⚠ Minimum 8 caractères requis</div>
              )}
            </div>
            {pwdMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, marginBottom: 12, background: pwdMsg.ok ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)', border: `1px solid ${pwdMsg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: pwdMsg.ok ? '#86efac' : '#fca5a5', fontSize: '.82rem' }}>
                {pwdMsg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {pwdMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPwdModal(null)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.84rem' }}>
                Annuler
              </button>
              <button onClick={forceChangePwd} disabled={pwdSaving || newPwd.length < 8}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem', opacity: newPwd.length < 8 ? .5 : 1 }}>
                {pwdSaving ? <><RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> Enregistrement…</> : <><Key size={13} /> Définir le mot de passe</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
