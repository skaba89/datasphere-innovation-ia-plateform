# DataSphere Innovation IA Platform

> Cabinet de conseil Data & IA augmenté par intelligence artificielle — France & Afrique Francophone

[![CI Quality Gates](https://github.com/skaba89/datasphere-innovation-ia-plateform/actions/workflows/ci.yml/badge.svg)](https://github.com/skaba89/datasphere-innovation-ia-plateform/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/skaba89/datasphere-innovation-ia-plateform)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](LICENSE)

---

## 🎯 Pitch

DataSphere Innovation IA Platform automatise la réponse aux appels d'offres data :
**détection BOAMP → Go/No-Go IA → mémoire technique → livrable Word/PDF**
Le tout en 8 étapes, avec validation humaine aux points clés.

## ✨ Fonctionnalités principales

| Feature | Détail |
|---|---|
| **Workflow IA 8 étapes** | Analyse → Go/No-Go → Exigences → Conformité → Staffing → Plan → Génération → Revue |
| **5 Agents IA** | Data Architect, Expert AO, Gouvernance, Business Analyst, Documentation |
| **RAG** | Les livrables approuvés améliorent les suivants (TF-IDF → pgvector) |
| **5 Templates** | Mémoire Technique, Proposition Commerciale, Note de Synthèse, Plan Projet, Présentation |
| **Export** | Markdown · HTML · PDF (WeasyPrint) · **Word DOCX** (python-docx) |
| **BOAMP Auto** | Scan quotidien 6h → AOs data scoring → notifications email |
| **Rapport hebdo** | Email HTML lundi 8h → KPIs, deadlines 14j, provider actif |
| **LinkedIn Agent** | Génération posts data engineering + OAuth2 publication directe |
| **Agent CV** | CV consultant complet (6+ ans XP, projets alignés mission) |
| **Multi-tenant** | Isolation workspace niveau DB (X-Workspace-ID header) |
| **i18n** | FR / EN — 120 clés, toggle dans le header |
| **Mobile** | Bottom nav, grilles adaptatives, touch targets 44px |
| **SSE temps réel** | Workflow events → toasts instantanés (plus de polling) |
| **Onboarding** | Wizard 5 étapes, état synchronisé depuis `/setup/onboarding-status` |

---

## 🏗️ Stack technique

```
Backend  : FastAPI 0.115 + SQLAlchemy 2.0 + PostgreSQL 16 + Alembic
Frontend : React 18 + TypeScript + Vite 6 + 10 chunks (bundle 210 kB)
IA       : Groq (Llama 3.3 70B) · Gemini · OpenAI · Mistral · OpenRouter
Infra    : Docker multi-stage · Gunicorn 2 workers · Render Blueprint
Tests    : 1 342 tests pytest · 14 E2E specs Playwright · CI GitHub Actions
```

---

## 🚀 Démarrage rapide

### Développement local

```bash
# 1. Cloner
git clone https://github.com/skaba89/datasphere-innovation-ia-plateform.git
cd datasphere-innovation-ia-plateform

# 2. Variables d'environnement
cp .env.example .env
# Editer .env : DATABASE_URL, SECRET_KEY, GROQ_API_KEY

# 3. Lancer (Docker Compose)
docker compose up --build

# 4. Initialiser la DB
curl http://localhost:8000/api/v1/setup/bootstrap?token=YOUR_SETUP_TOKEN

# 5. Ouvrir
open http://localhost:5173
```

### Production (Render)

1. Fork le repo sur GitHub
2. Render → New Blueprint → connecter le repo (détecte `render.yaml`)
3. Renseigner dans Render Dashboard :
   ```
   GROQ_API_KEY   = gsk_...
   GEMINI_API_KEY = AIza...
   CORS_ORIGINS   = https://datasphere-frontend-xxxx.onrender.com
   ```
4. Render déploie automatiquement backend + frontend + PostgreSQL
5. Activer `SETUP_ENABLED=true` → appeler `/api/v1/setup/bootstrap` → remettre `false`
6. Suivre `PRODUCTION_CHECKLIST.md`

---

## 📁 Structure du projet

```
datasphere-innovation-ia-plateform/
├── platform/
│   ├── backend/                    # FastAPI
│   │   ├── app/
│   │   │   ├── api/v1/endpoints/   # 235 routes
│   │   │   ├── models/             # SQLAlchemy ORM
│   │   │   ├── services/           # Logique métier IA
│   │   │   │   ├── workflow_service.py   # Workflow 8 étapes
│   │   │   │   ├── rag_service.py        # RAG TF-IDF
│   │   │   │   ├── docx_export.py        # Export Word
│   │   │   │   ├── deliverable_templates.py  # 5 templates
│   │   │   │   ├── weekly_report.py      # Rapport hebdo HTML
│   │   │   │   ├── cv_agent.py           # Agent CV
│   │   │   │   ├── linkedin_agent.py     # Agent LinkedIn
│   │   │   │   └── scheduler_service.py  # BOAMP + rapports
│   │   │   └── crud/              # Database operations
│   │   ├── alembic/               # 10 migrations
│   │   ├── tests/                 # 1 342 tests pytest
│   │   └── requirements.txt
│   └── frontend/                  # React + TypeScript
│       ├── src/
│       │   ├── pages/             # 17 pages
│       │   ├── components/        # 37 composants
│       │   ├── hooks/             # useWorkflowSSE, useRealtimeToasts
│       │   └── i18n/              # FR/EN 120 clés
│       ├── e2e/                   # 14 specs Playwright
│       └── vite.config.ts         # Code splitting 10 chunks
├── .github/workflows/
│   ├── ci.yml                     # Backend + Frontend + Docker + Security + E2E
│   └── e2e.yml                    # Playwright complet
├── render.yaml                    # Infrastructure as Code
├── docker-compose.yml             # Dev local
├── docker-compose.prod.yml        # Production
└── PRODUCTION_CHECKLIST.md        # Go-live en 10 étapes
```

---

## 🔑 Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SECRET_KEY` | ✅ | JWT signing (32 chars min) |
| `GROQ_API_KEY` | ✅ | LLM principal (gratuit) |
| `GEMINI_API_KEY` | ⚡ | LLM secondaire |
| `CORS_ORIGINS` | ✅ | URL frontend production |
| `SMTP_HOST` | 📧 | Email (Brevo, Gmail) |
| `STRIPE_SECRET_KEY` | 💳 | Billing (optionnel) |
| `SENTRY_DSN` | 📊 | Error tracking (optionnel) |
| `LINKEDIN_CLIENT_ID` | 🔗 | OAuth2 LinkedIn (optionnel) |
| `SETUP_ENABLED` | 🔒 | `false` en prod |
| `SCHEDULER_ENABLED` | ⏰ | `true` en prod (BOAMP 6h) |

---

## 🧪 Tests

```bash
# Backend (pytest)
cd platform/backend
pip install -r requirements.txt
pytest -q                          # 1 342 tests
pytest tests/test_sprint2_services.py  # Services Sprint 2

# Frontend (build)
cd platform/frontend
npm ci && npm run build

# E2E (Playwright)
cd platform/frontend
npx playwright install chromium
npx playwright test                # 14 specs
```

---

## 🛣️ API — Endpoints principaux

```
POST /auth/login                   → JWT token
GET  /health                       → Santé système

# Workflow IA
GET  /tenders                      → Liste AOs
POST /tenders/{id}/workflow/start  → Lancer le workflow
POST /tenders/{id}/workflow/steps/{key}/approve  → Valider une étape

# Livrables
GET  /deliverables/templates       → 5 templates disponibles
POST /deliverables/from-template/{key}?tender_id=N  → Créer depuis template
GET  /deliverables/{id}/export/docx    → Télécharger Word
GET  /deliverables/{id}/export/pdf     → Télécharger PDF
GET  /deliverables/similar?title=      → RAG: livrables similaires

# Agents IA
GET  /cv/domains                   → 4 domaines CV
POST /cv/generate                  → Générer CV complet
GET  /linkedin/topics              → Sujets posts LinkedIn

# Rapports
GET  /reports/weekly/preview       → Aperçu rapport hebdo HTML
POST /reports/weekly/send          → Envoyer (admin)

# Onboarding
GET  /setup/onboarding-status      → État réel depuis DB
GET  /notifications/stream         → SSE temps réel
```

Documentation Swagger complète : `/api/v1/docs`

---

## 📊 Métriques v2.0

```
Routes API    : 235     Tests unitaires  : 1 342
Pages React   : 17      E2E Playwright   : 14 specs
Composants    : 37      Migrations Alembic : 10
Bundle main   : 210 kB  Index DB         : 22 (perf001)
i18n clés     : 120     Providers LLM    : 11
```

---

## 👤 Auteur

**Cheickna KABA** — Co-Fondateur DataSphere Innovation
Senior Data Engineer / Tech Lead Data Architect
Paris, France | [LinkedIn](https://linkedin.com/in/cheickna-kaba)

---

## 📄 Licence

AGPL-3.0 — Voir [LICENSE](LICENSE)
