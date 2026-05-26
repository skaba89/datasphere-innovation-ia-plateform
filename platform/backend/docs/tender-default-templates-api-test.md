# Tender Default Templates API Test Guide

## Objectif

Ajouter des automatisations controlees pour accelerer la qualification des appels d offres.

## Endpoints ajoutes

```text
POST /api/v1/tender-templates/tenders/{tender_id}/go-no-go/default
POST /api/v1/tender-templates/tenders/{tender_id}/compliance/from-requirements
```

## Appliquer le template Go / No-Go

```bash
TOKEN="coller-le-token-ici"

curl -X POST http://localhost:8000/api/v1/tender-templates/tenders/1/go-no-go/default \
  -H "Authorization: Bearer $TOKEN"
```

Le backend cree les criteres standards suivants si absents :

```text
Adequation strategique
Capacite technique Data / IT / IA
Rentabilite et effort de reponse
Acces au decisionnaire
Risque contractuel et delai
```

## Generer la matrice de conformite depuis les exigences

```bash
curl -X POST http://localhost:8000/api/v1/tender-templates/tenders/1/compliance/from-requirements \
  -H "Authorization: Bearer $TOKEN"
```

Le backend cree une ligne de conformite pour chaque exigence non encore presente dans la matrice.

## Comportement anti-duplication

- Le template Go / No-Go ne recrée pas un critere deja existant avec le meme nom.
- La generation de conformite ne recree pas une ligne pour une exigence deja rattachee.

## Valeur metier

Ces endpoints evitent de repartir de zero a chaque appel d offres.
Ils permettent de gagner du temps tout en gardant une validation humaine obligatoire.
