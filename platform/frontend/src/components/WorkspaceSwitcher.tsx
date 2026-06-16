/**
 * WorkspaceSwitcher — Sélecteur de workspace dans le header
 *
 * - Liste les workspaces de l'utilisateur
 * - Stocke le workspace actif dans localStorage (ds_active_workspace)
 * - Le client API injecte automatiquement X-Workspace-ID dans chaque requête
 */
import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Layers, Plus, RefreshCw } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface Workspace {
  id: number;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  member_count?: number;
}

const PLAN_COLOR: Record<string, string> = {
  free:       '#64748b',
  pro:        '#3b82f6',
  enterprise: '#facc15',
};

interface Props {
  onSwitch?: (wsId: number | null) => void;
}

export default function WorkspaceSwitcher({ onSwitch }: Props) {
  const token = tokenStorage.get();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [active, setActive]         = useState<Workspace | null>(null);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Charger les workspaces
  useEffect(() => {
    apiRequest<Workspace[]>('/workspaces', {}, token)
      .then(data => {
        const list = Array.isArray(data) ? data.filter(w => w.is_active) : [];
        setWorkspaces(list);
        // Restaurer le workspace actif depuis localStorage
        const saved = localStorage.getItem('ds_active_workspace');
        if (saved) {
          const ws = list.find(w => w.id === parseInt(saved));
          if (ws) setActive(ws);
        }
      })
      .catch(() => {});
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function switchTo(ws: Workspace | null) {
    setActive(ws);
    if (ws) {
      localStorage.setItem('ds_active_workspace', String(ws.id));
    } else {
      localStorage.removeItem('ds_active_workspace');
    }
    setOpen(false);
    onSwitch?.(ws?.id ?? null);
    // Recharger la page pour que tous les composants reprennent avec le bon workspace
    window.location.reload();
  }

  if (workspaces.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 9,
          border: `1px solid ${active ? 'rgba(250,204,21,.25)' : 'rgba(148,163,184,.12)'}`,
          background: active ? 'rgba(250,204,21,.06)' : 'rgba(255,255,255,.03)',
          color: active ? '#facc15' : '#64748b',
          cursor: 'pointer', fontSize: '.78rem', fontWeight: 700,
          transition: 'all .15s',
          maxWidth: 180,
        }}
      >
        <Layers size={13} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {active ? active.name : 'Workspace global'}
        </span>
        <ChevronDown size={11} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          minWidth: 240, zIndex: 9999,
          background: '#0a1628', border: '1px solid rgba(148,163,184,.12)',
          borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
          overflow: 'hidden', animation: 'wsDropIn .15s ease',
        }}>
          <style>{`@keyframes wsDropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }`}</style>

          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Building2 size={12} color="#64748b" />
            <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Vos workspaces
            </span>
          </div>

          {/* Option "Global" */}
          <button onClick={() => switchTo(null)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', border: 'none', background: !active ? 'rgba(250,204,21,.06)' : 'transparent',
            cursor: 'pointer', textAlign: 'left', transition: 'background .1s',
          }}
            onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
            onMouseLeave={e => !active && (e.currentTarget.style.background = '')}
          >
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(148,163,184,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Layers size={13} color="#475569" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: !active ? '#facc15' : '#94a3b8' }}>Vue globale</div>
              <div style={{ fontSize: '.7rem', color: '#475569' }}>Tous les workspaces</div>
            </div>
            {!active && <Check size={13} color="#facc15" />}
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(148,163,184,.06)', margin: '2px 0' }} />

          {/* Liste workspaces */}
          {workspaces.map(ws => {
            const isActive = active?.id === ws.id;
            const planColor = PLAN_COLOR[ws.plan] ?? '#64748b';
            const initials = ws.name.slice(0, 2).toUpperCase();
            return (
              <button key={ws.id} onClick={() => switchTo(ws)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', border: 'none',
                background: isActive ? 'rgba(250,204,21,.06)' : 'transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'background .1s',
              }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = '')}
              >
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: `${planColor}15`, border: `1.5px solid ${planColor}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.65rem', fontWeight: 900, color: planColor,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 700, color: isActive ? '#facc15' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
                    <span style={{ fontSize: '.66rem', color: planColor, fontWeight: 700, background: `${planColor}10`, padding: '0 5px', borderRadius: 4 }}>
                      {ws.plan.toUpperCase()}
                    </span>
                    {ws.member_count !== undefined && (
                      <span style={{ fontSize: '.66rem', color: '#334155' }}>{ws.member_count} membre{ws.member_count > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                {isActive && <Check size={13} color="#facc15" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}

          {/* Créer workspace */}
          <div style={{ borderTop: '1px solid rgba(148,163,184,.06)', padding: '8px 10px' }}>
            <button
              onClick={() => { setOpen(false); /* Naviguer vers WorkspacesPage */ }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(148,163,184,.15)',
                background: 'none', color: '#475569', cursor: 'pointer', fontSize: '.76rem',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(250,204,21,.3)'; e.currentTarget.style.color = '#facc15'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,.15)'; e.currentTarget.style.color = '#475569'; }}
            >
              <Plus size={12} /> Gérer les workspaces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
