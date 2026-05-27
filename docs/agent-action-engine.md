# Moteur d actions agents

## Objectif

Permettre aux agents specialises de gerer automatiquement un plan d actions lie a une mission, une opportunite ou un appel d offres.

## Principe de gouvernance

Le modele retenu est volontairement professionnel :

```text
Agent = prepare, propose, structure, execute les actions internes autorisees
Humain = valide les actions sensibles, commerciales, contractuelles ou client
Plateforme = trace toutes les actions
```

Ce choix evite de donner une autonomie dangereuse aux agents tout en permettant un fort gain de productivite.

## Cycle de vie

1. Une affectation agent est creee sur une opportunite ou un appel d offres.
2. Le moteur genere automatiquement un plan d actions.
3. Les actions simples peuvent etre executees en mode interne.
4. Les actions sensibles demandent une approbation humaine.
5. Chaque execution produit un resume et une prochaine etape.

## Endpoints

```text
GET    /api/v1/agent-actions
POST   /api/v1/agent-actions
POST   /api/v1/agent-actions/plan
POST   /api/v1/agent-actions/{action_id}/approve
POST   /api/v1/agent-actions/run
```

## Actions generees par defaut

- analyse du contexte ;
- preparation du plan de livrable ;
- analyse des exigences AO si l affectation est liee a un appel d offres ;
- demande de validation humaine.

## Regles de securite

- Une action sensible ne peut pas etre executee sans validation humaine.
- Le mode `force` existe pour les tests ou les administrateurs, mais ne doit pas etre expose librement en production.
- Les actions sont idempotentes lors de la planification : relancer le plan ne cree pas de doublons.

## Prochaine etape produit

Ajouter une interface frontend pour :

- voir les actions d une affectation ;
- generer le plan ;
- approuver une action ;
- executer une action interne ;
- afficher le resultat et la prochaine etape.
