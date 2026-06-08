# DataSphere Innovation IA Platform

> **Cabinet de conseil augmenté par IA** — Missions Data, IT, IA et réponse aux appels d'offres  
> France & Afrique francophone

![Version](https://img.shields.io/badge/version-1.9.0-facc15?style=flat-square)
![Tests](https://img.shields.io/badge/tests-1010%20✅-22c55e?style=flat-square)
![Build](https://img.shields.io/badge/build-481kB-3b82f6?style=flat-square)
![Routes](https://img.shields.io/badge/routes-182-8b5cf6?style=flat-square)

[![CI](https://github.com/skaba89/datasphere-innovation-ia-plateform/actions/workflows/ci.yml/badge.svg)](https://github.com/skaba89/datasphere-innovation-ia-plateform/actions)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)
[![Tests](https://img.shields.io/badge/Tests-200%2B%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/Version-1.8.0-yellow)]()

---

## Démarrage en 5 minutes

### Prérequis
- Docker Desktop 4.x
- Git

### Lancement local (Docker)

```bash
git clone https://github.com/skaba89/datasphere-innovation-ia-plateform.git
cd datasphere-innovation-ia-plateform

# 1. Copier et configurer l'environnement
cp .env.example .env
# Éditer .env : définir SECRET_KEY et POSTGRES_PASSWORD au minimum
# ⚠️  DATABASE_URL dans .env.example utilise déjà "postgres" (service Docker)
#     NE PAS changer "postgres" en "localhost" — localhost = intérieur du container

# 2. Démarrer les services
docker compose up -d

# 3. Vérifier que le backend est up
docker compose logs backend --tail=20

# 4. Créer l'admin initial (une seule fois)
curl -X POST http://localhost:8000/api/v1/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@datasphere.fr","password":"Admin123456!","first_name":"Admin","last_name":"DataSphere","role":"admin","is_active":true}'

# 5. Ouvrir l'application
open http://localhost:5173
```

> **Docker networking** : en Docker Compose, les services communiquent par leur **nom de service**.
> Le backend joindra PostgreSQL via `postgres:5432` (nom du service), jamais `localhost:5432`.
> Le `docker-compose.yml` injecte automatiquement la bonne `DATABASE_URL` — même si votre `.env`
> local contient `localhost`, il sera surchargé par la valeur correcte.

### Lancement dev (sans Docker)

```bash
# Terminal 1 — PostgreSQL
docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_DB=datasphere_platform \
  -e POSTGRES_USER=datasphere \
  -e POSTGRES_PASSWORD=devpassword \
  postgres:16-alpine

# Terminal 2 — Backend
cd platform/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../../.env.example .env
# Modifier DATABASE_URL avec les credentials ci-dessus
python scripts/migrate.py upgrade   # Apply migrations
uvicorn app.main:app --reload

# Terminal 3 — Frontend
cd platform/frontend
npm install
npm run dev
```

---

## Architecture

```
datasphere-innovation-ia-plateform/
├── platform/
│   ├── backend/                 # FastAPI + SQLAlchemy + PostgreSQL
│   │   ├── app/
│   │   │   ├── api/v1/endpoints/  # 27 modules d'endpoints (156 routes)
│   │   │   ├── models/            # 22 tables SQLAlchemy
│   │   │   ├── schemas/           # Pydantic v2 schemas
│   │   │   ├── crud/              # Couche d'accès données
│   │   │   ├── services/          # Logique métier (LLM, CV, analytics...)
│   │   │   └── core/              # Config, security, settings
│   │   ├── alembic/versions/      # 4 migrations
│   │   ├── tests/                 # 200+ tests pytest
│   │   └── requirements.txt
│   └── frontend/                # React 18 + TypeScript + Vite
│       ├── src/
│       │   ├── pages/           # 12 pages (Dashboard, Tenders, Workspaces...)
│       │   ├── components/      # 27 composants réutilisables
│       │   └── api/             # Client API + types + userContext
│       ├── e2e/                 # 18 tests Playwright
│       └── package.json
├── ops/
│   └── backup.sh                # Script backup PostgreSQL
├── .github/workflows/ci.yml     # CI GitHub Actions
├── docker-compose.yml           # Dev
├── docker-compose.prod.yml      # Production (Gunicorn + Nginx + backup)
├── .env.example                 # Template variables d'environnement
└── .env.prod.example            # Template production
```

---

## Stack technique

| Couche | Technologie | Version |
|---|---|---|
| API | FastAPI | 0.115 |
| ORM | SQLAlchemy | 2.0 |
| Migrations | Alembic | 1.x |
| Base de données | PostgreSQL | 16 |
| Auth | JWT (python-jose) + bcrypt | — |
| Scheduler | APScheduler | 3.x |
| Frontend | React + TypeScript | 18 + 5.x |
| Build | Vite | 5.x |
| Tests backend | pytest | 8.x |
| Tests E2E | Playwright | 1.x |
| CI | GitHub Actions | — |
| Containers | Docker + Compose | — |

---

## Configuration LLM — 11 providers (coût-first)

| Tier | Provider | Coût | Clé requise |
|---|---|---|---|
| **Gratuit** | GLM-4-Flash (ZhipuAI) | 0 € | `GLM_API_KEY` |
| **Quasi-gratuit** | Groq (Llama 3.3 70B) | ~0 € | `GROQ_API_KEY` |
| **Quasi-gratuit** | Gemini Flash | ~0 € | `GEMINI_API_KEY` |
| **Budget** | Together AI | ~0.18$/M tokens | `TOGETHER_API_KEY` |
| **Budget** | Qwen Turbo | très peu cher | `QWEN_API_KEY` |
| **Standard** | OpenRouter | variable | `OPENROUTER_API_KEY` |
| **Standard** | Mistral small | ~0.2$/M tokens | `MISTRAL_API_KEY` |
| **Standard** | Cohere R | standard | `COHERE_API_KEY` |
| **Standard** | Perplexity Sonar | ~0.001$/req | `PERPLEXITY_API_KEY` |
| **Premium** | OpenAI GPT | ~1$/M tokens | `OPENAI_API_KEY` |
| **Premium** | Anthropic Claude | ~1.25$/M tokens | `ANTHROPIC_API_KEY` |

**Configuration minimale 0 €/mois** : définir `GLM_API_KEY` + `GROQ_API_KEY` + `GEMINI_API_KEY`.

---

## Endpoints API (156 routes)

Documentation interactive : `http://localhost:8000/docs` (Swagger UI)  
Documentation alternative : `http://localhost:8000/redoc`

### Groupes principaux

| Préfixe | Description | Auth |
|---|---|---|
| `/auth` | Login, refresh, reset password | Mixte |
| `/team` | Gestion équipe (admin) | ✓ Requis |
| `/organizations` | CRM — Organismes | ✓ Requis |
| `/opportunities` | CRM — Opportunités | ✓ Requis |
| `/tenders` | Appels d'offres | ✓ Requis |
| `/deliverables` | Livrables + workflow | ✓ Requis |
| `/agents` | Agents IA + affectations | ✓ Requis |
| `/agent-actions` | Actions gouvernées | ✓ Requis |
| `/analytics` | KPIs + Gantt + Dashboard | ✓ Requis |
| `/suggestions` | Suggestions IA + validation | ✓ Requis |
| `/workspaces` | Multi-tenant | ✓ Requis |
| `/uploads` | Pièces jointes | ✓ Requis |
| `/providers` | Statut LLM providers | ✓ Requis |
| `/audit-logs` | Journal d'audit | ✓ Requis |
| `/notifications` | Notifications + SSE | ✓ Requis |
| `/contact` | Formulaire contact public | Public |
| `/health` | Santé application | Public |

---

## Gouvernance IA (règle immuable)

Toute action d'agent avec `requires_human_approval=True` **ne s'exécute jamais automatiquement**.  
Elle attend une validation explicite via `POST /agent-actions/{id}/approve`.

Toute entité suggérée par l'IA (BOAMP, import texte) a `validation_status="pending"` et est **invisible dans le CRM normal** jusqu'à validation humaine via le panel "Suggestions IA".

---

## Tests

```bash
# Tests backend (unitaires + intégration)
cd platform/backend
python -m pytest tests/ -v

# Tests spécifiques
python -m pytest tests/test_rbac.py -v          # RBAC
python -m pytest tests/test_api_hardening.py -v  # Hardening
python -m pytest tests/test_auth.py -v           # Auth

# Tests E2E Playwright (frontend + backend)
cd platform/frontend
npx playwright install chromium
npm run test:e2e
```

---

## CI/CD

Le pipeline GitHub Actions vérifie à chaque PR :
1. Lint (ruff)
2. Tests backend (pytest, 200+ tests)
3. Build frontend (tsc + vite)
4. Tests E2E Playwright (sur PR vers main)

---

## Déploiement production

```bash
# Variables obligatoires en prod
cp .env.prod.example .env.prod
# Définir : SECRET_KEY, POSTGRES_PASSWORD, GLM_API_KEY, GROQ_API_KEY, GEMINI_API_KEY

# Démarrage
docker compose -f docker-compose.prod.yml up -d

# Backup quotidien automatique dans ./backups/
# Rotation : 14 jours
```

---

## Variables d'environnement requises

| Variable | Requis | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `SECRET_KEY` | ✓ | — | JWT signing key (min 32 chars) |
| `POSTGRES_PASSWORD` | ✓ | — | DB password |
| `GLM_API_KEY` | Recommandé | — | Gratuit — open.bigmodel.ai |
| `GROQ_API_KEY` | Recommandé | — | Gratuit — console.groq.com |
| `GEMINI_API_KEY` | Recommandé | — | Gratuit — aistudio.google.com |
| `SMTP_HOST` | Optionnel | — | Désactivé = mode preview uniquement |
| `SCHEDULER_ENABLED` | Non | `true` | Désactiver pour tests |
| `BOAMP_SCAN_ENABLED` | Non | `true` | Veille BOAMP quotidienne |

Voir `.env.example` pour la liste complète documentée.

---

## Sécurité

- **Auth** : JWT (access 60min + refresh 30j), bcrypt pour les passwords
- **RBAC** : 4 rôles (admin / manager / consultant / viewer), enforced sur toutes les routes
- **Rate limiting** : SlowAPI sur login (10/min) et contact (5/10min)
- **File uploads** : extension whitelist + MIME check + 20MB limit
- **CORS** : origines explicites depuis `CORS_ORIGINS` env var
- **SQL** : SQLAlchemy ORM (pas de raw SQL dans l'app)
- **Secrets** : aucun secret hardcodé (`.env` gitignorés)

---

*DataSphere Innovation — v1.8.0 — Dernière mise à jour : juin 2026*
