# Frontend Main Wire Test

## Objectif

Verifier que le point d entree frontend utilise bien `AppConnected` et donc le CRM connecte.

## Fichier modifie

```text
platform/frontend/src/main.tsx
```

Le rendu doit utiliser :

```tsx
<AppConnected />
```

## Test local

```bash
cp .env.example .env
docker compose up --build
```

## Verification

1. Ouvrir le frontend :

```text
http://localhost:5173
```

2. Verifier que l ecran de connexion apparait.

3. Creer le premier admin via Swagger si necessaire :

```text
http://localhost:8000/docs
```

Route :

```text
POST /api/v1/auth/bootstrap-admin
```

4. Se connecter.

5. Verifier les onglets :

- Dashboard
- Organisations
- Opportunites

6. Creer une organisation.

7. Creer une opportunite rattachee a cette organisation.

8. Verifier que les compteurs du dashboard changent.
