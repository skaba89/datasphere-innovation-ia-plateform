/**
 * Système i18n léger — FR / EN
 * Zero dependency — pas de lib externe requise.
 *
 * Usage :
 *   const { t, lang, setLang } = useI18n();
 *   <h1>{t('dashboard.title')}</h1>
 *
 * Ajout de clés : éditer les dictionnaires TRANSLATIONS ci-dessous.
 * La langue est persistée dans localStorage.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'fr' | 'en';

// ─── Dictionnaires ────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.dashboard':      'Tableau de bord',
    'nav.organizations':  'Organisations',
    'nav.opportunities':  'Opportunités',
    'nav.tenders':        "Appels d'offres",
    'nav.profiles':       'Profils',
    'nav.deliverables':   'Livrables',
    'nav.commercial':     'CRM',
    'nav.operations':     'Opérations',
    'nav.team':           'Équipe',
    'nav.audit':          'Audit',
    'nav.workspaces':     'Workspaces',
    'nav.data_export':    'Export données',
    'nav.calculator':     'Calculateur',
    'nav.pricing':        'Plans & Tarifs',
    'nav.settings':       'Configuration',
    'nav.profile':        'Mon profil',

    // Dashboard
    'dashboard.title':      'Tableau de bord',
    'dashboard.subtitle':   'Vue d\'ensemble de votre activité',
    'dashboard.pipeline':   'Pipeline commercial',
    'dashboard.tenders':    "Appels d'offres",
    'dashboard.agents':     'Agents IA',
    'dashboard.deliverables': 'Livrables',

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
    'tenders.title':      "Appels d'offres",
    'tenders.import_pdf': 'Importer depuis PDF',
    'tenders.new':        'Nouvel AO',
    'tenders.status.go':        'Go',
    'tenders.status.no_go':     'No Go',
    'tenders.status.draft':     'Brouillon',
    'tenders.status.submitted': 'Soumis',
    'tenders.score':      'Score de correspondance',

    // Deliverables
    'deliverables.title':         'Livrables',
    'deliverables.export_pdf':    'Exporter PDF',
    'deliverables.export_html':   'Exporter HTML',
    'deliverables.export_md':     'Exporter Markdown',
    'deliverables.approve':       'Approuver',
    'deliverables.review':        'En révision',
    'deliverables.versions':      'Historique des versions',
    'deliverables.snapshot':      'Créer un snapshot',

    // Auth
    'auth.login':         'Se connecter',
    'auth.logout':        'Se déconnecter',
    'auth.email':         'Email',
    'auth.password':      'Mot de passe',
    'auth.forgot':        'Mot de passe oublié ?',

    // Calculator
    'calc.title':         'Calculateur de rentabilité',
    'calc.tjm':           'Taux journalier moyen HT',
    'calc.days':          'Jours facturés / an',
    'calc.net_annual':    'Revenu net / an',
    'calc.net_monthly':   'Net / mois moyen',
    'calc.presets':       'Presets',

    // Settings
    'settings.title':     'Configuration',
    'settings.health':    'Santé système',
    'settings.providers': 'Providers IA',
    'settings.email':     'Email SMTP',
    'settings.stripe':    'Stripe Billing',
    'settings.security':  'Sécurité',

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

    // Pricing
    'pricing.title':      'Plans & Tarifs',
    'pricing.monthly':    'Mensuel',
    'pricing.yearly':     'Annuel',
    'pricing.current':    'Plan actuel',
    'pricing.upgrade':    'Passer au',
    'pricing.contact':    'Nous contacter',
    'pricing.free_forever': 'gratuit pour toujours',
    'pricing.unlimited':  '∞',
  },

  en: {
    // Navigation
    'nav.dashboard':      'Dashboard',
    'nav.organizations':  'Organizations',
    'nav.opportunities':  'Opportunities',
    'nav.tenders':        'Tenders',
    'nav.profiles':       'Profiles',
    'nav.deliverables':   'Deliverables',
    'nav.commercial':     'CRM',
    'nav.operations':     'Operations',
    'nav.team':           'Team',
    'nav.audit':          'Audit',
    'nav.workspaces':     'Workspaces',
    'nav.data_export':    'Data Export',
    'nav.calculator':     'Calculator',
    'nav.pricing':        'Pricing',
    'nav.settings':       'Settings',
    'nav.profile':        'My Profile',

    // Dashboard
    'dashboard.title':      'Dashboard',
    'dashboard.subtitle':   'Overview of your activity',
    'dashboard.pipeline':   'Commercial pipeline',
    'dashboard.tenders':    'Tenders',
    'dashboard.agents':     'AI Agents',
    'dashboard.deliverables': 'Deliverables',

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
    'tenders.title':      'Tenders',
    'tenders.import_pdf': 'Import from PDF',
    'tenders.new':        'New Tender',
    'tenders.status.go':        'Go',
    'tenders.status.no_go':     'No Go',
    'tenders.status.draft':     'Draft',
    'tenders.status.submitted': 'Submitted',
    'tenders.score':      'Match score',

    // Deliverables
    'deliverables.title':         'Deliverables',
    'deliverables.export_pdf':    'Export PDF',
    'deliverables.export_html':   'Export HTML',
    'deliverables.export_md':     'Export Markdown',
    'deliverables.approve':       'Approve',
    'deliverables.review':        'In review',
    'deliverables.versions':      'Version history',
    'deliverables.snapshot':      'Create snapshot',

    // Auth
    'auth.login':         'Sign in',
    'auth.logout':        'Sign out',
    'auth.email':         'Email',
    'auth.password':      'Password',
    'auth.forgot':        'Forgot password?',

    // Calculator
    'calc.title':         'Profitability Calculator',
    'calc.tjm':           'Daily rate (excl. VAT)',
    'calc.days':          'Billed days / year',
    'calc.net_annual':    'Annual net income',
    'calc.net_monthly':   'Avg. monthly net',
    'calc.presets':       'Presets',

    // Settings
    'settings.title':     'Settings',
    'settings.health':    'System health',
    'settings.providers': 'AI Providers',
    'settings.email':     'SMTP Email',
    'settings.stripe':    'Stripe Billing',
    'settings.security':  'Security',

    // Common
    'common.loading':     'Loading…',
    'common.error':       'Error',
    'common.save':        'Save',
    'common.cancel':      'Cancel',
    'common.confirm':     'Confirm',
    'common.delete':      'Delete',
    'common.search':      'Search…',
    'common.add':         'Add',
    'common.edit':        'Edit',
    'common.close':       'Close',
    'common.yes':         'Yes',
    'common.no':          'No',
    'common.or':          'or',
    'common.and':         'and',
    'common.from':        'From',
    'common.to':          'To',
    'common.date':        'Date',
    'common.status':      'Status',
    'common.actions':     'Actions',
    'common.name':        'Name',
    'common.description': 'Description',
    'common.results':     'results',
    'common.new':         'New',
    'common.view':        'View',
    'common.download':    'Download',
    'common.refresh':     'Refresh',
    'common.filter':      'Filter',
    'common.sort':        'Sort',

    // Pricing
    'pricing.title':      'Plans & Pricing',
    'pricing.monthly':    'Monthly',
    'pricing.yearly':     'Yearly',
    'pricing.current':    'Current plan',
    'pricing.upgrade':    'Upgrade to',
    'pricing.contact':    'Contact us',
    'pricing.free_forever': 'free forever',
    'pricing.unlimited':  '∞',
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
    } catch { /* localStorage unavailable */ }
    // Auto-detect from browser
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
      ?? TRANSLATIONS['fr'][key]   // FR fallback
      ?? fallback
      ?? key;                       // key as last resort
  }

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useI18n() {
  return useContext(Ctx);
}

// ─── Lang toggle component ────────────────────────────────────────────────────

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['fr', 'en'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={l === 'fr' ? 'Français' : 'English'}
          style={{
            padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '.72rem', fontFamily: 'monospace',
            background: lang === l ? 'rgba(250,204,21,.15)' : 'transparent',
            color: lang === l ? '#facc15' : '#475569',
            transition: 'all .15s',
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
