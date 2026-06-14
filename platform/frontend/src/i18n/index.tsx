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
    'nav.intelligence':   'Intelligence',
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
    'nav.dashboard':      'Dashboard',
    'nav.organizations':  'Organizations',
    'nav.opportunities':  'Opportunities',
    'nav.tenders':        'Tenders',
    'nav.profiles':       'Consultant Profiles',
    'nav.deliverables':   'Deliverables',
    'nav.commercial':     'CRM Commercial',
    'nav.operations':     'Operations',
    'nav.team':           'Team',
    'nav.audit':          'Audit',
    'nav.workspaces':     'Workspaces',
    'nav.data_export':    'Data Export',
    'nav.calculator':     'Calculator',
    'nav.pricing':        'Plans & Pricing',
    'nav.settings':       'Settings',
    'nav.profile':        'My Profile',
    'nav.linkedin':       'LinkedIn Agent',
    'nav.cv_consultant':  'CV Agent',
    'nav.notifications':  'Notifications',
    'nav.search':         'Search',
    'nav.webhooks':       'Webhooks',
    'nav.intelligence':   'Intelligence',
    'nav.ai_providers':   'AI Providers',

    // Dashboard
    'dashboard.title':      'Dashboard',
    'dashboard.subtitle':   'Overview of your activity',
    'dashboard.pipeline':   'Commercial pipeline',
    'dashboard.tenders':    'Tenders',
    'dashboard.agents':     'AI Agents',
    'dashboard.deliverables': 'Deliverables',
    'dashboard.kpi_tenders':  'Active tenders',
    'dashboard.kpi_go':       'GO decisions',
    'dashboard.kpi_delivered':'Generated deliverables',
    'dashboard.kpi_providers':'Active providers',

    // CRM
    'crm.organizations':  'Organizations',
    'crm.contacts':       'Contacts',
    'crm.opportunities':  'Opportunities',
    'crm.add':            'Add',
    'crm.edit':           'Edit',
    'crm.delete':         'Delete',
    'crm.save':           'Save',
    'crm.cancel':         'Cancel',

    // Tenders
    'tenders.title':            'Tenders',
    'tenders.import_pdf':       'Import from PDF',
    'tenders.new':              'New tender',
    'tenders.boamp':            'BOAMP scan',
    'tenders.workflow':         'Start workflow',
    'tenders.score':            'Score',
    'tenders.status.draft':     'Draft',
    'tenders.status.go':        'GO',
    'tenders.status.no_go':     'NO GO',
    'tenders.status.submitted': 'Submitted',

    // Deliverables
    'deliverables.title':       'Deliverables',
    'deliverables.new':         'New deliverable',
    'deliverables.approve':     'Approve',
    'deliverables.review':      'Request review',
    'deliverables.export_md':   'Export Markdown',
    'deliverables.export_html': 'Export HTML',
    'deliverables.export_pdf':  'Export PDF',
    'deliverables.versions':    'Version history',
    'deliverables.snapshot':    'Create snapshot',

    // Auth
    'auth.login':    'Log in',
    'auth.logout':   'Log out',
    'auth.email':    'Email',
    'auth.password': 'Password',
    'auth.forgot':   'Forgot password?',

    // Calculator
    'calc.title':      'Rate calculator',
    'calc.tjm':        'Daily rate (€)',
    'calc.days':       'Billable days/year',
    'calc.simulate':   'Simulate',
    'calc.presets':    'Presets',
    'calc.net_monthly':'Net monthly',
    'calc.net_annual': 'Net annual',

    // Settings
    'settings.title':    'Settings',
    'settings.providers':'AI Providers',
    'settings.api_keys': 'API Keys',
    'settings.webhooks': 'Webhooks',
    'settings.email':    'Email',
    'settings.stripe':   'Billing',
    'settings.security': 'Security',
    'settings.health':   'System health',

    // Team
    'team.title':    'Team',
    'team.members':  'Members',
    'team.invite':   'Invite member',
    'team.roles':    'Roles',
    'team.active':   'Active',
    'team.inactive': 'Inactive',

    // Agents
    'agent.cv_title':     'CV Agent',
    'agent.cv_subtitle':  'Generate professional CVs tailored to missions',
    'agent.domain':       'Domain',
    'agent.experience':   'Years of experience',
    'agent.generate':     'Generate CV',
    'agent.cv_generate':  'Generate',
    'agent.cv_regenerate':'Regenerate',
    'agent.regenerate':   'Regenerate',
    'agent.linkedin_title':'LinkedIn Agent',

    // Workflow
    'workflow.title':   'Workflow',
    'workflow.start':   'Start workflow',
    'workflow.approve': 'Approve',
    'workflow.reject':  'Reject',
    'workflow.pending': 'Pending',
    'workflow.running': 'Running',
    'workflow.done':    'Done',

    // Common
    'common.add':         'Add',
    'common.edit':        'Edit',
    'common.delete':      'Delete',
    'common.save':        'Save',
    'common.cancel':      'Cancel',
    'common.confirm':     'Confirm',
    'common.close':       'Close',
    'common.search':      'Search',
    'common.filter':      'Filter',
    'common.sort':        'Sort',
    'common.export':      'Export',
    'common.import':      'Import',
    'common.download':    'Download',
    'common.preview':     'Preview',
    'common.refresh':     'Refresh',
    'common.loading':     'Loading…',
    'common.error':       'Error',
    'common.yes':         'Yes',
    'common.no':          'No',
    'common.or':          'or',
    'common.and':         'and',
    'common.required':    'Required',
    'common.optional':    'Optional',
    'common.name':        'Name',
    'common.description': 'Description',
    'common.date':        'Date',
    'common.status':      'Status',
    'common.actions':     'Actions',
    'common.view':        'View',
    'common.new':         'New',
    'common.from':        'From',
    'common.to':          'To',
    'common.history':     'History',
    'common.results':     'results',
    'common.copy':        'Copy',
    'common.copied':      'Copied!',

    // Pricing
    'pricing.title':       'Plans & Pricing',
    'pricing.free_forever':'Free forever',
    'pricing.monthly':     'Monthly',
    'pricing.yearly':      'Yearly',
    'pricing.upgrade':     'Upgrade',
    'pricing.current':     'Current plan',
    'pricing.contact':     'Contact us',
    'pricing.unlimited':   'Unlimited',

    // Audit
    'audit.title':  'Audit log',
    'audit.action': 'Action',
    'audit.user':   'User',
    'audit.date':   'Date',
    'audit.export': 'Export CSV',
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
