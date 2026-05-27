# Catalogue d agents specialises

## Objectif business

Le catalogue d agents transforme la plateforme en outil de conseil augmente.

Il permet de modeliser des profils specialises capables d assister les consultants sur :

- analyse d appels d offres ;
- preparation de propositions ;
- cadrage data et IT ;
- architecture technique ;
- gouvernance ;
- conformite ;
- documentation client.

## Entites

### AgentProfile

Un profil agent decrit une expertise reutilisable :

- nom ;
- slug unique ;
- domaine ;
- seniorite ;
- langues ;
- types de missions ;
- template d instructions ;
- outils utilisables ;
- regles de gouvernance ;
- statut actif.

### AgentAssignment

Une affectation relie un agent a un contexte business :

- opportunite CRM ;
- appel d offres ;
- objectif ;
- livrable attendu ;
- priorite ;
- statut ;
- reviewer humain.

## Endpoints MVP

```text
GET    /api/v1/agents
POST   /api/v1/agents
GET    /api/v1/agents/{agent_id}
PATCH  /api/v1/agents/{agent_id}
GET    /api/v1/agents/assignments/list
POST   /api/v1/agents/assignments
PATCH  /api/v1/agents/assignments/{assignment_id}
```

## Regle de gouvernance

Un agent ne livre jamais directement au client sans validation humaine.

Chaque affectation peut declarer un `human_reviewer` pour tracer la responsabilite.

## Prochaine etape

Ajouter des templates par defaut :

- Agent Data Architect ;
- Agent Reponse AO ;
- Agent Gouvernance et Conformite ;
- Agent Analyste Business ;
- Agent Documentation Client.
