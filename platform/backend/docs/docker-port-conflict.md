# Docker Port Conflict Fix

## Probleme

Docker peut echouer au demarrage avec :

```text
Bind for 0.0.0.0:5432 failed: port is already allocated
```

Cela signifie que le port PostgreSQL local `5432` est deja utilise par un autre service ou conteneur.

## Correction appliquee

Le port hote PostgreSQL est maintenant configurable :

```yaml
ports:
  - "${POSTGRES_HOST_PORT:-5433}:5432"
```

Par defaut, PostgreSQL est expose sur le port local :

```text
5433
```

Le backend continue d utiliser le port interne Docker :

```text
postgres:5432
```

Donc `DATABASE_URL` ne change pas.

## Demarrage

```bash
cp .env.example .env
docker compose down
docker compose up --build
```

## Connexion PostgreSQL depuis le PC

Depuis un outil comme DBeaver ou pgAdmin :

```text
Host: localhost
Port: 5433
Database: datasphere_platform
User: datasphere
Password: change-me
```

## Changer le port si besoin

Dans `.env` :

```env
POSTGRES_HOST_PORT=5434
```
