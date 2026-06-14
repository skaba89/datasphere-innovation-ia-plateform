/**
 * Système i18n FR / EN — DataSphere Innovation
 * Usage : const { t, lang, setLang } = useI18n();
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'fr' | 'en';

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.dashboard':      'Tableau de bord',
    'nav.organizations':  'Organisations',
    'nav.opportunities':  'Opportunités',
    'nav.tenders':        "Appels d'offres",
    'nav.profiles':       'Profils consultants',
    'nav.deliverables':   'Livrables',
    'nav.commercial':     'CRM Commercial',
    'nav.operations':     'Opérations',
    'nav.team':           'Équipe',
    'nav.audit':          'Audit',
    'nav.workspaces':     'Workspaces',
    'nav.data_export':    'Export données',
    'nav.calculator':     'Calculateur',
    'nav.pricing':        'Plans & Tarifs',
    'nav.settings':       'Configuration',
    'nav.profile':        'Mon profil',
    'nav.linkedin':       'Agent LinkedIn',
    'nav.cv_consultant':  'Agent CV Consultant',
    'nav.notifications':  'Notifications',
    'nav.search':         'Recherche',
    'nav.webhooks':       'Webhooks',
    'nav.ai_providers':   'AI Providers',

    // Dashboard
    'dashboard.title':      'Tableau de bord',
    'dashboard.subtitle':   "Vue d'ensemble de votre activité",
    'dashboard.pipeline':   'Pipeline commercial',
    'dashboard.tenders':    "Appels d'offres",
    'dashboard.agents':     'Agents IA',
    'dashboard.deliverables': 'Livrables',
    'dashboard.kpi_tenders':  'AOs en cours',
    'dashboard.kpi_go':       'Décisions GO',
    'dashboard.kpi_delivered':'Livrables générés',
    'dashboard.kpi_providers':'Providers actifs',

    // CRM
    'crm.organizations':  'Organisations',
    'crm.contacts':       'Contacts',
    'crm.opportunities':  'Opportunités',
    'crm.add':            'Ajouter',
    'crm.edit':           'Modifier',
    'crm.delete':         'Supprimer',
    'crm.save':           'Enregistrer',
    'crm.cancel':         'Annuler',

    // Tenders
    'tenders.title':            "Appels d'offres",
    'tenders.import_pdf':       'Importer depuis PDF',
    'tenders.new':              'Nouvel AO',
    'tenders.status.go':        'Go',
    'tenders.status.no_go':     'No Go',
    'tenders.status.draft':     'Brouillon',
    'tenders.status.submitted': 'Soumis',
    'tenders.score':            'Score de correspondance',
    'tenders.workflow':         'Workflow IA',
    'tenders.boamp':            'Rechercher BOAMP',

    // Deliverables
    'deliverables.title':       'Livrables',
    'deliverables.export_pdf':  'Exporter PDF',
    'deliverables.export_html': 'Exporter HTML',
    'deliverables.export_md':   'Exporter Markdown',
    'deliverables.approve':     'Approuver',
    'deliverables.review':      'En révision',
    'deliverables.versions':    'Historique des versions',
    'deliverables.snapshot':    'Créer un snapshot',
    'deliverables.new':         'Nouveau livrable',

    // Auth
    'auth.login':    'Se connecter',
    'auth.logout':   'Se déconnecter',
    'auth.email':    'Email',
    'auth.password': 'Mot de passe',
    'auth.forgot':   'Mot de passe oublié ?',

    // Calculator
    'calc.title':      'Calculateur de rentabilité',
    'calc.tjm':        'Taux journalier moyen HT',
    'calc.days':       'Jours facturés / an',
    'calc.net_annual': 'Revenu net / an',
    'calc.net_monthly':'Net / mois moyen',
    'calc.presets':    'Presets',
    'calc.simulate':   'Simuler',

    // Settings
    'settings.title':     'Configuration',
    'settings.health':    'Santé système',
    'settings.providers': 'Providers IA',
    'settings.email':     'Email SMTP',
    'settings.stripe':    'Stripe Billing',
    'settings.security':  'Sécurité',
    'settings.api_keys':  'Clés API',
    'settings.webhooks':  'Webhooks',

    // Team
    'team.title':   'Gestion Équipe',
    'team.invite':  'Inviter un membre',
    'team.roles':   'Rôles',
    'team.members': 'Membres',
    'team.active':  'Actif',
    'team.inactive':'Inactif',

    // Agents
    'agent.cv_title':       'Agent CV Consultant',
    'agent.cv_subtitle':    "Entrez le nom du consultant — l'IA génère un CV complet",
    'agent.cv_generate':    'Générer le CV',
    'agent.cv_regenerate':  'Régénérer',
    'agent.linkedin_title': 'Agent LinkedIn',
    'agent.generate':       'Générer',
    'agent.regenerate':     'Régénérer',
    'agent.domain':         'Domaine de compétence',
    'agent.experience':     "Années d'expérience",

    // Workflow
    'workflow.title':    'Workflow IA',
    'workflow.start':    'Démarrer le workflow',
    'workflow.approve':  'Valider',
    'workflow.reject':   'Rejeter',
    'workflow.pending':  'En attente de validation',
    'workflow.done':     'Terminé',
    'workflow.running':  'En cours',

    // Common
    'common.loading':     'Chargement…',
    'common.error':       'Erreur',
    'common.save':        'Enregistrer',
    'common.cancel':      'Annuler',
    'common.confirm':     'Confirmer',
    'common.delete':      'Supprimer',
    'common.search':      'Rechercher…',
    'common.add':         'Ajouter',
    'common.edit':        'Modifier',
    'common.close':       'Fermer',
    'common.yes':         'Oui',
    'common.no':          'Non',
    'common.or':          'ou',
    'common.and':         'et',
    'common.from':        'De',
    'common.to':          'À',
    'common.date':        'Date',
    'common.status':      'Statut',
    'common.actions':     'Actions',
    'common.name':        'Nom',
    'common.description': 'Description',
    'common.results':     'résultats',
    'common.new':         'Nouveau',
    'common.view':        'Voir',
    'common.download':    'Télécharger',
    'common.refresh':     'Actualiser',
    'common.filter':      'Filtrer',
    'common.sort':        'Trier',
    'common.copy':        'Copier',
    'common.copied':      'Copié !',
    'common.export':      'Exporter',
    'common.import':      'Importer',
    'common.required':    'Obligatoire',
    'common.optional':    'Optionnel',
    'common.preview':     'Aperçu',
    'common.history':     'Historique',

    // Pricing
    'pricing.title':       'Plans & Tarifs',
    'pricing.monthly':     'Mensuel',
    'pricing.yearly':      'Annuel',
    'pricing.current':     'Plan actuel',
    'pricing.upgrade':     'Passer au',
    'pricing.contact':     'Nous contacter',
    'pricing.free_forever':'gratuit pour toujours',
    'pricing.unlimited':   '∞',

    // Audit
    'audit.title':   'Logs d\'audit',
    'audit.action':  'Action',
    'audit.user':    'Utilisateur',
    'audit.date':    'Date',
    'audit.export':  'Exporter les logs',
  },

  en: {
    // Navigation

    // Dashboard

    // CRM

    // Tenders

    // Deliverables

    // Auth

    // Calculator

    // Settings

    // Team

    // Agents

    // Workflow

    // Common

    // Pricing

    // Audit
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface I18nContext {
  lang:    Lang;
  setLang: (l: Lang) => void;
  t:       (key: string, fallback?: string) => string;
}

const Ctx = createContext<I18nContext>({
  lang:    'fr',
  setLang: () => {},
  t:       (k) => k,
});

const LS_KEY = 'datasphere_lang';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY) as Lang | null;
      if (stored === 'en' || stored === 'fr') return stored;
    } catch { /* ignore */ }
    return navigator.language.startsWith('en') ? 'en' : 'fr';
  });

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
  }

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  function t(key: string, fallback?: string): string {
    return TRANSLATIONS[lang][key]
      ?? TRANSLATIONS['fr'][key]
      ?? fallback
      ?? key;
  }

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useI18n() {
  return useContext(Ctx);
}

// ─── Lang Toggle ──────────────────────────────────────────────────────────────

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div
      title="Changer la langue / Switch language"
      style={{
        display: 'flex', alignItems: 'center', gap: 1,
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(148,163,184,.12)',
        borderRadius: 8, padding: '2px',
      }}
    >
      {(['fr', 'en'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={l === 'fr' ? 'Passer en Français' : 'Switch to English'}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '.72rem',
            letterSpacing: '.04em',
            transition: 'all .15s',
            background: lang === l
              ? 'linear-gradient(135deg,rgba(250,204,21,.2),rgba(245,158,11,.15))'
              : 'transparent',
            color: lang === l ? '#facc15' : '#475569',
            boxShadow: lang === l ? '0 1px 4px rgba(250,204,21,.15)' : 'none',
          }}
        >
          {l === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>
      ))}
    </div>
  );
}
