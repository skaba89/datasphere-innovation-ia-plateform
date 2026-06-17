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
    'common.delete':      'Supprimer',
    'common.search':      'Rechercher…',
    'common.edit':        'Modifier',
    'common.or':          'ou',
    'common.and':         'et',
    'common.from':        'De',
    'common.to':          'À',
    'common.date':        'Date',
    'common.actions':     'Actions',
    'common.name':        'Nom',
    'common.description': 'Description',
    'common.results':     'résultats',
    'common.new':         'Nouveau',
    'common.refresh':     'Actualiser',
    'common.filter':      'Filtrer',
    'common.sort':        'Trier',
    'common.copy':        'Copier',
    'common.copied':      'Copié !',
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



    // ── Tenders page ──────────────────────────────────────────────────────────
    'tenders.module':         'Module stratégique',
    'tenders.subtitle':       'Veille BOAMP · Qualification IA · Workflow automatisé · Livrable',
    'tenders.search_btn':     'Chercher des AOs',
    'tenders.import_pdf':     'Importer PDF',
    'tenders.workflow_btn':   'Workflow IA',
    'tenders.memoire_btn':    'Mémoire Technique',
    'tenders.gonogo_btn':     'Go/No-Go IA',
    'tenders.timeline_btn':   'Timeline',
    'tenders.autoimport_btn': 'Auto-Import IA',
    'tenders.boamp_title':    'Veille AO automatisée',
    'tenders.boamp_subtitle': 'Interroge la veille backend, qualifie les AOs',
    'tenders.keywords':       'Mots-clés de veille',
    'tenders.search_ao':      'Chercher les AOs',
    'tenders.reset':          'Réinitialiser',
    'tenders.import_select':  'Importer la sélection',
    'tenders.error_network':  'Serveur inaccessible — le backend démarre (30s). Réessayez.',
    'tenders.no_results':     'Aucun AO trouvé. Essayez avec d\'autres mots-clés.',

    // ── CRM extras ───────────────────────────────────────────────────────────

    // ── Tenders extras ────────────────────────────────────────────────────────

    // ── LinkedIn extras ───────────────────────────────────────────────────────

    // ── Ops extras ────────────────────────────────────────────────────────────

    // ── Profile extras ────────────────────────────────────────────────────────

    // ── CRM extras ───────────────────────────────────────────────────────────
    'crm.create_org':       'Create organization',
    'crm.create_opp':       'Create opportunity',
    'crm.org_name':         'Organization name',
    'crm.estimated_value':  'Estimated value',
    'crm.probability':      'Probability',
    'crm.stage':            'Stage',
    'crm.stage_prospect':   'Prospect identified',
    'crm.stage_proposal':   'Proposal sent',
    'crm.stage_negociation':'Negotiation',
    'crm.stage_won':        'Won',
    'crm.stage_lost':       'Lost',
    'crm.pipeline_total':   'Total pipeline',
    'crm.conversion_rate':  'Conversion rate',

    // ── Tenders extras ────────────────────────────────────────────────────────
    'tenders.detail':       'Tender detail',
    'tenders.general_info': 'General information',
    'tenders.buyer':        'Buyer',
    'tenders.reference':    'Reference',
    'tenders.pub_date':     'Publication date',
    'tenders.deadline':     'Deadline',
    'tenders.budget':       'Estimated budget',
    'tenders.sector':       'Sector',
    'tenders.summary':      'Summary',
    'tenders.gonogo_criteria': 'Go/No-Go criteria',
    'tenders.add_criterion':'Add criterion',
    'tenders.ai_score':     'AI score',
    'tenders.start_workflow': 'Start workflow',
    'tenders.pdf_file':     'PDF file',
    'tenders.drag_pdf':     'Drag a PDF here',
    'tenders.choose_file':  'Choose a file',

    // ── LinkedIn extras ───────────────────────────────────────────────────────
    'linkedin.topic':       'Post subject',
    'linkedin.persona':     'Target persona',
    'linkedin.length':      'Length',
    'linkedin.short':       'Short',
    'linkedin.medium':      'Medium',
    'linkedin.long':        'Long',
    'linkedin.generated':   'Generated post',
    'linkedin.copy':        'Copy post',
    'linkedin.oauth_connect': 'Connect to LinkedIn',

    // ── Ops extras ────────────────────────────────────────────────────────────
    'ops.active_agents':    'Active agents',
    'ops.pending_actions':  'Pending actions',
    'ops.last_run':         'Last run',
    'ops.next_run':         'Next run',

    // ── Profile extras ────────────────────────────────────────────────────────
    'profile.personal_info': 'Personal information',
    'profile.expertise':    'Expertise',
    'profile.experience':   'Experience (years)',
    'profile.location':     'Location',
    'profile.sectors':      'Preferred sectors',
    'profile.security':     'Account security',

    // ── Team extras ──────────────────────────────────────────────────────────
    'team.admin_role':        'Administrateur',
    'team.manager_role':      'Manager',
    'team.consultant_role':   'Consultant',
    'team.viewer_role':       'Observateur',
    'team.user_email':        'Email de l\'utilisateur',
    'team.change_role_of':    'Changer le rôle de',
    'team.confirm_deactivate': 'Confirmer la désactivation',
    'team.email_invite':      'Invitation par email',
    'team.toggle_active':     'Activer / Désactiver',

    // ── Invoicing extras ─────────────────────────────────────────────────────
    'invoicing.client_quote': 'Devis client',
    'invoicing.quote_title':  'Titre du devis',
    'invoicing.client_email': 'Email client',
    'invoicing.company_name': 'Nom de l\'entreprise',
    'invoicing.net_30':       '30 jours net',
    'invoicing.immediate':    'Immédiat',
    'invoicing.net_60':       '60 jours net',
    'invoicing.ht':           'HT',
    'invoicing.ttc':          'TTC',
    'invoicing.no_quotes':    'Aucun devis',
    'invoicing.no_invoices':  'Aucune facture',

    // ── Deliverables extras ──────────────────────────────────────────────────
    'deliverables.library':   'Bibliothèque de livrables',
    'deliverables.governed':  'Livrables Gouvernés',
    'deliverables.subtitle':  'Mémoires techniques, propositions commerciales, notes de cadrage',
    'deliverables.new':       'Nouveau livrable',
    'deliverables.title_label': 'Titre du livrable',
    'deliverables.type_memo': 'Mémoire technique',
    'deliverables.type_proposal': 'Proposition commerciale',
    'deliverables.type_note': 'Note de cadrage',
    'deliverables.all_types': 'Tous types',
    'deliverables.drafts':    'Brouillons',
    'deliverables.in_review': 'En révision',
    'deliverables.files':     'Fichiers',
    'deliverables.empty':     'Aucun livrable',
    'deliverables.generate_ai': 'Générer IA',

    // ── Common extras ─────────────────────────────────────────────────────────
    'common.confirm':   'Confirmer',
    'common.close':     'Fermer',
    'common.view':      'Vue',
    'common.export':    'Exporter',
    'common.download':  'Télécharger',
    'common.add':       'Ajouter',
    'common.update':    'Mettre à jour',
    'common.yes':       'Oui',
    'common.no':        'Non',
    'common.status':    'Statut',

    // ── Invoicing ─────────────────────────────────────────────────────────────
    'invoicing.title':          'Facturation',
    'invoicing.quotes':         'Devis',
    'invoicing.invoices':       'Factures',
    'invoicing.new_quote':      'Nouveau devis',
    'invoicing.new_invoice':    'Nouvelle facture',
    'invoicing.draft':          'Brouillon',
    'invoicing.sent':           'Envoyé',
    'invoicing.paid':           'Payé',
    'invoicing.overdue':        'En retard',
    'invoicing.cancelled':      'Annulé',
    'invoicing.total_ht':       'Total HT',
    'invoicing.tva':            'TVA',
    'invoicing.total_ttc':      'Total TTC',
    'invoicing.client':         'Client',
    'invoicing.reference':      'Référence',
    'invoicing.convert':        'Convertir en facture',
    'invoicing.export_pdf':     'Exporter PDF',
    'invoicing.daily_rate':     'TJM (€/j)',
    'invoicing.days_count':     'Nombre de jours',
    'invoicing.valid_until':    'Valide jusqu\'au',
    'invoicing.due_date':       'Échéance',
    'invoicing.payment_terms':  'Conditions de paiement',

    // ── Analytics ──────────────────────────────────────────────────────────────
    'analytics.title':          'Analytics avancées',
    'analytics.tab_overview':   'Vue 12 mois',
    'analytics.tab_pipeline':   'Pipeline',
    'analytics.tab_perf':       'Performance',
    'analytics.tab_agents':     'Agents & Ops',
    'analytics.win_rate':       'Taux de succès',
    'analytics.pipeline_value': 'Pipeline €',
    'analytics.avg_score':      'Score moyen Go',
    'analytics.ao_detected':    'AOs détectés',
    'analytics.won':            'Gagnés',
    'analytics.workflows':      'Workflows',

    // ── LinkedIn ───────────────────────────────────────────────────────────────
    'linkedin.title':           'Agent LinkedIn',
    'linkedin.generate':        'Générer & Publier',
    'linkedin.calendar':        'Calendrier éditorial',
    'linkedin.schedule_30d':    'Générer calendrier 30 jours',
    'linkedin.publish_now':     '▶ Publier maintenant',
    'linkedin.next_post':       'Prochain post',
    'linkedin.total':           'Total planifiés',
    'linkedin.published':       'Publiés',
    'linkedin.pending':         'En attente',
    'linkedin.failed':          'Échecs',
    'linkedin.topic_data':      'Data Engineering',
    'linkedin.topic_ao':        'Insight AO',
    'linkedin.topic_market':    'Tendance marché',
    'linkedin.topic_tip':       'Tech Tip',
    'linkedin.topic_africa':    'Afrique Data',

    // ── Team ───────────────────────────────────────────────────────────────────
    'team.create_account':      'Créer un compte',
    'team.provisional_pwd':     'Mot de passe provisoire',
    'team.first_name':          'Prénom',
    'team.last_name':           'Nom',
    'team.role':                'Rôle',
    'team.activate':            'Réactiver',
    'team.deactivate':          'Désactiver',
    'team.change_role':         'Changer le rôle',
    'team.invitation_sent':     'Invitation envoyée',
    'team.must_change_pwd':     'Doit changer son MDP',

    // ── User profile ───────────────────────────────────────────────────────────
    'profile.title':            'Mon profil',
    'profile.bio':              'Biographie',
    'profile.skills':           'Compétences',
    'profile.tjm':              'TJM (€/j)',
    'profile.availability':     'Disponibilité',
    'profile.change_pwd':       'Changer le mot de passe',
    'profile.current_pwd':      'Mot de passe actuel',
    'profile.new_pwd':          'Nouveau mot de passe',
    'profile.confirm_pwd':      'Confirmer le mot de passe',
    'profile.avatar':           'Changer l\'avatar',
    'profile.save_changes':     'Enregistrer les modifications',

    // ── Dashboard ──────────────────────────────────────────────────────────────
    'dashboard.welcome':        'Bon retour',
    'dashboard.deadlines':      'Échéances proches',
    'dashboard.activity':       'Activité récente',
    'dashboard.no_tenders':     'Aucun AO en cours',
    'dashboard.win_rate':       'Win rate',
    'dashboard.setup_guide':    'Guide de configuration',

    // ── Workspace ──────────────────────────────────────────────────────────────
    'workspace.title':          'Workspaces',
    'workspace.create':         'Créer un workspace',
    'workspace.name':           'Nom du workspace',
    'workspace.members':        'Membres',
    'workspace.plan':           'Plan',
    'workspace.active':         'Actif',
    'workspace.inactive':       'Inactif',
    'workspace.global_view':    'Vue globale',
    'workspace.switch':         'Changer de workspace',

    // ── Notifications ──────────────────────────────────────────────────────────
    'notif.title':              'Notifications',
    'notif.mark_read':          'Tout marquer comme lu',
    'notif.empty':              'Aucune notification',
    'notif.high':               'Urgent',
    'notif.medium':             'Normal',
    'notif.low':                'Info',

    // ── Audit ──────────────────────────────────────────────────────────────────
    'audit.all_statuses':       'Tous les statuts',
    'audit.all_actions':        'Toutes les actions',
    'audit.search':             'Rechercher…',
    'audit.export_csv':         'Exporter CSV',
    'audit.no_results':         'Aucun événement trouvé',

    // ── Search ─────────────────────────────────────────────────────────────────
    'search.title':             'Recherche globale',
    'search.placeholder':       'Rechercher un AO, livrable, client, contact…',
    'search.no_results':        'Aucun résultat',
    'search.recent':            'Recherches récentes',
    'search.ai_results':        'Résultats IA',
    'search.results_for':       'résultats pour',

    // ── Data export ────────────────────────────────────────────────────────────
    'export.title':             'Export données',
    'export.tenders_csv':       'AOs en CSV',
    'export.deliverables_csv':  'Livrables en CSV',
    'export.crm_csv':           'CRM en CSV',
    'export.pdf_report':        'Rapport PDF',
    'export.excel':             'Export Excel',

    // ── Settings ───────────────────────────────────────────────────────────────
    'settings.env_vars':        'Variables d\'environnement Render',
    'settings.optional':        'Optionnel',
    'settings.required':        'Requis',
    'settings.configured':      'Configuré',
    'settings.not_configured':  'Non configuré',
    'settings.guide':           'Guide de configuration',

    // ── AI Providers ───────────────────────────────────────────────────────────
    'ai.title':                 'Providers IA',
    'ai.active':                'Actif',
    'ai.inactive':              'Inactif',
    'ai.configure':             'Configurer',
    'ai.test':                  'Tester',
    'ai.model':                 'Modèle',
    'ai.provider':              'Provider',

    // ── Operations ─────────────────────────────────────────────────────────────
    'ops.title':                'Opérations',
    'ops.tab_agents':           'Agents IA',
    'ops.tab_scheduler':        'Scheduler',
    'ops.tab_health':           'Santé',
    'ops.tab_gantt':            'Planning',
    'ops.tab_suggestions':      'Suggestions',
    'ops.tab_approvals':        'Approbations',

    // ── Intelligence ───────────────────────────────────────────────────────────
    'intel.title':              'Intelligence',
    'intel.rag_search':         'Recherche sémantique',
    'intel.providers':          'Providers actifs',
    'intel.embeddings':         'Documents indexés',

    // ── Calculator ─────────────────────────────────────────────────────────────
    'calc.charges':             'Taux de charges',
    'calc.expenses':            'Charges fixes/mois',
    'calc.save_scenario':       'Sauvegarder ce scénario',
    'calc.gross':               'Brut annuel',
    'calc.charges_amount':      'Charges',

    // ── Common extras ──────────────────────────────────────────────────────────
    'common.back':              'Retour',
    'common.next':              'Suivant',
    'common.previous':          'Précédent',
    'common.submit':            'Soumettre',
    'common.generate':          'Générer',
    'common.configure':         'Configurer',
    'common.activate':          'Activer',
    'common.deactivate':        'Désactiver',
    'common.approve':           'Approuver',
    'common.reject':            'Rejeter',
    'common.publish':           'Publier',
    'common.schedule':          'Planifier',
    'common.cancel_post':       'Annuler le post',
    'common.days':              'jours',
    'common.months':            'mois',
    'common.years':             'ans',
    'common.hours':             'heures',
    'common.minutes':           'minutes',
    'common.per_day':           '/ jour',
    'common.per_month':         '/ mois',
    'common.per_year':          '/ an',
    'common.no_data':           'Aucune donnée',
    'common.empty':             'Vide',
    'common.all':               'Tous',
    'common.none':              'Aucun',
    'common.unknown':           'Inconnu',

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
    'common.edit':        'Edit',
    'common.delete':      'Delete',
    'common.save':        'Save',
    'common.cancel':      'Cancel',
    'common.search':      'Search',
    'common.filter':      'Filter',
    'common.sort':        'Sort',
    'common.import':      'Import',
    'common.preview':     'Preview',
    'common.refresh':     'Refresh',
    'common.loading':     'Loading…',
    'common.error':       'Error',
    'common.or':          'or',
    'common.and':         'and',
    'common.required':    'Required',
    'common.optional':    'Optional',
    'common.name':        'Name',
    'common.description': 'Description',
    'common.date':        'Date',
    'common.actions':     'Actions',
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



    // ── Tenders page ──────────────────────────────────────────────────────────

    // ── CRM extras ───────────────────────────────────────────────────────────

    // ── Tenders extras ────────────────────────────────────────────────────────

    // ── LinkedIn extras ───────────────────────────────────────────────────────

    // ── Ops extras ────────────────────────────────────────────────────────────

    // ── Profile extras ────────────────────────────────────────────────────────

    // ── Team extras ──────────────────────────────────────────────────────────

    // ── Invoicing extras ─────────────────────────────────────────────────────

    // ── Deliverables extras ──────────────────────────────────────────────────

    // ── Common extras ─────────────────────────────────────────────────────────

    // ── Invoicing ─────────────────────────────────────────────────────────────
    'invoicing.title':          'Facturation',
    'invoicing.quotes':         'Devis',
    'invoicing.invoices':       'Factures',
    'invoicing.new_quote':      'Nouveau devis',
    'invoicing.new_invoice':    'Nouvelle facture',
    'invoicing.draft':          'Brouillon',
    'invoicing.sent':           'Envoyé',
    'invoicing.paid':           'Payé',
    'invoicing.overdue':        'En retard',
    'invoicing.cancelled':      'Annulé',
    'invoicing.total_ht':       'Total HT',
    'invoicing.tva':            'TVA',
    'invoicing.total_ttc':      'Total TTC',
    'invoicing.client':         'Client',
    'invoicing.reference':      'Référence',
    'invoicing.convert':        'Convertir en facture',
    'invoicing.export_pdf':     'Exporter PDF',
    'invoicing.daily_rate':     'TJM (€/j)',
    'invoicing.days_count':     'Nombre de jours',
    'invoicing.valid_until':    'Valide jusqu\'au',
    'invoicing.due_date':       'Échéance',
    'invoicing.payment_terms':  'Conditions de paiement',

    // ── Analytics ──────────────────────────────────────────────────────────────
    'analytics.title':          'Analytics avancées',
    'analytics.tab_overview':   'Vue 12 mois',
    'analytics.tab_pipeline':   'Pipeline',
    'analytics.tab_perf':       'Performance',
    'analytics.tab_agents':     'Agents & Ops',
    'analytics.win_rate':       'Taux de succès',
    'analytics.pipeline_value': 'Pipeline €',
    'analytics.avg_score':      'Score moyen Go',
    'analytics.ao_detected':    'AOs détectés',
    'analytics.won':            'Gagnés',
    'analytics.workflows':      'Workflows',

    // ── LinkedIn ───────────────────────────────────────────────────────────────
    'linkedin.title':           'Agent LinkedIn',
    'linkedin.generate':        'Générer & Publier',
    'linkedin.calendar':        'Calendrier éditorial',
    'linkedin.schedule_30d':    'Générer calendrier 30 jours',
    'linkedin.publish_now':     '▶ Publier maintenant',
    'linkedin.next_post':       'Prochain post',
    'linkedin.total':           'Total planifiés',
    'linkedin.published':       'Publiés',
    'linkedin.pending':         'En attente',
    'linkedin.failed':          'Échecs',
    'linkedin.topic_data':      'Data Engineering',
    'linkedin.topic_ao':        'Insight AO',
    'linkedin.topic_market':    'Tendance marché',
    'linkedin.topic_tip':       'Tech Tip',
    'linkedin.topic_africa':    'Afrique Data',

    // ── Team ───────────────────────────────────────────────────────────────────
    'team.create_account':      'Créer un compte',
    'team.provisional_pwd':     'Mot de passe provisoire',
    'team.first_name':          'Prénom',
    'team.last_name':           'Nom',
    'team.role':                'Rôle',
    'team.activate':            'Réactiver',
    'team.deactivate':          'Désactiver',
    'team.change_role':         'Changer le rôle',
    'team.invitation_sent':     'Invitation envoyée',
    'team.must_change_pwd':     'Doit changer son MDP',

    // ── User profile ───────────────────────────────────────────────────────────
    'profile.title':            'Mon profil',
    'profile.bio':              'Biographie',
    'profile.skills':           'Compétences',
    'profile.tjm':              'TJM (€/j)',
    'profile.availability':     'Disponibilité',
    'profile.change_pwd':       'Changer le mot de passe',
    'profile.current_pwd':      'Mot de passe actuel',
    'profile.new_pwd':          'Nouveau mot de passe',
    'profile.confirm_pwd':      'Confirmer le mot de passe',
    'profile.avatar':           'Changer l\'avatar',
    'profile.save_changes':     'Enregistrer les modifications',

    // ── Dashboard ──────────────────────────────────────────────────────────────
    'dashboard.welcome':        'Bon retour',
    'dashboard.deadlines':      'Échéances proches',
    'dashboard.activity':       'Activité récente',
    'dashboard.no_tenders':     'Aucun AO en cours',
    'dashboard.win_rate':       'Win rate',
    'dashboard.setup_guide':    'Guide de configuration',

    // ── Workspace ──────────────────────────────────────────────────────────────
    'workspace.title':          'Workspaces',
    'workspace.create':         'Créer un workspace',
    'workspace.name':           'Nom du workspace',
    'workspace.members':        'Membres',
    'workspace.plan':           'Plan',
    'workspace.active':         'Actif',
    'workspace.inactive':       'Inactif',
    'workspace.global_view':    'Vue globale',
    'workspace.switch':         'Changer de workspace',

    // ── Notifications ──────────────────────────────────────────────────────────
    'notif.title':              'Notifications',
    'notif.mark_read':          'Tout marquer comme lu',
    'notif.empty':              'Aucune notification',
    'notif.high':               'Urgent',
    'notif.medium':             'Normal',
    'notif.low':                'Info',

    // ── Audit ──────────────────────────────────────────────────────────────────
    'audit.all_statuses':       'Tous les statuts',
    'audit.all_actions':        'Toutes les actions',
    'audit.search':             'Rechercher…',
    'audit.export_csv':         'Exporter CSV',
    'audit.no_results':         'Aucun événement trouvé',

    // ── Search ─────────────────────────────────────────────────────────────────
    'search.title':             'Recherche globale',
    'search.placeholder':       'Rechercher un AO, livrable, client, contact…',
    'search.no_results':        'Aucun résultat',
    'search.recent':            'Recherches récentes',
    'search.ai_results':        'Résultats IA',
    'search.results_for':       'résultats pour',

    // ── Data export ────────────────────────────────────────────────────────────
    'export.title':             'Export données',
    'export.tenders_csv':       'AOs en CSV',
    'export.deliverables_csv':  'Livrables en CSV',
    'export.crm_csv':           'CRM en CSV',
    'export.pdf_report':        'Rapport PDF',
    'export.excel':             'Export Excel',

    // ── Settings ───────────────────────────────────────────────────────────────
    'settings.env_vars':        'Variables d\'environnement Render',
    'settings.optional':        'Optionnel',
    'settings.required':        'Requis',
    'settings.configured':      'Configuré',
    'settings.not_configured':  'Non configuré',
    'settings.guide':           'Guide de configuration',

    // ── AI Providers ───────────────────────────────────────────────────────────
    'ai.title':                 'Providers IA',
    'ai.active':                'Actif',
    'ai.inactive':              'Inactif',
    'ai.configure':             'Configurer',
    'ai.test':                  'Tester',
    'ai.model':                 'Modèle',
    'ai.provider':              'Provider',

    // ── Operations ─────────────────────────────────────────────────────────────
    'ops.title':                'Opérations',
    'ops.tab_agents':           'Agents IA',
    'ops.tab_scheduler':        'Scheduler',
    'ops.tab_health':           'Santé',
    'ops.tab_gantt':            'Planning',
    'ops.tab_suggestions':      'Suggestions',
    'ops.tab_approvals':        'Approbations',

    // ── Intelligence ───────────────────────────────────────────────────────────
    'intel.title':              'Intelligence',
    'intel.rag_search':         'Recherche sémantique',
    'intel.providers':          'Providers actifs',
    'intel.embeddings':         'Documents indexés',

    // ── Calculator ─────────────────────────────────────────────────────────────
    'calc.charges':             'Taux de charges',
    'calc.expenses':            'Charges fixes/mois',
    'calc.save_scenario':       'Sauvegarder ce scénario',
    'calc.gross':               'Brut annuel',
    'calc.charges_amount':      'Charges',

    // ── Common extras ──────────────────────────────────────────────────────────
    'common.back':              'Retour',
    'common.next':              'Suivant',
    'common.previous':          'Précédent',
    'common.submit':            'Soumettre',
    'common.generate':          'Générer',
    'common.configure':         'Configurer',
    'common.activate':          'Activer',
    'common.deactivate':        'Désactiver',
    'common.approve':           'Approuver',
    'common.reject':            'Rejeter',
    'common.publish':           'Publier',
    'common.schedule':          'Planifier',
    'common.cancel_post':       'Annuler le post',
    'common.days':              'jours',
    'common.months':            'mois',
    'common.years':             'ans',
    'common.hours':             'heures',
    'common.minutes':           'minutes',
    'common.per_day':           '/ jour',
    'common.per_month':         '/ mois',
    'common.per_year':          '/ an',
    'common.no_data':           'Aucune donnée',
    'common.empty':             'Vide',
    'common.all':               'Tous',
    'common.none':              'Aucun',
    'common.unknown':           'Inconnu',



    // ── Tenders page ──────────────────────────────────────────────────────────

    // ── CRM extras ───────────────────────────────────────────────────────────

    // ── Tenders extras ────────────────────────────────────────────────────────

    // ── LinkedIn extras ───────────────────────────────────────────────────────

    // ── Ops extras ────────────────────────────────────────────────────────────

    // ── Profile extras ────────────────────────────────────────────────────────

    // ── Team extras ──────────────────────────────────────────────────────────

    // ── Invoicing extras ─────────────────────────────────────────────────────

    // ── Deliverables extras ──────────────────────────────────────────────────

    // ── Common extras ─────────────────────────────────────────────────────────

    // ── Invoicing ─────────────────────────────────────────────────────────────

    // ── Analytics ──────────────────────────────────────────────────────────────

    // ── LinkedIn ───────────────────────────────────────────────────────────────

    // ── Team ───────────────────────────────────────────────────────────────────

    // ── User profile ───────────────────────────────────────────────────────────

    // ── Dashboard ──────────────────────────────────────────────────────────────

    // ── Workspace ──────────────────────────────────────────────────────────────

    // ── Notifications ──────────────────────────────────────────────────────────

    // ── Audit ──────────────────────────────────────────────────────────────────

    // ── Search ─────────────────────────────────────────────────────────────────

    // ── Data export ────────────────────────────────────────────────────────────

    // ── Settings ───────────────────────────────────────────────────────────────

    // ── AI Providers ───────────────────────────────────────────────────────────

    // ── Operations ─────────────────────────────────────────────────────────────

    // ── Intelligence ───────────────────────────────────────────────────────────

    // ── Calculator ─────────────────────────────────────────────────────────────

    // ── Common extras ──────────────────────────────────────────────────────────


    // ── Tenders page ──────────────────────────────────────────────────────────
    'tenders.module':         'Strategic Module',
    'tenders.subtitle':       'BOAMP monitoring · AI qualification · Automated workflow · Deliverable',
    'tenders.search_btn':     'Search tenders',
    'tenders.import_pdf':     'Import PDF',
    'tenders.workflow_btn':   'AI Workflow',
    'tenders.memoire_btn':    'Technical memo',
    'tenders.gonogo_btn':     'AI Go/No-Go',
    'tenders.timeline_btn':   'Timeline',
    'tenders.autoimport_btn': 'AI Auto-Import',
    'tenders.boamp_title':    'Automated tender monitoring',
    'tenders.boamp_subtitle': 'Queries backend, qualifies tenders',
    'tenders.keywords':       'Search keywords',
    'tenders.search_ao':      'Search tenders',
    'tenders.reset':          'Reset',
    'tenders.import_select':  'Import selection',
    'tenders.error_network':  'Server unreachable — backend starting (30s). Please retry.',
    'tenders.no_results':     'No tenders found. Try different keywords.',

    // ── CRM extras ───────────────────────────────────────────────────────────
    'crm.create_org':       'Créer une organisation',
    'crm.create_opp':       'Créer une opportunité',
    'crm.org_name':         'Nom de l\'organisation',
    'crm.estimated_value':  'Valeur estimée',
    'crm.probability':      'Probabilité',
    'crm.stage':            'Étape',
    'crm.stage_prospect':   'Prospect identifié',
    'crm.stage_proposal':   'Proposition envoyée',
    'crm.stage_negociation':'Négociation',
    'crm.stage_won':        'Gagné',
    'crm.stage_lost':       'Perdu',
    'crm.pipeline_total':   'Pipeline total',
    'crm.conversion_rate':  'Taux de conversion',

    // ── Tenders extras ────────────────────────────────────────────────────────
    'tenders.detail':       'Détail de l\'AO',
    'tenders.general_info': 'Informations générales',
    'tenders.buyer':        'Acheteur',
    'tenders.reference':    'Référence',
    'tenders.pub_date':     'Date de publication',
    'tenders.deadline':     'Date limite',
    'tenders.budget':       'Budget estimé',
    'tenders.sector':       'Secteur',
    'tenders.summary':      'Résumé',
    'tenders.gonogo_criteria': 'Critères Go/No-Go',
    'tenders.add_criterion':'Ajouter un critère',
    'tenders.ai_score':     'Score IA',
    'tenders.start_workflow': 'Lancer le workflow',
    'tenders.pdf_file':     'Fichier PDF',
    'tenders.drag_pdf':     'Glissez un PDF ici',
    'tenders.choose_file':  'Choisir un fichier',

    // ── LinkedIn extras ───────────────────────────────────────────────────────
    'linkedin.topic':       'Sujet du post',
    'linkedin.persona':     'Persona cible',
    'linkedin.length':      'Longueur',
    'linkedin.short':       'Court',
    'linkedin.medium':      'Moyen',
    'linkedin.long':        'Long',
    'linkedin.generated':   'Post généré',
    'linkedin.copy':        'Copier le post',
    'linkedin.oauth_connect': 'Se connecter à LinkedIn',

    // ── Ops extras ────────────────────────────────────────────────────────────
    'ops.active_agents':    'Agents actifs',
    'ops.pending_actions':  'Actions en attente',
    'ops.last_run':         'Dernière exécution',
    'ops.next_run':         'Prochaine exécution',

    // ── Profile extras ────────────────────────────────────────────────────────
    'profile.personal_info': 'Informations personnelles',
    'profile.expertise':    'Expertise',
    'profile.experience':   'Expérience (années)',
    'profile.location':     'Localisation',
    'profile.sectors':      'Secteurs préférés',
    'profile.security':     'Sécurité du compte',

    // ── Team extras ──────────────────────────────────────────────────────────
    'team.admin_role':        'Administrator',
    'team.manager_role':      'Manager',
    'team.consultant_role':   'Consultant',
    'team.viewer_role':       'Viewer',
    'team.user_email':        'User email',
    'team.change_role_of':    'Change role of',
    'team.confirm_deactivate': 'Confirm deactivation',
    'team.email_invite':      'Email invitation',
    'team.toggle_active':     'Activate / Deactivate',

    // ── Invoicing extras ─────────────────────────────────────────────────────
    'invoicing.client_quote': 'Client quote',
    'invoicing.quote_title':  'Quote title',
    'invoicing.client_email': 'Client email',
    'invoicing.company_name': 'Company name',
    'invoicing.net_30':       'Net 30 days',
    'invoicing.immediate':    'Immediate',
    'invoicing.net_60':       'Net 60 days',
    'invoicing.ht':           'Ex VAT',
    'invoicing.ttc':          'Inc VAT',
    'invoicing.no_quotes':    'No quotes',
    'invoicing.no_invoices':  'No invoices',

    // ── Deliverables extras ──────────────────────────────────────────────────
    'deliverables.library':   'Deliverables library',
    'deliverables.governed':  'Governed Deliverables',
    'deliverables.subtitle':  'Technical memos, commercial proposals, scoping notes',
    'deliverables.new':       'New deliverable',
    'deliverables.title_label': 'Deliverable title',
    'deliverables.type_memo': 'Technical memo',
    'deliverables.type_proposal': 'Commercial proposal',
    'deliverables.type_note': 'Scoping note',
    'deliverables.all_types': 'All types',
    'deliverables.drafts':    'Drafts',
    'deliverables.in_review': 'In review',
    'deliverables.files':     'Files',
    'deliverables.empty':     'No deliverables',
    'deliverables.generate_ai': 'Generate AI',

    // ── Common extras ─────────────────────────────────────────────────────────
    'common.confirm':   'Confirm',
    'common.close':     'Close',
    'common.view':      'View',
    'common.export':    'Export',
    'common.download':  'Download',
    'common.add':       'Add',
    'common.update':    'Update',
    'common.yes':       'Yes',
    'common.no':        'No',
    'common.status':    'Status',

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
