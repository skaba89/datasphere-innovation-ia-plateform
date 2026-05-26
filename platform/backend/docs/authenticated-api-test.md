# Test API authentifiee

## Objectif

Verifier que les routes metier du MVP sont protegees par JWT.

## 1. Demarrer la plateforme

```bash
cp .env.example .env
docker compose up --build
```

## 2. Creer le premier admin

Cette action fonctionne uniquement si aucun utilisateur n existe encore.

```bash
curl -X POST http://localhost:8000/api/v1/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "change-me-now",
    "first_name": "Admin",
    "last_name": "DataSphere",
    "role": "admin",
    "is_active": true
  }'
```

## 3. Se connecter

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "change-me-now"
  }'
```

Recuperer la valeur `access_token`.

## 4. Tester une route protegee sans token

```bash
curl http://localhost:8000/api/v1/organizations
```

Resultat attendu : `401 Not authenticated`.

## 5. Tester une route protegee avec token

```bash
TOKEN="coller-le-token-ici"

curl http://localhost:8000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN"
```

Resultat attendu : liste vide ou liste des organisations.

## 6. Creer une organisation avec token

```bash
curl -X POST http://localhost:8000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Institution Exemple",
    "country": "Guinee",
    "sector": "Public",
    "organization_type": "Institution publique",
    "website": "https://example.com",
    "description": "Organisation de test"
  }'
```

## Notes securite

- Changer `SECRET_KEY` en environnement reel.
- Ne jamais utiliser le mot de passe exemple en production.
- Ne jamais commiter le fichier `.env`.
