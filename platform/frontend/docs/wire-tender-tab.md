# Wire Tender Tab

## Objectif

Rendre le module Appels d offres accessible depuis l interface principale.

## Fichier deja ajoute

```text
platform/frontend/src/pages/TenderPage.tsx
```

Cette page utilise le token stocke localement et affiche `TenderWorkspace`.

## Option recommandee

Modifier `platform/frontend/src/AppConnected.tsx` :

1. Importer le workspace :

```tsx
import { TenderWorkspace } from './components/TenderWorkspace';
```

2. Etendre le type de vue :

```tsx
type View = 'dashboard' | 'organizations' | 'opportunities' | 'tenders';
```

3. Ajouter le bouton dans les tabs :

```tsx
<button className={view === 'tenders' ? 'active' : ''} onClick={() => setView('tenders')} type="button">
  Appels d offres
</button>
```

4. Remplacer le rendu final :

```tsx
<CrmWorkspace token={accessKey} view={view} />
```

par :

```tsx
{view === 'tenders' ? <TenderWorkspace token={accessKey} /> : <CrmWorkspace token={accessKey} view={view} />}
```

## Alternative simple

Créer une route frontend plus tard vers `TenderPage` si React Router est ajoute.

## Test attendu

1. Se connecter.
2. Ouvrir l onglet Appels d offres.
3. Creer une organisation et une opportunite si besoin.
4. Creer un appel d offres.
5. Ajouter une exigence.
6. Ajouter un critere Go / No-Go.
7. Ajouter une ligne de conformite.
8. Verifier les scores et taux affiches.
