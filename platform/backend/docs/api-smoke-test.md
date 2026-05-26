# API Smoke Test

## Objectif

Verifier rapidement que le parcours metier principal fonctionne :

```text
Auth token valide
Organisation
Opportunite
Appel d offres
Exigence
Template Go / No-Go
Generation conformite
Resumes de gouvernance
```

## Prerequis

1. Demarrer la plateforme :

```bash
docker compose up --build
```

2. Creer un utilisateur admin si necessaire via Swagger :

```text
http://localhost:8000/docs
```

3. Recuperer un token JWT via :

```text
POST /api/v1/auth/login
```

## Execution

Depuis la racine du projet :

```bash
export API_BASE_URL="http://localhost:8000/api/v1"
export API_TOKEN="coller-le-token-jwt-ici"
python platform/backend/scripts/smoke_test_api.py
```

## Resultat attendu

Le script doit afficher :

```text
SMOKE TEST PASSED
```

## Notes

- Le script ne cree pas le compte admin.
- Il utilise uniquement un token fourni par variable d environnement.
- Il cree des donnees de test horodatees.
- Il ne supprime pas les donnees apres execution afin de permettre l inspection dans la base.
