import { useI18n } from '../i18n/index';
/**
 * UserProfilePage — Profil personnel + changement de mot de passe
 *
 * Accessible par tous les utilisateurs connectés.
 * L'utilisateur change son propre mot de passe ici (pas besoin d'admin).
 */

import { useEffect, useState } from 'react';
import {
  User, Lock, Shield, Eye, EyeOff, CheckCircle, AlertCircle,
  Save, RefreshCw, Briefcase, MapPin, Phone, Globe, Star,
  Edit3, X, Tag,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface Profile {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  bio?: string;
  phone?: string;
  linkedin_url?: string;
  avatar_url?: string;
  tjm?: number;
  skills?: string[];
  location?: string;
  availability?: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin:      { label: 'Administrateur', color: '#fca5a5' },
  manager:    { label: 'Manager',        color: '#fde68a' },
  consultant: { label: 'Consultant',     color: '#93c5fd' },
  viewer:     { label: 'Observateur',    color: '#94a3b8' },
};

const AVAILABILITY_OPTIONS = [
  { value: 'immediate',  label: 'Disponible immédiatement' },
  { value: '2weeks',     label: 'Disponible dans 2 semaines' },
  { value: '1month',     label: 'Disponible dans 1 mois' },
  { value: '3months',    label: 'Disponible dans 3 mois' },
  { value: 'unavailable',label: 'Non disponible' },
];

export default function UserProfilePage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);

  // Profile fields
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [bio, setBio]               = useState('');
  const [phone, setPhone]           = useState('');
  const [linkedin, setLinkedin]     = useState('');
  const [location, setLocation]     = useState('');
  const [tjm, setTjm]               = useState('');
  const [availability, setAvailability] = useState('');
  const [skillsRaw, setSkillsRaw]   = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  async function uploadAvatar(file: File) {
    if (!file) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const r = await fetch(`${API}/team/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (r.ok) {
        const data = await r.json();
        setAvatarUrl(data.avatar_url);
        setProfileMsg({ ok: true, text: `Avatar mis à jour (${data.size_kb}KB)` });
      } else {
        const err = await r.json();
        setProfileMsg({ ok: false, text: err.detail || 'Erreur upload avatar' });
      }
    } catch {
      setProfileMsg({ ok: false, text: t('common.error') });
    } finally { setAvatarUploading(false); }
  }
  const [profileMsg, setProfileMsg] = useState<{ok:boolean;text:string}|null>(null);

  // Password change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg]         = useState<{ok:boolean;text:string}|null>(null);

  function populateForm(p: Profile) {
    setFirstName(p.first_name ?? '');
    setLastName(p.last_name ?? '');
    setBio(p.bio ?? '');
    setPhone(p.phone ?? '');
    setLinkedin(p.linkedin_url ?? '');
    setLocation(p.location ?? '');
    setTjm(p.tjm ? String(p.tjm) : '');
    setAvailability(p.availability ?? '');
    setSkillsRaw((p.skills ?? []).join(', '));
  }

  useEffect(() => {
    apiRequest<Profile>('/team/me', {}, token)
      .then(p => { setProfile(p); populateForm(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setProfileSaving(true); setProfileMsg(null);
    try {
      await apiRequest('/team/me', {
        method: 'PATCH',
        body: JSON.stringify({
          first_name:   firstName.trim() || null,
          last_name:    lastName.trim() || null,
          bio:          bio.trim() || null,
          phone:        phone.trim() || null,
          linkedin_url: linkedin.trim() || null,
          location:     location.trim() || null,
          tjm:          tjm ? parseInt(tjm) : null,
          availability: availability || null,
          skills:       skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : null,
        }),
      }, token);
      setProfileMsg({ ok: true, text: lang === 'en' ? 'Profile updated ✓' : 'Profil mis à jour ✓' });
      setEditingProfile(false);
      // Refresh
      const updated = await apiRequest<Profile>('/team/me', {}, token);
      setProfile(updated);
    } catch (e) {
      setProfileMsg({ ok: false, text: 'Erreur lors de la sauvegarde' });
    } finally { setProfileSaving(false); }
  }

  const pwdChecks = [
    { label: '8+ caractères',   ok: newPwd.length >= 8 },
    { label: 'Majuscule',       ok: /[A-Z]/.test(newPwd) },
    { label: 'Chiffre',         ok: /\d/.test(newPwd) },
    { label: 'Caractère spécial', ok: /[^A-Za-z0-9]/.test(newPwd) },
  ];
  const pwdStrength = pwdChecks.filter(c => c.ok).length;
  const pwdStrengthColor = pwdStrength <= 1 ? '#ef4444' : pwdStrength <= 2 ? '#f59e0b' : pwdStrength <= 3 ? '#22c55e' : '#4ade80';

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' }); return; }
    if (pwdStrength < 2) { setPwdMsg({ ok: false, text: 'Mot de passe trop faible — ajoutez une majuscule et un chiffre.' }); return; }
    setPwdLoading(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      }, token);
      setPwdMsg({ ok: true, text: '✅ Mot de passe modifié avec succès.' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setPwdMsg({ ok: false, text: err instanceof Error ? err.message : 'Mot de passe actuel incorrect.' });
    } finally { setPwdLoading(false); }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(12,20,37,.9)', border: '1px solid rgba(148,163,184,.1)',
    borderRadius: 16, overflow: 'hidden',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 13px',
    background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(148,163,184,.15)',
    borderRadius: 9, color: '#f1f5f9', fontSize: '.86rem', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#64748b',
    marginBottom: 5, letterSpacing: '.05em', textTransform: 'uppercase',
  };
  const sectionHead: React.CSSProperties = {
    padding: '14px 22px', borderBottom: '1px solid rgba(148,163,184,.08)',
    display: 'flex', alignItems: 'center', gap: 10,
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Chargement…</div>;

  const role = profile ? ROLE_CONFIG[profile.role] : null;
  const initials = ((profile?.first_name?.[0] ?? '') + (profile?.last_name?.[0] ?? '')).toUpperCase() || profile?.email[0].toUpperCase() || '?';
  const skills = profile?.skills ?? [];
  const availLabel = AVAILABILITY_OPTIONS.find(a => a.value === profile?.availability)?.label;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 'clamp(12px,3vw,32px) clamp(12px,3vw,24px)', display: 'grid', gap: 16, width: '100%', boxSizing: 'border-box' as const }}>

      {/* ── Avatar + identité ───────────────────────────────────────────── */}
      <div style={{ ...card, padding: 26, display: 'flex', gap: 20, alignItems: 'center', background: 'linear-gradient(135deg,rgba(250,204,21,.04),rgba(12,20,37,.95))' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 70, height: 70, borderRadius: 18, background: 'linear-gradient(135deg,rgba(250,204,21,.25),rgba(250,204,21,.06))', border: '2px solid rgba(250,204,21,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900, color: '#facc15', overflow: 'hidden' }}>
            {avatarUrl || profile?.avatar_url
              ? <img src={avatarUrl || profile?.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <label title={lang === "en" ? "Change avatar" : "Changer l'avatar"} style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
            {avatarUploading
              ? <span style={{ fontSize: 9, animation: 'avSpin .7s linear infinite', display: 'block' }}>⟳</span>
              : <span style={{ fontSize: 11 }}>✏️</span>}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-.03em', marginBottom: 3 }}>
            {profile?.first_name || profile?.last_name
              ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
              : profile?.email}
          </div>
          <div style={{ color: '#64748b', fontSize: '.84rem', marginBottom: 10 }}>{profile?.email}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {role && (
              <span style={{ padding: '3px 11px', borderRadius: 99, fontSize: '.72rem', fontWeight: 700, fontFamily: 'monospace', background: `${role.color}12`, border: `1px solid ${role.color}25`, color: role.color }}>
                {role.label}
              </span>
            )}
            <span style={{ padding: '3px 11px', borderRadius: 99, fontSize: '.72rem', fontFamily: 'monospace', background: profile?.is_active ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${profile?.is_active ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: profile?.is_active ? '#86efac' : '#fca5a5' }}>
              {profile?.is_active ? 'Compte actif' : lang === 'en' ? 'Account deactivated' : 'Compte désactivé'}
            </span>
            {availLabel && (
              <span style={{ padding: '3px 11px', borderRadius: 99, fontSize: '.72rem', background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', color: '#93c5fd' }}>
                {availLabel}
              </span>
            )}
          </div>
          {(profile?.bio || profile?.location || profile?.tjm) && (
            <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: '.78rem', color: '#475569', flexWrap: 'wrap' }}>
              {profile.location && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{profile.location}</span>}
              {profile.tjm && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} />{profile.tjm} €/j</span>}
            </div>
          )}
          {skills.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {skills.slice(0, 8).map(s => (
                <span key={s} style={{ padding: '2px 8px', borderRadius: 5, fontSize: '.68rem', background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.12)', color: '#fde68a' }}>
                  {s}
                </span>
              ))}
              {skills.length > 8 && <span style={{ fontSize: '.68rem', color: '#475569' }}>+{skills.length - 8}</span>}
            </div>
          )}
        </div>
        <button onClick={() => setEditingProfile(v => !v)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem' }}>
          {editingProfile ? <><X size={12} /> Annuler</> : <><Edit3 size={12} /> Modifier</>}
        </button>
      </div>

      {/* ── Formulaire profil ─────────────────────────────────────────────── */}
      {editingProfile && (
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 }}>
            <User size={15} color="#facc15" />
            <span style={{ fontWeight: 800, fontSize: '.9rem' }}>Modifier le profil</span>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div>
                <label style={lbl}>Prénom</label>
                <input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Mamadou" />
              </div>
              <div>
                <label style={lbl}>Nom</label>
                <input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Diallo" />
              </div>
            </div>
            <div>
              <label style={lbl}>{lang === 'en' ? 'Biography' : 'Biographie'}</label>
              <textarea style={{ ...inp, resize: 'vertical' as const }} rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Data Engineer senior, spécialisé Snowflake & dbt…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div>
                <label style={lbl}><MapPin size={11} style={{ marginRight: 4 }} />{lang === 'en' ? 'Location' : 'Localisation'}</label>
                <input style={inp} value={location} onChange={e => setLocation(e.target.value)} placeholder="Paris, France" />
              </div>
              <div>
                <label style={lbl}><Phone size={11} style={{ marginRight: 4 }} />Téléphone</label>
                <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 00 00 00 00" />
              </div>
              <div>
                <label style={lbl}><Globe size={11} style={{ marginRight: 4 }} />LinkedIn URL</label>
                <input style={inp} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label style={lbl}><Briefcase size={11} style={{ marginRight: 4 }} />TJM (€/jour)</label>
                <input style={inp} type="number" min={0} value={tjm} onChange={e => setTjm(e.target.value)} placeholder="750" />
              </div>
            </div>
            <div>
              <label style={lbl}>{lang === 'en' ? 'Availability' : 'Disponibilité'}</label>
              <select style={{ ...inp }} value={availability} onChange={e => setAvailability(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {AVAILABILITY_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}><Tag size={11} style={{ marginRight: 4 }} />{lang === 'en' ? 'Skills (comma-separated)' : 'Compétences (séparées par des virgules)'}</label>
              <input style={inp} value={skillsRaw} onChange={e => setSkillsRaw(e.target.value)} placeholder="Snowflake, dbt Core, Apache Airflow, Python, PySpark…" />
            </div>

            {profileMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 8, background: profileMsg.ok ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)', border: `1px solid ${profileMsg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: profileMsg.ok ? '#86efac' : '#fca5a5', fontSize: '.82rem' }}>
                {profileMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {profileMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setEditingProfile(false); populateForm(profile!); }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.84rem' }}>
                Annuler
              </button>
              <button onClick={saveProfile} disabled={profileSaving}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem' }}>
                {profileSaving ? <><RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> Enregistrement…</> : <><Save size={13} /> Sauvegarder</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Changement de mot de passe ───────────────────────────────────── */}
      <div style={card}>
        <div style={sectionHead}>
          <Lock size={15} color="#facc15" />
          <span style={{ fontWeight: 800, fontSize: '.9rem' }}>{lang === 'en' ? 'Change my password' : 'Changer mon mot de passe'}</span>
        </div>
        <form onSubmit={changePwd} style={{ padding: '22px 24px', display: 'grid', gap: 16 }}>
          <div>
            <label style={lbl}>{lang === 'en' ? 'Current password' : 'Mot de passe actuel'}</label>
            <div style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} style={{ ...inp, paddingRight: 42 }}
                value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                placeholder="Votre mot de passe actuel" required autoComplete="current-password" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label style={lbl}>{lang === 'en' ? 'New password' : 'Nouveau mot de passe'}</label>
            <input type="password" style={inp} value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder={lang === "en" ? "New password" : "Nouveau mot de passe"} required autoComplete="new-password" />
            {newPwd.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {/* Barre de force */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= pwdStrength ? pwdStrengthColor : 'rgba(148,163,184,.12)', transition: 'background .2s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {pwdChecks.map(c => (
                    <span key={c.label} style={{ fontSize: '.72rem', color: c.ok ? '#86efac' : '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.ok ? <CheckCircle size={11} /> : <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid #334155', display: 'inline-block' }} />}
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>{lang === 'en' ? 'Confirm new password' : 'Confirmer le nouveau mot de passe'}</label>
            <input type="password" style={{ ...inp, borderColor: confirmPwd && confirmPwd !== newPwd ? 'rgba(239,68,68,.4)' : 'rgba(148,163,184,.15)' }}
              value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Répéter le nouveau mot de passe" required autoComplete="new-password" />
            {confirmPwd && confirmPwd !== newPwd && (
              <div style={{ fontSize: '.72rem', color: '#fca5a5', marginTop: 4 }}>Les mots de passe ne correspondent pas</div>
            )}
          </div>

          {pwdMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 9, background: pwdMsg.ok ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${pwdMsg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: pwdMsg.ok ? '#86efac' : '#fca5a5', fontSize: '.84rem' }}>
              {pwdMsg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />} {pwdMsg.text}
            </div>
          )}

          <button type="submit" disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#facc15', color: '#060e18', fontWeight: 800, fontSize: '.88rem', opacity: (!currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd) ? .5 : 1 }}>
            {pwdLoading ? <><RefreshCw size={14} style={{ animation: 'ds-spin .7s linear infinite' }} /> Enregistrement…</> : <><Lock size={14} /> Mettre à jour le mot de passe</>}
          </button>
        </form>
      </div>

      {/* ── Infos sécurité ───────────────────────────────────────────────── */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Shield size={15} color="#facc15" />
          <span style={{ fontWeight: 800, fontSize: '.9rem' }}>Informations de sécurité</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { label: 'Identifiant', val: `#${profile?.id}` },
            { label: 'Rôle', val: role?.label ?? profile?.role ?? '—' },
            { label: 'Compte créé', val: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
            { label: 'Session JWT', val: 'Expire dans 60 min (renouvelée automatiquement)' },
            { label: 'Refresh token', val: 'Valide 30 jours' },
          ].map(({ label: l, val }) => (
            <div key={l} style={{ display: 'flex', gap: 16, padding: '9px 13px', borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.06)' }}>
              <span style={{ fontSize: '.78rem', color: '#475569', minWidth: 160, fontFamily: 'monospace', flexShrink: 0 }}>{l}</span>
              <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } } @keyframes avSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
