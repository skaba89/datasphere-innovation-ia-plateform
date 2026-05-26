# Frontend Auth CRM

## Objectif

Ajouter une premiere interface utilisateur connectee au backend securise.

## Fonctionnalites

- Ecran de connexion.
- Stockage local du token JWT.
- Recuperation du profil courant via `/auth/me`.
- Liste des organisations.
- Liste des opportunites.
- Dashboard simple avec compteurs.
- Deconnexion.

## Flux de test

1. Demarrer la plateforme :

```bash
docker compose up --build
```

2. Creer le premier admin via Swagger ou curl :

```text
POST /api/v1/auth/bootstrap-admin
```

3. Ouvrir le frontend :

```text
http://localhost:5173
```

4. Se connecter avec le compte admin.

5. Verifier que les onglets Organisations et Opportunites se chargent.

## Limites actuelles

- Les listes sont en lecture seule.
- La creation depuis le frontend viendra dans une prochaine iteration.
- Le token est stocke dans localStorage pour le MVP interne.
- Une strategie plus avancee pourra etre ajoutee plus tard.
