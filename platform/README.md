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

## Authentification MVP

Le MVP inclut une authentification simple par email, mot de passe hashe et JWT.

### Creation du premier administrateur

La route suivante permet de creer le premier administrateur uniquement si aucun utilisateur n existe encore :

```text
POST /api/v1/auth/bootstrap-admin
```

Exemple de payload :

```json
{
  "email": "admin@example.com",
  "password": "change-me-now",
  "first_name": "Admin",
  "last_name": "DataSphere",
  "role": "admin",
  "is_active": true
}
```

Apres creation du premier utilisateur, cette route est automatiquement bloquee.

### Connexion

```text
POST /api/v1/auth/login
```

### Profil courant

```text
GET /api/v1/auth/me
```

Cette route attend un token JWT dans l en-tete Authorization.

## Regles

- Ne jamais commiter le fichier `.env`.
- Ne jamais commiter de secrets.
- Modifier `SECRET_KEY` en local et en production.
- Ajouter les modules progressivement.
- Conserver une validation humaine sur les sorties IA.
