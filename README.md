# DataSphere Innovation IA Platform

> **Cabinet de conseil augmenté par IA** — Missions Data, IT, IA et réponse aux appels d'offres  
> France & Afrique francophone

[![CI Quality Gates](https://github.com/skaba89/datasphere-innovation-ia-plateform/actions/workflows/ci.yml/badge.svg)](https://github.com/skaba89/datasphere-innovation-ia-plateform/actions)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)
[![Tests](https://img.shields.io/badge/Tests-176%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/Version-1.6.0-yellow)]()

---

## Démarrage en 30 secondes

```bash
git clone git@github.com:skaba89/datasphere-innovation-ia-plateform.git
cd datasphere-innovation-ia-plateform
cp .env.example .env          # Éditer SECRET_KEY et POSTGRES_PASSWORD
docker compose up --build     # Démarre tout

# Créer l'admin (une seule fois)
curl -X POST http://localhost:8000/api/v1/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@datasphere-innovation.net","password":"Admin123456!","first_name":"Admin","last_name":"DataSphere","role":"admin","is_active":true}'

open http://localhost:5173     # Interface web
open http://localhost:8000/docs # Swagger API
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DataSphere IA Platform                    │
├──────────────────┬──────────────────┬───────────────────────┤
│   React 18       │   FastAPI 0.115  │   PostgreSQL 16       │
│   TypeScript     │   SQLAlchemy 2   │   Alembic migrations  │
│   Vite           │   APScheduler    │                       │
│   353 kB bundle  │   + LLM service  │                       │
└──────────────────┴──────────────────┴───────────────────────┘
                          │
        ┌─────────────────┴──────────────────┐
        │      LLM Provider Chain            │
        │  Anthropic → OpenAI → Simulation   │
        └────────────────────────────────────┘
```

---

## Fonctionnalités

### 🎯 Pipeline commercial
- CRM Organisations & Opportunités
- **Kanban pipeline** 8 colonnes — déplacement par clic
- Contacts CRM par organisation
- Dashboard KPIs (pipeline value pondérée, taux conversion)

### 📋 Appels d'offres
- Création AO, exigences, matrice de conformité
- **Go/No-Go IA** avec confiance, risques et opportunités
- Scoring pondéré multi-critères + **Radar chart**
- Templates sectoriels (Télécom, Finance, Public, Énergie, IT)

### 🤖 Agents autonomes
- 5 profils consultants (Data Architect, Expert AO, Gouvernance…)
- Affectations avec objectifs et livrables attendus
- **Scheduler APScheduler** 4 jobs (execute / plan / draft / report)
- **Gouvernance humaine** : actions sensibles bloquées sans approbation

### 📄 Livrables
- 7 types de documents (mémoire technique, note de cadrage, offre…)
- Génération de brouillon IA depuis le contexte mission
- **Versioning** avec snapshots, diff ligne par ligne, restauration
- Workflow Draft → In Review → Approved
- Export Markdown / HTML imprimable (PDF)
- **Email client** généré automatiquement

### 📊 Analytics & Export
- Dashboard pipeline temps réel
- **Gantt** des missions avec actions colorées
- 5 exports Excel (pipeline, AO, actions, livrables, rapport complet)
- **Rapport de mission** HTML/PDF complet par AO
- Activity feed avec journal unifié

### 👥 Équipe & Sécurité
- Multi-utilisateurs (admin / manager / consultant / viewer)
- **Notifications persistantes** in-app (mark read, TTL, priorité)
- Recherche globale ⌘K (6 entités)
- Audit logs complets
- Rate limiting sur l'API (slowapi)
- Security headers (CSP, HSTS, X-Frame…)

### ⚙ Opérations
- Santé système (DB, Scheduler, LLM, SMTP)
- Logs scheduler + historique exécutions
- Approbations en attente avec validation 1-clic

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | FastAPI 0.115, SQLAlchemy 2.0, Pydantic v2 |
| Auth | JWT (python-jose), bcrypt |
| Base de données | PostgreSQL 16, Alembic migrations |
| Scheduler | APScheduler 3.10 |
| LLM | Anthropic / OpenAI / OpenRouter / Mistral / Simulation |
| Export | openpyxl (Excel), HTML print-ready (PDF natif) |
| Frontend | React 18, TypeScript, Vite, Lucide icons |
| CI/CD | GitHub Actions |
| Dev | Docker Compose |
| Prod | Gunicorn + Uvicorn, Nginx reverse proxy |

---

## Structure du projet

```
datasphere-innovation-ia-plateform/
├── platform/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/v1/endpoints/   # 22 routers REST
│   │   │   ├── core/               # Config, sécurité
│   │   │   ├── crud/               # 16 modules CRUD
│   │   │   ├── models/             # 19 tables SQLAlchemy
│   │   │   ├── schemas/            # Pydantic schemas
│   │   │   └── services/           # LLM, scheduler, exports
│   │   ├── alembic/                # Migrations DB
│   │   ├── tests/                  # 176 tests pytest
│   │   ├── Dockerfile              # Dev
│   │   └── Dockerfile.prod         # Production (Gunicorn)
│   └── frontend/
│       ├── src/
│       │   ├── pages/              # 8 pages
│       │   ├── components/         # 20+ composants
│       │   └── api/                # Client HTTP + types
│       ├── Dockerfile.prod         # Multi-stage Nginx
│       └── nginx.spa.conf
├── ops/
│   ├── nginx/nginx.prod.conf       # Reverse proxy prod
│   └── deploy.sh                   # Script de déploiement
├── docker-compose.yml              # Développement
├── docker-compose.prod.yml         # Production
├── .env.example                    # Variables dev
└── .env.prod.example               # Variables prod
```

---

## Tests

```bash
cd platform/backend
pytest -q                    # Suite complète (176 tests, ~2 min)
pytest tests/test_crm.py     # Module spécifique
pytest --cov=app -q          # Avec couverture
```

Tests organisés par module : `test_auth`, `test_crm`, `test_tenders`, `test_agents`, `test_deliverables`, `test_scheduler`, `test_analytics`, `test_exports`, `test_commercial`, `test_platform`, `test_advanced`.

---

## Déploiement production

```bash
cp .env.prod.example .env.prod
# Remplir SECRET_KEY, POSTGRES_PASSWORD, ANTHROPIC_API_KEY...

./ops/deploy.sh              # Pre-flight + tests + build + migrate
# ou step by step:
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Migrations Alembic

```bash
# Appliquer
alembic upgrade head

# Rollback
alembic downgrade -1

# Créer une migration
python scripts/migrate.py create "add_column_x_to_y"

# Vérifier (CI)
python scripts/migrate.py check
```

---

## Gouvernance IA

> **Règle fondamentale** : Les agents IA proposent et exécutent les actions routinières. Toute action marquée `requires_human_approval=True` est **bloquée** jusqu'à validation explicite via `POST /api/v1/agent-actions/{id}/approve`.

```
auto_ready → exécuté automatiquement par le scheduler
approved   → exécuté après validation humaine
```

Le scheduler ne contourne jamais cette règle. Audit trail sur chaque décision.

---

## Equipe

**Co-fondateur & Lead Data Architect** : Sekouna KABA (Cheickna)  
Expertise : Snowflake, dbt, Apache Airflow, PySpark, AWS/GCP/Azure  
Spécialité : Architecture Lakehouse, missions Data Afrique francophone

---

## Licence

Propriété de DataSphere Innovation. Utilisation privée uniquement.
