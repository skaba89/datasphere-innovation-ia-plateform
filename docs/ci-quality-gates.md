# CI Quality Gates

## Objectif

Garantir que chaque Pull Request conserve un socle minimum de qualite avant merge dans `main`.

La plateforme commence a contenir plusieurs composants critiques :

- backend FastAPI ;
- authentification JWT ;
- frontend React / Vite ;
- Docker Compose ;
- PostgreSQL ;
- modules CRM et appels d offres.

Sans controle automatique, une evolution peut casser silencieusement l authentification, le build frontend ou la configuration Docker.

## Workflow GitHub Actions

Le workflow se trouve dans :

```text
.github/workflows/ci.yml
```

Il s execute sur :

- chaque Pull Request vers `main` ;
- chaque push sur `main`.

## Jobs

### Backend checks

Verifications :

- installation des dependances Python ;
- compilation des sources Python ;
- import de l application FastAPI.

### Frontend checks

Verifications :

- installation des dependances Node.js ;
- build frontend Vite / TypeScript.

### Docker Compose validation

Verifications :

- generation d un `.env` depuis `.env.example` ;
- validation de la configuration Docker Compose avec `docker compose config`.

## Ce que la CI ne couvre pas encore

La premiere version de la CI ne couvre pas encore :

- tests unitaires backend ;
- tests unitaires frontend ;
- tests end-to-end navigateur ;
- execution complete Docker Compose avec healthchecks ;
- scan de securite ;
- analyse de qualite type ruff, mypy, eslint strict.

Ces controles seront ajoutes progressivement.

## Regle projet

A terme, aucune PR importante ne doit etre mergee si la CI echoue.
