# CRM Create Forms

## Objectif

Preparer les composants frontend de creation CRM pour rendre le MVP progressivement utilisable.

## Composants ajoutes

- `OrganizationForm` : formulaire de creation d une organisation.
- `OrganizationsList` : liste des organisations.
- `OpportunityForm` : formulaire de creation d une opportunite.
- `OpportunitiesList` : liste des opportunites.

## Strategie

Les composants sont ajoutes separement pour eviter de modifier un gros fichier `App.tsx` en une seule fois.

La prochaine PR connectera ces composants dans `App.tsx` avec :

- etat des formulaires ;
- appels POST authentifies ;
- rafraichissement automatique des listes ;
- messages de succes ;
- gestion des erreurs.
