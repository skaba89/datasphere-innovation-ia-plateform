# Tender Governance API Test Guide

## Objectif

Tester la fondation Go / No-Go et matrice de conformite pour les appels d offres.

## Prerequis

- Plateforme demarree.
- Token JWT valide.
- Un appel d offres existant avec `tender_id = 1`.
- Une exigence existante si vous voulez rattacher une ligne de conformite.

## Endpoints Go / No-Go

```text
GET    /api/v1/tender-governance/tenders/{tender_id}/go-no-go
POST   /api/v1/tender-governance/tenders/{tender_id}/go-no-go
PATCH  /api/v1/tender-governance/go-no-go/{criterion_id}
DELETE /api/v1/tender-governance/go-no-go/{criterion_id}
GET    /api/v1/tender-governance/tenders/{tender_id}/go-no-go/summary
```

## Creer un critere Go / No-Go

```bash
TOKEN="coller-le-token-ici"

curl -X POST http://localhost:8000/api/v1/tender-governance/tenders/1/go-no-go \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "name": "Adequation expertise Data / IT / IA",
    "description": "Capacite de DataSphere a repondre techniquement au besoin.",
    "score": 4,
    "weight": 3,
    "max_score": 5,
    "rationale": "Expertise forte sur data engineering, architecture, IA et gouvernance.",
    "recommendation": "positive"
  }'
```

## Lire le score calcule

```bash
curl http://localhost:8000/api/v1/tender-governance/tenders/1/go-no-go/summary \
  -H "Authorization: Bearer $TOKEN"
```

## Endpoints conformite

```text
GET    /api/v1/tender-governance/tenders/{tender_id}/compliance
POST   /api/v1/tender-governance/tenders/{tender_id}/compliance
PATCH  /api/v1/tender-governance/compliance/{item_id}
DELETE /api/v1/tender-governance/compliance/{item_id}
GET    /api/v1/tender-governance/tenders/{tender_id}/compliance/summary
```

## Ajouter une ligne de conformite

```bash
curl -X POST http://localhost:8000/api/v1/tender-governance/tenders/1/compliance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "requirement_id": 1,
    "requirement_code": "REQ-001",
    "requirement_summary": "Proposer une architecture securisee et evolutive.",
    "compliance_status": "compliant",
    "response_location": "Memoire technique - Section Architecture",
    "evidence": "Architecture FastAPI, PostgreSQL, Docker, RBAC, audit logs.",
    "gap": null,
    "action_plan": "Ajouter schema detaille et matrice de securite.",
    "owner_name": "Sekouna",
    "comments": "A renforcer avec diagramme cible."
  }'
```

## Lire le resume de conformite

```bash
curl http://localhost:8000/api/v1/tender-governance/tenders/1/compliance/summary \
  -H "Authorization: Bearer $TOKEN"
```

## Recommandations de statut

Pour `compliance_status`, utiliser de preference :

```text
compliant
partial
gap
to_review
not_applicable
```

## Notes

- Le score Go / No-Go est calcule avec `score * weight`.
- La recommandation automatique est :
  - `GO` si >= 75%
  - `GO_WITH_RESERVES` si >= 55%
  - `NO_GO` sinon
- La matrice de conformite mesure uniquement le taux de lignes `compliant`.
