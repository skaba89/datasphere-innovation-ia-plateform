# MVP Technical Blueprint

## Objectif du MVP

Construire une premiere version interne de la plateforme permettant a DataSphere Innovation de piloter ses opportunites, appels d offres, agents IA et livrables.

Le MVP doit servir l objectif business : vendre plus vite, produire mieux et documenter les missions.

## Perimetre MVP recommande

### Inclus

1. Authentification simple.
2. Gestion des utilisateurs internes.
3. Gestion des prospects et opportunites.
4. Gestion des appels d offres.
5. Matrice Go / No-Go.
6. Matrice de conformite.
7. Bibliotheque de prompts agents.
8. Execution manuelle assistee des agents.
9. Stockage de documents.
10. Checklist qualite et validation humaine.

### Hors perimetre initial

- Multi-tenant avance.
- Paiement SaaS.
- Marketplace d agents.
- Orchestration multi-agent autonome.
- Espace client complet.
- RAG avance sur grands volumes.

## Roles MVP

### Admin

- gere les utilisateurs ;
- configure les agents ;
- consulte toutes les opportunites ;
- valide les livrables.

### Consultant

- cree des opportunites ;
- analyse des appels d offres ;
- utilise les prompts agents ;
- produit des livrables ;
- met a jour le pipeline.

### Reviewer

- relit les livrables ;
- controle la conformite ;
- valide ou rejette.

## Modules MVP

### 1. Auth

- login ;
- roles ;
- sessions ;
- protection des routes.

### 2. CRM

- prospects ;
- organisations ;
- contacts professionnels ;
- opportunites ;
- pipeline ;
- prochaines actions.

### 3. Appels d offres

- fiche appel d offres ;
- documents ;
- score Go / No-Go ;
- exigences ;
- matrice de conformite ;
- statut de production.

### 4. Agents prompts

- liste des agents ;
- prompt systeme ;
- entrees attendues ;
- sorties ;
- historique des executions ;
- revue humaine.

### 5. Documents

- depot de documents ;
- type de document ;
- version ;
- statut ;
- lien avec opportunite ou mission.

### 6. Gouvernance

- checklist qualite ;
- validation ;
- commentaires ;
- decision logs ;
- risques.

## Stack MVP recommandee

### Backend

- FastAPI.
- PostgreSQL.
- SQLAlchemy.
- Alembic.
- Pydantic.
- JWT.

### Frontend

- React / Vite / TypeScript.
- Tailwind CSS.
- Design premium sobre.
- Dashboard admin.

### Infrastructure locale

- Docker Compose.
- PostgreSQL.
- MinIO optionnel.
- Backend API.
- Frontend.

## APIs principales

- /auth/login
- /users
- /organizations
- /contacts
- /opportunities
- /tenders
- /tender-requirements
- /agents
- /agent-runs
- /documents
- /reviews
- /risks

## KPIs MVP

- Nombre de prospects.
- Nombre d opportunites.
- Opportunites par statut.
- Valeur potentielle du pipeline.
- Nombre d appels d offres analyses.
- Nombre de propositions envoyees.
- Taux Go / No-Go.
- Nombre de livrables valides.

## Definition of Done MVP

Le MVP est acceptable si :

- un utilisateur peut se connecter ;
- un consultant peut creer une opportunite ;
- un appel d offres peut etre enregistre ;
- une matrice Go / No-Go peut etre remplie ;
- une matrice de conformite peut etre creee ;
- un agent prompt peut etre consulte et execute manuellement ;
- un livrable peut etre associe a une opportunite ;
- un reviewer peut valider ou rejeter un livrable ;
- les donnees sont persistantes ;
- le projet tourne en Docker local.
