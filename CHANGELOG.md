# Changelog — DataSphere Innovation IA Platform

Toutes les modifications notables de ce projet sont documentées ici.
Format : [MAJOR.MINOR.PATCH] — YYYY-MM-DD

---

## [2.3.0] — 2026-06-13 (Sprint 9)

### Ajouté
- **Tests Sprint 8** : 30 nouveaux tests (cache_service, CSV exports, profile API)
- **DataExportPage** : boutons CSV rapides (tenders, livrables, contacts, opportunités, audit)
- **E2E Sprint 7-8** : `sprint-7-8-features.spec.ts` (15 specs : PDF, BOAMP, profile, CSV, cache)
- **render.yaml** : BOAMP_KEYWORDS, BOAMP_SCORE_THRESHOLD, BOAMP_DAILY_LIMIT
- **Alembic** : migration `user_extra_data_001` (colonne extra_data TEXT sur users)

### Corrigé
- Route `/team/me` capturée par `/{user_id}` → routes statiques déplacées avant dynamiques
- Route `/deliverables/templates` capturée par `/{deliverable_id}` (corrigé Sprint 5)
- Import `datetime` manquant dans CSV export endpoints
- Import `Text` manquant dans user.py

---

## [2.2.0] — 2026-06-13 (Sprint 8)

### Ajouté
- **Cache in-memory** : `cache_service.py` TTL-based, thread-safe, sans Redis
  - Dashboard KPIs cachés 60s, invalidation automatique sur CREATE
- **User Profile API** : GET + PATCH `/team/me` (bio, TJM, compétences, disponibilité)
- **BOAMP Config UI** : onglet BOAMP dans OperationsPage (sliders, test live)
- **CSV bulk exports** : `/export/excel/tenders/csv` + `/deliverables/csv`
- **Error boundary** : wrapping du contenu principal dans AppRoot
- **UserProfilePage enrichie** : champs bio/skills/TJM/availability avec save

### Corrigé
- `selectinload` import cassé dans `tender.py` (lambda tuple)
- `datetime` import dans `excel_export.py` nouvelles fonctions

---

## [2.1.0] — 2026-06-13 (Sprints 6 & 7)

### Ajouté
- **Dashboard enrichi** : Top 5 AOs urgents + livrables récents (données réelles DB)
- **Page Notifications** : centre complet (filtres, marquer lu, SSE temps réel)
- **Page Recherche** : résultats groupés par entité, historique localStorage
- **Webhooks templates** : 5 templates Zapier/Make/Slack/Teams/Notion
- **PDF Export WeasyPrint** : livrable → PDF professionnel (cover page, styles, footer)
- **BOAMP configurable** : BOAMP_KEYWORDS, BOAMP_SCORE_THRESHOLD, BOAMP_DAILY_LIMIT
- **Rate limit par user** : JWT sub comme clé (300/min), fallback IP

---

## [2.0.0] — 2026-06-13 (Sprints 1-5)

### Ajouté
- **Sprint 1** : Sentry, pagination universelle, 5 templates livrables, rapport hebdo, BOAMP actif
- **Sprint 2** : RAG sur livrables passés, export DOCX, mobile responsive, SSE workflow
- **Sprint 3** : Multi-tenant DB-level, onboarding wizard 5 étapes, LinkedIn OAuth2, SSE toasts
- **Sprint 4** : CI/CD fix, E2E Sprint 2-3, Onboarding API, 22 index DB, N+1 fixes
- **Sprint 5** : 47 tests services, fix routes statiques, CLI admin, README v2.0

### Métriques v2.0
- 235 routes API, 1342 tests, 14 E2E specs, 10 migrations Alembic, 22 index DB

---

## [1.9.0] — 2026-06-12 (avant Sprint 1)

### État initial
- 224 routes API, 1295 tests, Gunicorn, Docker multi-stage, Render Blueprint
- JWT + bcrypt + CORS + rate limiting (IP global)
- i18n FR/EN (120 clés, toggle header)
- 17 pages React, bundle 210 kB (–65%)
- BOAMP scanner, rapport hebdo, agents IA installables
- LinkedIn Agent, CV Agent (4 domaines)
- Workflow 8 étapes, 5 agents par défaut
- Multi-tenant workspaces (partiel)
