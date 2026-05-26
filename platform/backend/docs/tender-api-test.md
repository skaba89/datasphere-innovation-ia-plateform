# Tender API Test Guide

## Objectif

Tester le module Appels d offres du MVP.

## Prerequis

- Plateforme lancee avec Docker.
- Premier admin cree.
- Token JWT obtenu via `/api/v1/auth/login`.
- Au moins une organisation creee.
- Au moins une opportunite creee.

## Endpoints ajoutes

```text
GET    /api/v1/tenders
POST   /api/v1/tenders
GET    /api/v1/tenders/{tender_id}
PATCH  /api/v1/tenders/{tender_id}
DELETE /api/v1/tenders/{tender_id}

GET    /api/v1/tenders/{tender_id}/requirements
POST   /api/v1/tenders/{tender_id}/requirements
PATCH  /api/v1/tenders/requirements/{requirement_id}
DELETE /api/v1/tenders/requirements/{requirement_id}
```

## Creer un appel d offres

```bash
TOKEN="coller-le-token-ici"

curl -X POST http://localhost:8000/api/v1/tenders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "opportunity_id": 1,
    "reference": "AO-2026-001",
    "title": "Digitalisation des services publics",
    "buyer_name": "Institution Exemple",
    "source_url": "https://example.com/appel-offres",
    "summary": "Mise en place d une plateforme digitale avec gouvernance et reporting.",
    "go_no_go_score": 75,
    "go_no_go_decision": "GO",
    "status": "analysis"
  }'
```

## Ajouter une exigence

```bash
curl -X POST http://localhost:8000/api/v1/tenders/1/requirements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "requirement_code": "REQ-001",
    "section": "Architecture technique",
    "description": "Le prestataire doit proposer une architecture securisee et evolutive.",
    "requirement_type": "Technique",
    "response_strategy": "Presenter une architecture modulaire FastAPI, PostgreSQL, Docker et gouvernance documentaire.",
    "proof_or_deliverable": "Schema architecture, dossier technique, plan de securite.",
    "owner_name": "Sekouna",
    "status": "covered",
    "comments": "A detailler dans le memoire technique."
  }'
```

## Verifier les exigences

```bash
curl http://localhost:8000/api/v1/tenders/1/requirements \
  -H "Authorization: Bearer $TOKEN"
```

## Notes

- Les routes sont protegees par JWT.
- Les tables sont creees automatiquement au demarrage en mode MVP local.
- Alembic devra remplacer cette approche avant production.
