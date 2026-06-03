# Changelog

All notable changes to DataSphere Innovation IA Platform.

Format: [Semantic Versioning](https://semver.org)

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
