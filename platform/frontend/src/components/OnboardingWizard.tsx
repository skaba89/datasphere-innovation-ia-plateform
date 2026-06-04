/**
 * OnboardingWizard — Première connexion
 *
 * Affiché une seule fois après le bootstrap admin.
 * Guide l'utilisateur en 4 étapes :
 *   1. Bienvenue + présentation
 *   2. Créer la première organisation
 *   3. Configurer un provider LLM (au moins 1 clé)
 *   4. Installer les profils consultants
 */

import { useState } from 'react';
import { Building2, Check, ChevronRight, Cpu, Rocket, Sparkles, Users, X } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface Props {
  onComplete: () => void;
}

const STEPS = [
  { id: 'welcome',   icon: Rocket,    label: 'Bienvenue' },
  { id: 'org',       icon: Building2, label: 'Organisation' },
  { id: 'llm',       icon: Cpu,       label: 'IA Provider' },
  { id: 'agents',    icon: Users,     label: 'Consultants' },
] as const;

type StepId = typeof STEPS[number]['id'];

const STORAGE_KEY = 'ds_onboarding_done';

export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

export function markOnboardingDone(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'rgba(255,255,255,.05)',
  border: '1.5px solid rgba(148,163,184,.15)',
  borderRadius: 10, color: '#f1f5f9',
  fontSize: '.88rem', outline: 'none', fontFamily: 'inherit',
};

const primaryBtn = (disabled = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '11px 22px', borderRadius: 10, border: 'none',
  background: disabled ? 'rgba(250,204,21,.3)' : '#facc15',
  color: '#060e18', cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: 800, fontSize: '.88rem', fontFamily: 'Syne, sans-serif',
  transition: 'opacity .15s', opacity: disabled ? .6 : 1,
});

const ghostBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#475569', fontSize: '.82rem', padding: '6px 8px',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnboardingWizard({ onComplete }: Props) {
  const token = tokenStorage.get() ?? '';
  const [step, setStep] = useState<StepId>('welcome');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Step-local state
  const [orgName, setOrgName] = useState('');
  const [orgCountry, setOrgCountry] = useState('FR');
  const [orgCreated, setOrgCreated] = useState(false);
  const [agentsInstalled, setAgentsInstalled] = useState(false);
  const [agentCount, setAgentCount] = useState(0);

  const stepIdx = STEPS.findIndex(s => s.id === step);

  function next() {
    const nextIdx = stepIdx + 1;
    if (nextIdx >= STEPS.length) {
      markOnboardingDone();
      onComplete();
    } else {
      setStep(STEPS[nextIdx].id);
      setMsg(null);
    }
  }

  function skip() {
    markOnboardingDone();
    onComplete();
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setLoading(true);
    try {
      await apiRequest('/organizations', { method: 'POST', body: JSON.stringify({ name: orgName.trim(), country: orgCountry }) }, token);
      setOrgCreated(true);
      setMsg({ ok: true, text: `Organisation "${orgName}" créée avec succès.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setLoading(false); }
  }

  async function handleInstallAgents() {
    setLoading(true);
    try {
      const agents = await apiRequest<{ id: number }[]>('/agents/defaults/install', { method: 'POST' }, token);
      setAgentsInstalled(true);
      setAgentCount(agents.length);
      setMsg({ ok: true, text: `${agents.length} profils consultants installés.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(12px,3vw,24px)',
    }}>
      <div style={{
        background: '#0a1628',
        border: '1px solid rgba(148,163,184,.12)',
        borderRadius: 20,
        maxWidth: 560, width: '100%',
        boxShadow: '0 40px 120px rgba(0,0,0,.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '.9rem', background: 'linear-gradient(135deg,#facc15,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              DataSphere
            </span>
            <span style={{ color: '#334155', fontSize: '.72rem', fontFamily: 'monospace' }}>IA Platform</span>
          </div>
          <button onClick={skip} style={ghostBtn} title="Passer la configuration"><X size={16} /></button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              const Icon = s.icon;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? '#facc15' : active ? 'rgba(250,204,21,.15)' : 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${done ? '#facc15' : active ? 'rgba(250,204,21,.5)' : 'rgba(148,163,184,.12)'}`,
                    transition: 'all .3s',
                  }}>
                    {done ? <Check size={13} color="#060e18" /> : <Icon size={12} color={active ? '#facc15' : '#475569'} />}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, borderRadius: 1, background: done ? '#facc15' : 'rgba(148,163,184,.1)', transition: 'background .3s' }} />
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '.72rem', color: '#475569', marginTop: 8, fontFamily: 'monospace' }}>
            Étape {stepIdx + 1} / {STEPS.length} — {STEPS[stepIdx].label}
          </p>
        </div>

        {/* Step content */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* Feedback */}
          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 16, fontSize: '.82rem', display: 'flex', gap: 8, alignItems: 'center', background: msg.ok ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: msg.ok ? '#86efac' : '#fca5a5' }}>
              {msg.ok ? <Check size={13} /> : <X size={13} />} {msg.text}
            </div>
          )}

          {/* ── Step: Welcome ── */}
          {step === 'welcome' && (
            <div>
              <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🚀</div>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.4rem', margin: '0 0 10px', letterSpacing: '-.03em' }}>
                  Bienvenue sur DataSphere IA Platform
                </h2>
                <p style={{ color: '#64748b', fontSize: '.88rem', lineHeight: 1.7, margin: 0, maxWidth: 380, marginInline: 'auto' }}>
                  En 3 étapes, vous serez opérationnel pour gérer vos missions, répondre aux appels d'offres et produire vos livrables avec l'aide de l'IA.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
                {[
                  { icon: '🏢', label: 'CRM clients & opportunités' },
                  { icon: '📋', label: 'Gestion des appels d\'offres' },
                  { icon: '🤖', label: 'Agents IA avec gouvernance humaine' },
                  { icon: '📄', label: 'Génération de livrables & exports' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(148,163,184,.08)', fontSize: '.84rem', color: '#cbd5e1' }}>
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span> {item.label}
                  </div>
                ))}
              </div>
              <button onClick={next} style={primaryBtn()}>
                Commencer la configuration <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── Step: Organisation ── */}
          {step === 'org' && (
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', margin: '0 0 6px' }}>
                Créer votre première organisation
              </h2>
              <p style={{ color: '#64748b', fontSize: '.83rem', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                Une organisation est un client, un partenaire ou une administration publique.
                Vous pouvez en ajouter d'autres plus tard.
              </p>
              {!orgCreated ? (
                <form onSubmit={handleCreateOrg} style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'monospace' }}>
                      Nom de l'organisation *
                    </label>
                    <input style={inp} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ministère du Numérique, Société ACME…" required autoFocus />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'monospace' }}>
                      Pays
                    </label>
                    <select style={{ ...inp }} value={orgCountry} onChange={e => setOrgCountry(e.target.value)}>
                      {[['GN','Guinée'],['SN','Sénégal'],['CI','Côte d\'Ivoire'],['ML','Mali'],['CM','Cameroun'],['BF','Burkina Faso'],['FR','France'],['BE','Belgique'],['CH','Suisse'],['MA','Maroc']].map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={loading || !orgName.trim()} style={primaryBtn(loading || !orgName.trim())}>
                    {loading ? 'Création…' : 'Créer l\'organisation'} {!loading && <ChevronRight size={15} />}
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={18} color="#86efac" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#86efac', fontSize: '.88rem' }}>{orgName}</div>
                      <div style={{ color: '#475569', fontSize: '.76rem' }}>Organisation créée</div>
                    </div>
                  </div>
                  <button onClick={next} style={primaryBtn()}>
                    Continuer <ChevronRight size={15} />
                  </button>
                </div>
              )}
              <button onClick={next} style={{ ...ghostBtn, marginTop: 12, display: 'block' }}>
                Passer cette étape →
              </button>
            </div>
          )}

          {/* ── Step: LLM Provider ── */}
          {step === 'llm' && (
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', margin: '0 0 6px' }}>
                Configurer un provider IA
              </h2>
              <p style={{ color: '#64748b', fontSize: '.83rem', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                La plateforme utilise des LLM pour analyser les appels d'offres et générer des livrables.
                Sans clé API, elle fonctionne en <strong style={{ color: '#fde68a' }}>mode simulation</strong>.
              </p>
              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                {[
                  { name: 'GLM-4-Flash (ZhipuAI)', tier: 'Gratuit', url: 'https://open.bigmodel.ai', env: 'GLM_API_KEY', color: '#22c55e' },
                  { name: 'Groq (Llama 3.3 70B)', tier: 'Quasi-gratuit', url: 'https://console.groq.com', env: 'GROQ_API_KEY', color: '#22c55e' },
                  { name: 'Gemini Flash', tier: 'Quasi-gratuit', url: 'https://aistudio.google.com', env: 'GEMINI_API_KEY', color: '#22c55e' },
                ].map(p => (
                  <div key={p.env} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(148,163,184,.08)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.84rem', fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div>
                      <div style={{ fontSize: '.72rem', color: '#475569', fontFamily: 'monospace' }}>{p.env}=…</div>
                    </div>
                    <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,.1)', color: p.color, fontWeight: 700 }}>{p.tier}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(250,204,21,.05)', border: '1px solid rgba(250,204,21,.15)', borderRadius: 10, marginBottom: 20, fontSize: '.8rem', color: '#fde68a', lineHeight: 1.6 }}>
                <strong>Comment configurer :</strong> Ajouter les clés dans le fichier <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>.env</code> à la racine du projet, puis redémarrer le backend.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={next} style={primaryBtn()}>
                  Continuer <ChevronRight size={15} />
                </button>
                <button onClick={skip} style={{ ...ghostBtn, fontSize: '.8rem' }}>Configurer plus tard</button>
              </div>
            </div>
          )}

          {/* ── Step: Agents ── */}
          {step === 'agents' && (
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.15rem', margin: '0 0 6px' }}>
                Installer les profils consultants
              </h2>
              <p style={{ color: '#64748b', fontSize: '.83rem', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                Les profils standards DataSphere permettent de démarrer immédiatement : Data Architect, Réponse AO, Gouvernance, Business Analyst…
              </p>
              {!agentsInstalled ? (
                <div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                    {['Data Architect IA','Réponse aux AO','Gouvernance de données','Business Analyst','Documentation technique'].map(a => (
                      <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(148,163,184,.08)', fontSize: '.82rem', color: '#94a3b8' }}>
                        <Sparkles size={12} color="#facc15" /> {a}
                      </div>
                    ))}
                  </div>
                  <button onClick={handleInstallAgents} disabled={loading} style={primaryBtn(loading)}>
                    {loading ? 'Installation…' : <><Sparkles size={14} /> Installer les profils standards</>}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12 }}>
                    <Check size={18} color="#86efac" />
                    <div>
                      <div style={{ fontWeight: 700, color: '#86efac', fontSize: '.88rem' }}>{agentCount} profils installés</div>
                      <div style={{ color: '#475569', fontSize: '.76rem' }}>Disponibles dans l'onglet "Profils consultants"</div>
                    </div>
                  </div>
                  <button onClick={() => { markOnboardingDone(); onComplete(); }} style={{ ...primaryBtn(), justifyContent: 'center' }}>
                    <Rocket size={15} /> Démarrer sur DataSphere
                  </button>
                </div>
              )}
              <button onClick={skip} style={{ ...ghostBtn, marginTop: 12, display: 'block' }}>
                Passer et démarrer →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
