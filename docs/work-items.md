# Work Items

## Objectif

Les Work Items permettent aux profils specialises de produire des taches operationnelles rattachees a une opportunite ou a un appel d offres.

Ils representent la premiere couche d automatisation controlee de la plateforme.

## Principe

Le workflow recommande est :

```text
Profil specialise -> work item -> revue humaine -> completion
```

La plateforme ne doit pas laisser un profil automatiser une livraison client sans controle humain.

## Cas d usage

- analyser une opportunite ;
- preparer une synthese de cadrage ;
- proposer une matrice de conformite ;
- preparer une trame de memoire technique ;
- produire une checklist documentaire ;
- recommander une prochaine etape commerciale.

## Statuts MVP

- draft ;
- reviewed ;
- completed.

## Endpoints

```text
GET    /api/v1/work-items
POST   /api/v1/work-items
GET    /api/v1/work-items/{item_id}
PATCH  /api/v1/work-items/{item_id}
POST   /api/v1/work-items/{item_id}/review
POST   /api/v1/work-items/{item_id}/complete
```

## Gouvernance

Par defaut, un Work Item necessite une revue humaine avant completion.

Cela evite qu une action sensible soit consideree comme finalisee sans validation.
