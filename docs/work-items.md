# Agent Actions - workflow gouverne

## Decision d architecture

La plateforme utilise `agent_actions` comme moteur officiel pour les actions gerees par les profils specialises.

La logique `work_items` a ete volontairement retiree pour eviter deux moteurs concurrents.

## Principe

Le workflow recommande reste :

```text
Agent specialise -> action suggeree -> validation humaine -> execution controlee
```

## Cas d usage

- analyser une opportunite ;
- preparer une synthese de cadrage ;
- proposer une matrice de conformite ;
- preparer une trame de memoire technique ;
- produire une checklist documentaire ;
- recommander une prochaine etape commerciale.

## Endpoints officiels

```text
GET    /api/v1/agent-actions
POST   /api/v1/agent-actions
POST   /api/v1/agent-actions/plan
POST   /api/v1/agent-actions/{action_id}/approve
POST   /api/v1/agent-actions/run
```

## Gouvernance

Une action sensible necessite une validation humaine avant execution.

Cette approche est plus credible pour des clients publics, grands comptes et appels d offres.
