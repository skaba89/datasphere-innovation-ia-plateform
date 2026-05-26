# Platform MVP Foundation

## Objectif

Ce dossier contient le premier socle technique de DataSphere Innovation IA Platform.

Le MVP vise a fournir une base applicative interne pour piloter :

- CRM et opportunites ;
- appels d offres ;
- agents IA ;
- documents ;
- validation humaine ;
- gouvernance.

## Stack

- Backend : FastAPI
- Frontend : React / Vite / TypeScript
- Database : PostgreSQL
- Dev local : Docker Compose

## Demarrage local

1. Copier le fichier d environnement :

```bash
cp .env.example .env
```

2. Adapter les valeurs sensibles dans `.env`.

3. Lancer les services :

```bash
docker compose up --build
```

4. Ouvrir :

- Frontend : http://localhost:5173
- Backend API : http://localhost:8000
- Swagger : http://localhost:8000/docs
- Healthcheck : http://localhost:8000/api/v1/health

## Regles

- Ne jamais commiter le fichier `.env`.
- Ne jamais commiter de secrets.
- Ajouter les modules progressivement.
- Conserver une validation humaine sur les sorties IA.
