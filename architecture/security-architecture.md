# Architecture securite

## Objectif

Definir les principes de securite de la future plateforme DataSphere Innovation IA Platform.

La plateforme traitera potentiellement des documents clients, appels d offres, livrables et informations commerciales. La securite doit donc etre integree des la conception.

## Principes fondamentaux

- Principe du moindre privilege.
- Separation des roles.
- Validation humaine des livrables.
- Protection des donnees sensibles.
- Journalisation des actions importantes.
- Secrets hors Git.
- Chiffrement en transit.
- Preparation au multi-tenant.

## Authentification

### MVP

- Authentification email / mot de passe.
- Hashage des mots de passe.
- JWT avec expiration.
- Protection des routes API.

### Cible avancee

- Keycloak ou fournisseur OIDC.
- MFA.
- SSO entreprise.
- Gestion fine des sessions.

## Roles

### Admin

Acces complet a la configuration, aux utilisateurs, agents et donnees.

### Consultant

Acces aux opportunites, appels d offres, documents et agents lies a son perimetre.

### Reviewer

Acces aux livrables a relire et aux checklists de validation.

### Client futur

Acces uniquement a son espace, ses documents, ses demandes et ses validations.

## RBAC MVP

| Ressource | Admin | Consultant | Reviewer | Client futur |
|---|---|---|---|---|
| Utilisateurs | CRUD | Lecture limitee | Non | Non |
| Organisations | CRUD | CRUD | Lecture | Non |
| Opportunites | CRUD | CRUD perimetre | Lecture | Non |
| Appels d offres | CRUD | CRUD perimetre | Lecture | Non |
| Agents | CRUD | Lecture / execution | Lecture | Non |
| Documents | CRUD | CRUD perimetre | Review | Lecture perimetre |
| Reviews | CRUD | Lecture | CRUD | Lecture perimetre |
| Logs | Lecture | Non | Non | Non |

## Donnees sensibles

Types de donnees a proteger :

- cahiers des charges ;
- propositions commerciales ;
- livrables clients ;
- notes strategiques ;
- contacts professionnels ;
- sorties IA non validees ;
- documents contractuels.

## Stockage des fichiers

- Utiliser MinIO ou S3.
- Stocker en base uniquement les metadonnees.
- Prevoir des droits d acces par document.
- Prevoir versioning et statut.
- Ne pas exposer les URLs de fichiers sans controle d acces.

## IA et confidentialite

- Ne pas envoyer de donnees sensibles a un modele IA sans validation.
- Prevoir un mode anonymisation.
- Journaliser les prompts et sorties si autorise.
- Marquer toute sortie IA comme brouillon.
- Interdire l usage de donnees clients pour entrainer des modeles externes sans accord.

## Audit logs

Actions a journaliser :

- connexion utilisateur ;
- creation ou modification opportunite ;
- depot document ;
- execution agent ;
- validation ou rejet livrable ;
- changement de role ;
- export document ;
- suppression.

## Secrets

Interdits dans Git :

- tokens API ;
- mots de passe ;
- cles privees ;
- certificats ;
- fichiers .env reels ;
- exports clients.

## Checklist securite MVP

- [ ] .env.example present.
- [ ] .env ignore.
- [ ] mots de passe hashes.
- [ ] JWT expire.
- [ ] RBAC applique.
- [ ] logs importants actifs.
- [ ] fichiers proteges.
- [ ] CORS configure.
- [ ] validation des entrees API.
- [ ] documentation securite a jour.
