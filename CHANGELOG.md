# Changelog

All notable changes to DataSphere Innovation IA Platform.

Format: [Semantic Versioning](https://semver.org)

---

## [1.9.0] — 2026-06

### Added
- **BOAMP API réelle** : intégration avec l'API officielle BOAMP (marchés publics France) — données en temps réel, zéro clé API requise
- **Stripe Billing** : plans free/starter(29€)/pro(79€)/enterprise, checkout session, customer portal, webhooks, quota enforcement
- **Calculateur de rentabilité** : simulation temps réel TJM × jours − charges, alertes intelligentes, comparaison scénarios
- **PDF AO → Import automatique** : upload PDF → extraction PyMuPDF → création Tender + Requirements en 1 clic
- **Email séquences branded** : 10 templates HTML DataSphere (welcome, relance J+3/J+7/J+14, approvals, invites)
- **Tracking pixel** : suivi d'ouverture des emails (1×1 GIF)
- **OnboardingWizard** : wizard 4 étapes à la première connexion
- **PricingPage** : page plans & tarifs avec toggle mensuel/annuel
- **CalculatorPage** : simulateur rentabilité interactif avec presets par rôle
- **DataExportPage** : export multi-dataset CSV/JSON
- **`/analytics/performance`** : métriques growth, agents, funnel, tendance hebdo
- **`/billing/*`** : 7 endpoints Stripe (plans, subscription, checkout, portal, webhook, mock-upgrade, quota)
- **`/calculator/*`** : presets, simulate, scenarios
- **`/pdf-ao/*`** : analyze, analyze-and-create, supported-formats
- **`/email/*`** : send, preview, sequences/plan, types, track
- **`/tender-watch/sources`** : liste des sources de veille
- **Migration Alembic** : tables `subscriptions` + `billing_events`
- **Seed démo** : `python scripts/seed_demo.py` — 3 users, 6 orgs, 5 opps, 3 tenders
- **ConfirmModal** : modal réutilisable pour actions destructives (3 variants)
- **RBAC fix** : `viewer` backend → `reader` frontend via alias map
- **TenderPDFUpload** : composant drag & drop avec prévisualisation extraction
- **Emails automatiques** : invitation équipe + approbation livrable (fire-and-forget)

### Changed
- Dashboard enrichi avec 5 KPIs `/analytics/performance` (taux approbation, Go rate, exécution IA…)
- TenderPage : bouton "Importer depuis PDF" dans le header
- TenderAutoImportPanel : filtre source BOAMP / local / all
- Navigation responsive : ☰ mobile, scroll tablette, pills desktop
- Toutes les grilles → `auto-fit minmax` (plus de `repeat(N, 1fr)` fixes)
- Padding pages → `clamp()` adaptatif

### Fixed
- `window.confirm()` remplacé par `ConfirmModal` dans ContactsPanel, DeliverablePanel, WorkspacesPage
- CORS `cors_origin_list` indestructible en dev (localhost toujours inclus)
- `playwright` → `npx playwright` + `cross-env` pour Windows
- `AppConnected.tsx` double useEffect authEvents correctement typé

---

## [1.8.0] — 2026-06

### Added
- **Hardening complet** : audit RBAC route par route, toutes les routes protégées
- **`/team/roles`** : désormais protégé par authentification
- **status_code=201** sur tous les endpoints POST de création
- **jinja2** ajouté aux dépendances (utilisé par email_preview_service)
- **HEALTHCHECK Docker** sur le Dockerfile backend
- **ErrorBoundary React** globale dans main.tsx
- **ErrorBanner, LoadingSpinner, EmptyState** composants partagés
- **GanttChart, DeliverableVersionsPanel** : error states ajoutés
- **tests/test_rbac.py** : 12 tests RBAC (unauthenticated, viewer, admin)
- **tests/test_api_hardening.py** : 30 tests de hardening endpoints critiques
- **CONTRIBUTING.md** : guide de contribution complet
- **SECURITY.md** : politique de sécurité et vulnérabilités
- **README.md** : documentation complète reécrite (architecture, config, deploy)

### Fixed
- **ActivityFeed** : ajout catch + error state
- **GanttChart** : ajout catch + error state
- **DeliverableVersionsPanel** : ajout catch + error state
- **ConsultantProfilesPage** : réécrit pour corriger corruption fichier
- **WorkspacesPage** : JSX.Element → React.ReactNode

### Changed
- `list_organizations()` filtre `validation_status != "pending"` par défaut
- `list_opportunities()` filtre `validation_status != "pending"` par défaut
- `list_tenders()` filtre `validation_status != "pending"` par défaut

## [1.7.0] — 2026-05

### Added
- AI Suggestions : BOAMP scraper + validation humaine batch
- LLM Providers Panel UI (11 providers, chaîne de fallback)
- UserProfilePage (changer mdp, infos compte)
- CRM exports CSV (contacts + opportunités)
- Playwright E2E (18 tests)
- Workspaces multi-tenant (fondations Phase 1)
- getUserName() partagé depuis api/userContext.ts
- CV Generator 2 étapes (DOCX professionnel)
- Dashboard enrichi (suggestions IA pending)

## [1.6.0] — 2026-04

### Added
- JWT Refresh token silencieux (30 jours)
- Forgot/Reset password flow complet
- FileAttachments composant (upload inline AO + livrables)
- SSE notifications temps réel
- Backup DB automatique (ops/backup.sh + service Docker)
- AuditLogPage navigable (filtres, pagination, export CSV)

## [1.5.0] — 2026-03

### Added
- 11 providers LLM avec chaîne de fallback coût-first
- Endpoint `/providers` avec recommandations par tâche
- Contact form → email réel (SMTP)
- Upload fichiers (PDF, DOCX, etc. — 20 MB max)

## [1.4.0] — 2026-02

### Added
- Platform prod-ready (Alembic 19 tables, rate limiting, Docker prod)
- CI GitHub Actions complet
- Surveillance santé (HealthMonitorPanel)

---

*Pour les versions antérieures, voir l'historique Git.*
