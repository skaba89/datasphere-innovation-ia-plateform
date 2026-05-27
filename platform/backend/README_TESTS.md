# Backend API Tests

## Objectif

Ces tests securisent les premiers endpoints critiques du MVP :

- authentification ;
- creation du premier administrateur ;
- connexion JWT ;
- profil utilisateur courant ;
- organisations ;
- opportunites ;
- appels d offres ;
- exigences d appels d offres.

## Lancement local

Depuis le dossier `platform/backend` :

```bash
pytest -q
```

## Couverture actuelle

### Auth

- creation du premier admin ;
- blocage du bootstrap apres creation du premier utilisateur ;
- login valide ;
- rejet du mauvais mot de passe ;
- rejet d un token invalide ;
- recuperation du profil courant.

### Organisations

- acces refuse sans authentification ;
- creation ;
- lecture liste ;
- lecture detail ;
- modification ;
- suppression.

### Opportunites

- acces refuse sans authentification ;
- creation liee a une organisation ;
- lecture liste ;
- lecture detail ;
- modification ;
- suppression ;
- rejet si organisation inexistante.

### Appels d offres

- acces refuse sans authentification ;
- creation liee a une opportunite ;
- lecture liste ;
- lecture detail ;
- modification ;
- suppression ;
- rejet si opportunite inexistante.

### Exigences d appels d offres

- creation d exigence liee a un appel d offres ;
- lecture des exigences d un appel d offres ;
- modification d une exigence ;
- suppression d une exigence ;
- rejet si l identifiant de l appel d offres ne correspond pas entre l URL et le payload.

## Base de test

Les tests utilisent SQLite pour rester rapides en CI.

A terme, des tests d integration PostgreSQL pourront etre ajoutes avec un service `postgres` dans GitHub Actions.
