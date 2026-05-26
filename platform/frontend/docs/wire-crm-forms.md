# CRM Forms Wiring

## Objectif

Connecter les formulaires CRM au backend securise.

## Composants ajoutes

- `CrmWorkspace.tsx` : charge les organisations et opportunites, gere les appels POST et rafraichit les listes.
- `AppConnected.tsx` : shell applicatif connecte avec login, navigation et espace CRM.

## Etape manuelle si necessaire

Si le fichier `main.tsx` n est pas encore branche sur `AppConnected`, remplacer :

```tsx
import App from './App';
```

par :

```tsx
import AppConnected from './AppConnected';
```

Puis remplacer :

```tsx
<App />
```

par :

```tsx
<AppConnected />
```

## Fonctionnalites attendues

- Connexion utilisateur.
- Chargement organisations.
- Creation organisation.
- Chargement opportunites.
- Creation opportunite.
- Rafraichissement automatique des listes.
- Messages de succes et erreurs.
