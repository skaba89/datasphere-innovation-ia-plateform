# Frontend - Operations des profils consultants

## Objectif

Cette brique transforme l ecran Profils consultants en espace operationnel.

L utilisateur peut :

- installer les profils standards ;
- choisir un profil consultant ;
- l affecter a une opportunite ou a un appel d offres ;
- planifier les actions recommandees ;
- approuver les actions sensibles ;
- lancer les actions gouvernees ;
- suivre le statut et les resultats.

## Parcours utilisateur

1. Ouvrir `Profils consultants`.
2. Cliquer sur `Installer les profils standards` si aucun profil n existe.
3. Selectionner un profil.
4. Choisir une cible : opportunite ou appel d offres.
5. Renseigner l objectif et le livrable attendu.
6. Creer l affectation.
7. Planifier les actions.
8. Approuver les actions sensibles.
9. Lancer les actions.

## Gouvernance

Les actions sensibles ne doivent pas etre executees sans validation humaine.

Le frontend respecte le workflow backend :

```text
Affectation -> Planification -> Approbation -> Execution controlee
```
