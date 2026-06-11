/**
 * OnboardingWizard — Apparaît au premier démarrage si :
 * - Aucun provider LLM configuré
 * - Aucun AO importé
 * Se ferme définitivement après complétion ou skip.
 */

import { useState } from 'react';
import { CheckCircle, ChevronRight, ExternalLink, X, Zap } from 'lucide-react';
import { apiRequest } from '../api/client';

interface Step {
  key: string;
  title: string;
  desc: string;
  action?: () => void;
  actionLabel?: string;
  link?: string;
  linkLabel?: string;
  done: boolean;
}

export function SetupWizard({
  token,
  hasProviders,
  hasTenders,
  onDismiss,
}: {
  token: string | null;
  hasProviders: boolean;
  hasTenders: boolean;
  onDismiss: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const steps: Step[] = [
    {
      key: 'llm',
      title: '1 — Configurer un provider IA',
      desc: 'Ajoutez une clé API Groq (gratuit) pour activer les agents. Sans clé, le workflow tourne en simulation.',
      link: 'https://console.groq.com/keys',
      linkLabel: 'Obtenir une clé Groq gratuite ↗',
      done: hasProviders,
    },
    {
      key: 'boamp',
      title: '2 — Importer votre premier AO',
      desc: "Utilisez 'Chercher des AOs' pour trouver un appel d'offres BOAMP, ou importez un PDF.",
      done: hasTenders,
    },
    {
      key: 'workflow',
      title: '3 — Lancer le workflow automatisé',
      desc: 'Sélectionnez un AO → Workflow IA → Lancer. Les 8 étapes s\'enchaînent automatiquement, vous validez les étapes clés.',
      done: false,
    },
  ];

  const completedSteps = steps.filter(s => s.done).length;
  const allDone = completedSteps === steps.length;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(12,20,37,.98) 0%, rgba(20,30,50,.98) 100%)',
      border: '1.5px solid rgba(250,204,21,.25)',
      borderRadius: 16,
      padding: '24px 24px 20px',
      marginBottom: 20,
      position: 'relative',
    }}>
      {/* Close */}
      <button onClick={onDismiss} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
        <X size={16} />
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(250,204,21,.1)', border: '1.5px solid rgba(250,204,21,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={18} color="#facc15" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
            Bienvenue sur DataSphere IA
          </h2>
          <p style={{ margin: 0, fontSize: '.75rem', color: '#64748b' }}>
            {completedSteps}/{steps.length} étapes complétées — {allDone ? 'Vous êtes prêt ! 🎉' : 'Configurez la plateforme en 5 minutes'}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ height: 4, background: 'rgba(148,163,184,.1)', borderRadius: 99, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: '#facc15', width: `${(completedSteps / steps.length) * 100}%`, transition: 'width .5s ease' }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'grid', gap: 10 }}>
        {steps.map((step) => (
          <div key={step.key} style={{
            padding: '14px 16px',
            borderRadius: 11,
            background: step.done ? 'rgba(34,197,94,.04)' : 'rgba(0,0,0,.2)',
            border: `1px solid ${step.done ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.08)'}`,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              {step.done
                ? <CheckCircle size={16} color="#22c55e" />
                : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(148,163,184,.2)', background: 'none' }} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '.86rem', color: step.done ? '#86efac' : '#e2e8f0', marginBottom: 3 }}>
                {step.title}
              </div>
              <div style={{ fontSize: '.78rem', color: '#64748b', lineHeight: 1.5 }}>
                {step.desc}
              </div>
              {step.link && !step.done && (
                <a href={step.link} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '.76rem', color: '#facc15', textDecoration: 'none' }}>
                  <ExternalLink size={11} /> {step.linkLabel}
                </a>
              )}
              {step.key === 'llm' && !step.done && (
                <div style={{ marginTop: 8, fontSize: '.74rem', color: '#334155', padding: '6px 10px', background: 'rgba(0,0,0,.25)', borderRadius: 7, fontFamily: 'monospace' }}>
                  Render → datasphere-backend-zl3v → Environment<br />
                  GROQ_API_KEY = gsk_...
                </div>
              )}
              {step.key === 'boamp' && !step.done && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <a href="/tenders" style={{ fontSize: '.75rem', padding: '4px 10px', borderRadius: 7, border: 'none', background: 'rgba(250,204,21,.1)', color: '#facc15', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
      desc: "Utilisez 'Chercher des AOs' pour trouver un appel d'offres BOAMP, ou importez un PDF.",
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onDismiss} style={{ fontSize: '.74rem', color: '#334155', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          {allDone ? 'Fermer' : 'Masquer pour l\'instant'}
        </button>
      </div>
    </div>
  );
}
