import { useI18n } from '../i18n/index';
import React from "react";
import { useEffect, useState } from 'react';
import { Building2, Plus, Users, Crown, Shield, Eye, Trash2, RefreshCw, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';

interface Workspace { id: number; name: string; slug: string; description: string | null; plan: string; is_active: boolean; member_count: number; created_at: string; }
interface Member { id: number; user_id: number; workspace_id: number; role: string; joined_at: string; invited_by: string | null; }

const PLAN_COLORS: Record<string, string> = { free: '#64748b', starter: '#22c55e', pro: '#3b82f6', enterprise: '#8b5cf6' };
const ROLE_ICONS: Record<string, React.ReactNode> = { owner: <Crown size={11} />, admin: <Shield size={11} />, member: <Users size={11} />, viewer: <Eye size={11} /> };

export default function WorkspacesPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [planUsage, setPlanUsage] = useState<Record<string, unknown> | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ wsId: number; userId: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  // Invite form
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  async function loadWorkspaces() {
    setLoading(true);
    try { setWorkspaces(await apiRequest<Workspace[]>('/workspaces', {}, token)); }
    finally { setLoading(false); }
  }

  async function loadMembers(wsId: number) {
    try {
      const [membersData, planData] = await Promise.all([
        apiRequest<Member[]>(`/workspaces/${wsId}/members`, {}, token),
        apiRequest<Record<string, unknown>>(`/workspaces/${wsId}/plan`, {}, token).catch(() => null),
      ]);
      setMembers(membersData);
      if (planData) setPlanUsage(planData);
    }
    catch { setMembers([]); }
  }

  useEffect(() => { loadWorkspaces(); }, []);
  useEffect(() => { if (selected) loadMembers(selected.id); }, [selected]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiRequest('/workspaces', { method: 'POST', body: JSON.stringify(form) }, token);
      setMsg({ ok: true, text: `Workspace "${form.name}" créé.` });
      setShowCreate(false); setForm({ name: '', slug: '', description: '' });
      await loadWorkspaces();
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' }); }
    finally { setCreating(false); }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || (!inviteUserId && !inviteEmail)) return;
    setInviting(true);
    try {
      // Priorité: email → résolution en user_id via /team, sinon user_id direct
      let userId = inviteUserId ? parseInt(inviteUserId) : null;
      if (!userId && inviteEmail) {
        try {
          const members = await apiRequest<{id:number;email:string}[]>('/team', {}, token);
          const found = members.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase());
          if (found) userId = found.id;
          else { setMsg({ ok: false, text: `Aucun utilisateur avec l'email ${inviteEmail}. Invitez-le d'abord via l'onglet Équipe.` }); return; }
        } catch { setMsg({ ok: false, text: "Impossible de résoudre l'email." }); return; }
      }
      await apiRequest(`/workspaces/${selected.id}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId, role: inviteRole }) }, token);
      setMsg({ ok: true, text: `Membre ${inviteEmail || `#${userId}`} ajouté au workspace.` });
      setInviteUserId(''); setInviteEmail('');
      await loadMembers(selected.id);
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' }); }
    finally { setInviting(false); }
  }

  function handleRemove(wsId: number, userId: number) {
    setConfirmRemove({ wsId, userId });
  }

  async function doRemoveMember(wsId: number, userId: number) {
    try {
      await apiRequest(`/workspaces/${wsId}/members/${userId}`, { method: 'DELETE' }, token);
      await loadMembers(wsId);
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' }); }
    finally { setConfirmRemove(null); }
  }

  const s = {
    card: { background: 'rgba(12,20,37,.9)', border: '1px solid rgba(148,163,184,.12)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
    inp: { width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(148,163,184,.15)', borderRadius: 9, color: '#f1f5f9', fontSize: '.85rem', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    lbl: { display: 'block', fontSize: '.71rem', fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '.05em', textTransform: 'uppercase' as const, fontFamily: 'monospace' },
  };

  return (
    <>
      <ConfirmModal
        open={confirmRemove !== null}
        title="Retirer ce membre ?"
        description="Le membre perdra l'accès à ce workspace immédiatement."
        confirmLabel="Retirer"
        variant="warning"
        onConfirm={() => confirmRemove && doRemoveMember(confirmRemove.wsId, confirmRemove.userId)}
        onCancel={() => setConfirmRemove(null)}
      />
    <div style={{ padding: 'clamp(16px,3vw,28px) clamp(12px,3vw,32px)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Building2 size={20} color="#facc15" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.02em' }}>Workspaces</h1>
          <p style={{ fontSize: '.77rem', color: '#64748b', marginTop: 2 }}>Isolez vos données par client, projet ou équipe</p>
        </div>
        <button onClick={() => setShowCreate(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.82rem', fontFamily: 'Syne, sans-serif' }}>
          <Plus size={13} /> Nouveau workspace
        </button>
        <button onClick={loadWorkspaces} style={{ padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: 'pointer', color: '#64748b' }}>
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', borderRadius: 9, background: msg.ok ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: msg.ok ? '#86efac' : '#fca5a5', fontSize: '.82rem', marginBottom: 16 }}>
          {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {msg.text}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{ ...s.card, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 18, fontSize: '.95rem' }}>Créer un workspace</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))', gap: 14 }}>
            <div><label style={s.lbl}>Nom *</label><input style={s.inp} value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })); }} placeholder="Acme Corp" required /></div>
            <div><label style={s.lbl}>Slug * (URL-safe)</label><input style={s.inp} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="acme-corp" pattern="[a-z0-9-]+" required /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={s.lbl}>Description</label><input style={s.inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Workspace dédié au client Acme Corp" /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '.82rem' }}>Annuler</button>
              <button type="submit" disabled={creating} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '.82rem', fontFamily: 'Syne, sans-serif' }}>
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) minmax(0,1.4fr)' : '1fr', gap: 20 }}>
        {/* Workspace list */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          {workspaces.length === 0 && !loading && (
            <div style={{ ...s.card, padding: 32, textAlign: 'center', color: '#475569' }}>
              <Building2 size={32} color="#1e293b" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '.85rem' }}>Aucun workspace. Créez-en un pour commencer.</p>
            </div>
          )}
          {workspaces.map(ws => (
            <div key={ws.id} onClick={() => setSelected(ws.id === selected?.id ? null : ws)}
              style={{ ...s.card, padding: '18px 20px', cursor: 'pointer', background: ws.id === selected?.id ? 'rgba(250,204,21,.06)' : 'rgba(12,20,37,.9)', border: `1px solid ${ws.id === selected?.id ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.12)'}` }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={18} color="#facc15" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{ws.name}</span>
                    <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: '.65rem', fontFamily: 'monospace', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(148,163,184,.12)', color: PLAN_COLORS[ws.plan] || '#64748b' }}>{ws.plan}</span>
                    {!ws.is_active && <span style={{ fontSize: '.65rem', color: '#ef4444' }}>Inactif</span>}
                  </div>
                  <div style={{ fontSize: '.75rem', color: '#64748b', marginBottom: 4 }}>/{ws.slug}</div>
                  {ws.description && <div style={{ fontSize: '.77rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.description}</div>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '.72rem', color: '#475569' }}>
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Users size={10} /> {ws.member_count} membre{ws.member_count !== 1 ? 's' : ''}</span>
                    <span>Créé le {new Date(ws.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <Settings size={14} color={ws.id === selected?.id ? '#facc15' : '#475569'} />
              </div>
            </div>
          ))}
        </div>

        {/* Workspace detail */}
        {selected && (
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            {/* Plan usage */}
            {planUsage && (() => {
              const usage = (planUsage as any).usage ?? {};
              const label = (planUsage as any).plan_label ?? selected.plan;
              const upgradeUrl = (planUsage as any).upgrade_url;
              const planColor = PLAN_COLORS[selected.plan] || '#64748b';
              const bars = [
                { key: 'members',        label: t('workspace.members') },
                { key: 'tenders',        label: 'Appels d\'offres' },
                { key: 'ai_actions_30d', label: 'Actions IA / 30j' },
              ];
              return (
                <div style={s.card}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Crown size={14} color={planColor} />
                    <span style={{ fontWeight: 700, fontSize: '.84rem', flex: 1 }}>Plan {label}</span>
                    {upgradeUrl && (
                      <a href={upgradeUrl} target="_blank" rel="noreferrer" style={{ fontSize: '.7rem', padding: '2px 9px', borderRadius: 99, background: 'rgba(250,204,21,.1)', color: '#facc15', border: '1px solid rgba(250,204,21,.2)', textDecoration: 'none', fontWeight: 700 }}>
                        Upgrader →
                      </a>
                    )}
                  </div>
                  <div style={{ padding: '12px 18px', display: 'grid', gap: 10 }}>
                    {bars.map(b => {
                      const u = usage[b.key] ?? {};
                      const pct = u.pct ?? null;
                      const isUnlimited = u.limit === -1;
                      const barColor = pct == null || isUnlimited ? '#22c55e' : pct > 90 ? '#ef4444' : pct > 70 ? '#f97316' : '#22c55e';
                      return (
                        <div key={b.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', marginBottom: 4 }}>
                            <span style={{ color: '#64748b' }}>{b.label}</span>
                            <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                              {u.used ?? 0}{isUnlimited ? ' / ∞' : ` / ${u.limit ?? 0}`}
                            </span>
                          </div>
                          {!isUnlimited && pct !== null && (
                            <div style={{ height: 4, background: 'rgba(148,163,184,.1)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width .4s' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={s.card}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={15} color="#facc15" />
                <span style={{ fontWeight: 700, fontSize: '.88rem' }}>Membres — {selected.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '.74rem', color: '#64748b' }}>{members.length} membre{members.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid rgba(148,163,184,.05)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700 }}>
                      {m.user_id}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.83rem', fontWeight: 600 }}>User #{m.user_id}</div>
                      <div style={{ fontSize: '.71rem', color: '#64748b' }}>
                        Rejoint le {new Date(m.joined_at).toLocaleDateString('fr-FR')}
                        {m.invited_by ? ` · par ${m.invited_by}` : ''}
                      </div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: '.7rem', fontWeight: 600, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.12)', color: '#94a3b8' }}>
                      {ROLE_ICONS[m.role]} {m.role}
                    </span>
                    {m.role !== 'owner' && (
                      <button onClick={() => handleRemove(selected.id, m.user_id)} style={{ padding: '4px 7px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,.08)', cursor: 'pointer', color: '#fca5a5' }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Invite */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(148,163,184,.06)', background: 'rgba(255,255,255,.01)' }}>
                <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...s.inp, flex: 1 }} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email du membre (ex: jean@company.com)" type="email" />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...s.inp, width: 'auto', background: '#0c1425' }}>
                    {['admin', 'member', 'viewer'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button type="submit" disabled={inviting} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: 'rgba(250,204,21,.12)', color: '#facc15', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                    {inviting ? '…' : '+ Inviter'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
    </>
  );
}