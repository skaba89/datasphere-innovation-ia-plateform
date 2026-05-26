# Frontend Tender Screens

## Objectif

Ajouter les premiers ecrans frontend pour exploiter le module Appels d offres.

## Fichiers ajoutes

```text
platform/frontend/src/components/TenderWorkspace.tsx
```

## Fichiers modifies

```text
platform/frontend/src/api/domainTypes.ts
```

## Fonctionnalites du composant TenderWorkspace

- Chargement des opportunites existantes.
- Creation d un appel d offres rattache a une opportunite.
- Liste des appels d offres.
- Selection d un appel d offres.
- Creation d exigences.
- Affichage des exigences.
- Creation de criteres Go / No-Go.
- Affichage du score Go / No-Go calcule par le backend.
- Creation de lignes de matrice de conformite.
- Affichage du taux de conformite calcule par le backend.

## Cablage manuel si necessaire

Dans `platform/frontend/src/AppConnected.tsx`, ajouter :

```tsx
import { TenderWorkspace } from './components/TenderWorkspace';
```

Changer le type `View` :

```tsx
type View = 'dashboard' | 'organizations' | 'opportunities' | 'tenders';
```

Ajouter un bouton dans la navigation :

```tsx
<button className={view === 'tenders' ? 'active' : ''} onClick={() => setView('tenders')} type="button">
  Appels d offres
</button>
```

Remplacer le rendu CRM final par :

```tsx
{view === 'tenders' ? <TenderWorkspace token={accessKey} /> : <CrmWorkspace token={accessKey} view={view} />}
```

## Test attendu

1. Demarrer la plateforme.
2. Se connecter.
3. Creer au moins une organisation.
4. Creer au moins une opportunite.
5. Ouvrir Appels d offres.
6. Creer un appel d offres rattache a l opportunite.
7. Ajouter une exigence.
8. Ajouter un critere Go / No-Go.
9. Ajouter une ligne de conformite.
10. Verifier les scores affiches.

## Note

La modification directe de `AppConnected.tsx` peut etre appliquee dans une petite PR separee si le controle automatique bloque encore la mise a jour complete du fichier.
