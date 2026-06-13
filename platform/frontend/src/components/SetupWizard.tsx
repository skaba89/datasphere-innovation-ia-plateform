/**
 * SetupWizard — Onboarding complet en 5 étapes
 * Apparaît au premier démarrage si setup non terminé.
 * Chaque étape est interactive et exécute une vraie action.
 */

import { useState, useEffect } from 'react';
import { Award, CheckCircle2, ChevronRight, ExternalLink, Loader2, Users, Zap, X, Search, Play } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

const LS_KEY = 'datasphere_onboarding_done';

export function useOnboardingNeeded(): boolean {
  try { return localStorage.getItem(LS_KEY) !== 'true'; } catch { return false; }
}

export function markOnboardingDone(): void {
  try { localStorage.setItem(LS_KEY, 'true'); } catch {}
}

interface StepState { done: boolean; loading: boolean; error: string; }

export function SetupWizard({ token, onDismiss }: { token: string | null; onDismiss: () => void }) {
  const [current,   setCurrent]   = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [steps, setSteps] = useState<Record<string, StepState>>({
    provider:  { done: false, loading: false, error: '' },
    agents:    { done: false, loading: false, error: '' },
    boamp:     { done: false, loading: false, error: '' },
    workflow:  { done: false, loading: false, error: '' },
    team:      { done: false, loading: false, error: '' },
  });
  const [groqKey, setGroqKey]  = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const setStep = (key: string, patch: Partial<StepState>) =>
    setSteps(s => ({ ...s, [key]: { ...s[key], ...patch } }));

  // Pre-check: load real onboarding state from API
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const status = await apiRequest<{
          steps: Record<string, { done: boolean }>;
          onboarding_complete: boolean;
        }>('/setup/onboarding-status', {}, token);
        if (status?.steps) {
          Object.entries(status.steps).forEach(([key, s]) => {
            if (s.done) setStep(key, { done: true });
          });
          if (status.onboarding_complete) {
            markOnboardingDone();
            onDismiss();
          }
        }
      } catch {
        // Fallback: individual checks
        try {
          const provs = await apiRequest<{providers:{configured:boolean}[]}>('/providers', {}, token);
          if (provs?.providers?.some(p => p.configured)) setStep('provider', { done: true });
          const agents = await apiRequest<unknown[]>('/agents', {}, token);
          if (agents?.length >= 5) setStep('agents', { done: true });
          const tenders = await apiRequest<unknown[]>('/tenders?limit=1', {}, token);
          if (tenders?.length > 0) setStep('boamp', { done: true });
        } catch {}
      }
    })();
  }, [token]);

  const doneCount = Object.values(steps).filter(s => s.done).length;
  const allDone   = doneCount === 5;
  const progress  = Math.round((doneCount / 5) * 100);

  // ── Step actions ─────────────────────────────────────────────────────────

  async function configureProvider() {
    if (!groqKey.trim()) return;
    setStep('provider', { loading: true, error: '' });
    try {
      await apiRequest('/providers/config', {
        method: 'POST',
        body: JSON.stringify({ provider: 'groq', api_key: groqKey.trim(), model: 'llama-3.3-70b-versatile' }),
      }, token);
      setStep('provider', { done: true, loading: false });
      setCurrent(1);
    } catch (e) {
      setStep('provider', { loading: false, error: String(e).slice(0, 80) });
    }
  }

  async function installAgents() {
    setStep('agents', { loading: true, error: '' });
    try {
      await apiRequest('/agents/defaults/install', { method: 'POST' }, token);
      setStep('agents', { done: true, loading: false });
      setCurrent(2);
    } catch (e) {
      setStep('agents', { loading: false, error: String(e).slice(0, 80) });
    }
  }

  async function inviteTeamMember() {
    if (!inviteEmail.trim()) return;
    setStep('team', { loading: true, error: '' });
    try {
      await apiRequest('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'consultant', first_name: '', last_name: '', password: 'Temp1234!' }),
      }, token);
      setStep('team', { done: true, loading: false });
      if (allDone) { markOnboardingDone(); onDismiss(); }
    } catch (e) {
      setStep('team', { loading: false, error: String(e).slice(0, 80) });
    }
  }

  function skipStep(key: string) {
    setStep(key, { done: true });
    setCurrent(c => Math.min(c + 1, 4));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const STEPS = [
    {
      key: 'provider', icon: <Zap size={16} color="#facc15" />,
      title: 'Configurer un provider IA',
      subtitle: 'Groq est gratuit — 100 requêtes/jour suffisent pour démarrer',
      content: (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: '.8rem', color: '#94a3b8', margin: 0 }}>
            Entrez votre clé API Groq pour activer le workflow IA, les agents et la génération de CV.{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#facc15' }}>
              Obtenir une clé gratuite ↗
            </a>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={groqKey} onChange={e => setGroqKey(e.target.value)}
              placeholder="gsk_..." type="password"
              onKeyDown={e => e.key === 'Enter' && configureProvider()}
              style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,.06)',
                       border: '1px solid rgba(148,163,184,.2)', borderRadius: 8,
                       color: '#f1f5f9', fontSize: '.82rem' }} />
            <button onClick={configureProvider} disabled={!groqKey.trim() || steps.provider.loading}
              style={btnStyle(steps.provider.loading)}>
              {steps.provider.loading ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <ChevronRight size={13} />}
              Valider
            </button>
          </div>
          {steps.provider.error && <p style={{ color: '#fca5a5', fontSize: '.75rem', margin: 0 }}>{steps.provider.error}</p>}
          <button onClick={() => skipStep('provider')} style={skipStyle}>Passer — utiliser le mode simulation</button>
        </div>
      ),
    },
    {
      key: 'agents', icon: <Award size={16} color="#a78bfa" />,
      title: 'Installer les 5 agents IA',
      subtitle: 'Data Architect, Expert AO, Gouvernance, Business Analyst, Documentation',
      content: (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: '.8rem', color: '#94a3b8', margin: 0 }}>
            Les agents sont pré-configurés pour DataSphere. Un seul clic pour les activer.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={installAgents} disabled={steps.agents.loading} style={btnStyle(steps.agents.loading)}>
              {steps.agents.loading ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <Award size={13} />}
              Installer les agents
            </button>
            <button onClick={() => skipStep('agents')} style={skipStyle}>Passer</button>
          </div>
          {steps.agents.error && <p style={{ color: '#fca5a5', fontSize: '.75rem', margin: 0 }}>{steps.agents.error}</p>}
        </div>
      ),
    },
    {
      key: 'boamp', icon: <Search size={16} color="#38bdf8" />,
      title: 'Importer votre premier AO',
      subtitle: 'Cherchez sur BOAMP ou importez un PDF',
      content: (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: '.8rem', color: '#94a3b8', margin: 0 }}>
            Allez dans <strong style={{ color: '#e2e8f0' }}>Appels d'offres</strong> → Chercher BOAMP → importez un AO qui correspond à votre expertise.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { skipStep('boamp'); setCurrent(3); onDismiss(); }}
              style={btnStyle(false)}>
              <ExternalLink size={13} /> Aller aux AOs
            </button>
            <button onClick={() => skipStep('boamp')} style={skipStyle}>J'en ai déjà un</button>
          </div>
        </div>
      ),
    },
    {
      key: 'workflow', icon: <Play size={16} color="#86efac" />,
      title: 'Lancer le premier workflow',
      subtitle: '8 étapes automatisées : analyse → Go/No-Go → exigences → livrable',
      content: (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: '.8rem', color: '#94a3b8', margin: 0 }}>
            Sélectionnez un AO → bouton <strong style={{ color: '#facc15' }}>Workflow IA</strong> → Lancer.
            Les étapes s'enchaînent automatiquement, vous validez les points clés.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { skipStep('workflow'); setCurrent(4); }}
              style={btnStyle(false)}>
              <ChevronRight size={13} /> Compris, j'y vais
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'team', icon: <Users size={16} color="#fb923c" />,
      title: 'Inviter un collègue',
      subtitle: 'Optionnel — vous pouvez le faire plus tard dans Équipe',
      content: (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: '.8rem', color: '#94a3b8', margin: 0 }}>
            Invitez un consultant ou manager pour collaborer sur les AOs et livrables.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="collegue@email.fr" type="email"
              onKeyDown={e => e.key === 'Enter' && inviteTeamMember()}
              style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,.06)',
                       border: '1px solid rgba(148,163,184,.2)', borderRadius: 8,
                       color: '#f1f5f9', fontSize: '.82rem' }} />
            <button onClick={inviteTeamMember} disabled={!inviteEmail.trim() || steps.team.loading}
              style={btnStyle(steps.team.loading)}>
              {steps.team.loading ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <Users size={13} />}
              Inviter
            </button>
          </div>
          {steps.team.error && <p style={{ color: '#fca5a5', fontSize: '.75rem', margin: 0 }}>{steps.team.error}</p>}
          <button onClick={() => { markOnboardingDone(); onDismiss(); }} style={skipStyle}>
            Terminer sans inviter
          </button>
        </div>
      ),
    },
  ];

  if (collapsed) {
    return (
      <div style={{ background: 'rgba(12,20,37,.9)', border: '1px solid rgba(250,204,21,.2)', borderRadius: 12,
                    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    marginBottom: 16 }} onClick={() => setCollapsed(false)}>
        <Zap size={14} color="#facc15" />
        <span style={{ fontSize: '.82rem', color: '#e2e8f0', flex: 1 }}>
          Onboarding — {doneCount}/5 étapes complétées ({progress}%)
        </span>
        <div style={{ width: 80, height: 4, background: 'rgba(148,163,184,.2)', borderRadius: 99 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#facc15', borderRadius: 99, transition: 'width .4s' }} />
        </div>
        <ChevronRight size={14} color="#64748b" />
      </div>
    );
  }

  const step = STEPS[current];

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(12,20,37,.98),rgba(20,30,50,.98))',
                  border: '1.5px solid rgba(250,204,21,.25)', borderRadius: 16,
                  padding: '20px 24px', marginBottom: 20, position: 'relative' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: '.72rem', color: '#facc15', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          🚀 Démarrage rapide
        </span>
        <div style={{ flex: 1, height: 4, background: 'rgba(148,163,184,.1)', borderRadius: 99 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#facc15,#f59e0b)', borderRadius: 99, transition: 'width .5s ease' }} />
        </div>
        <span style={{ fontSize: '.72rem', color: '#64748b' }}>{doneCount}/5</span>
        <button onClick={() => setCollapsed(true)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => setCurrent(i)}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
                     padding: '4px 10px', borderRadius: 99,
                     border: `1px solid ${i === current ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.1)'}`,
                     background: i === current ? 'rgba(250,204,21,.08)' : 'none',
                     color: steps[s.key].done ? '#86efac' : i === current ? '#facc15' : '#475569',
                     cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}>
            {steps[s.key].done ? <CheckCircle2 size={11} /> : s.icon}
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current step */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {step.icon}
          <div>
            <div style={{ fontWeight: 800, fontSize: '.9rem', color: '#f1f5f9' }}>{step.title}</div>
            <div style={{ fontSize: '.74rem', color: '#64748b' }}>{step.subtitle}</div>
          </div>
          {steps[step.key].done && (
            <CheckCircle2 size={16} color="#86efac" style={{ marginLeft: 'auto' }} />
          )}
        </div>
        {!steps[step.key].done && step.content}
        {steps[step.key].done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '.8rem', color: '#86efac' }}>✓ Étape complétée</span>
            {current < 4 && (
              <button onClick={() => setCurrent(c => c + 1)} style={btnStyle(false)}>
                <ChevronRight size={13} /> Étape suivante
              </button>
            )}
            {allDone && (
              <button onClick={() => { markOnboardingDone(); onDismiss(); }}
                style={{ ...btnStyle(false), background: 'linear-gradient(135deg,#facc15,#f59e0b)' }}>
                🎉 Terminer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = (loading: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 8, border: 'none',
  background: loading ? '#334155' : '#facc15', color: loading ? '#64748b' : '#0f172a',
  cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '.78rem',
  opacity: loading ? 0.7 : 1,
});

const skipStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
  fontSize: '.72rem', padding: 0, textDecoration: 'underline', textAlign: 'left',
};
