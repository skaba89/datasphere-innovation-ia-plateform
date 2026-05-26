# Gouvernance securite

## Regles obligatoires

1. Ne jamais commiter de fichiers .env, mots de passe, tokens API, cles SSH, certificats ou secrets client.
2. Utiliser uniquement des fichiers .env.example pour documenter les variables attendues.
3. Proteger la branche main et travailler via branches dediees.
4. Valider humainement tout livrable avant envoi client.
5. Ne jamais inventer de references, certifications, experiences ou sources.
6. Ne pas collecter d informations personnelles privees sur des decideurs.
7. Utiliser uniquement des sources publiques et professionnelles pour la prospection.
8. Journaliser les decisions importantes du projet.

## Branches recommandees

- docs/foundation
- security/hardening
- feat/agents-library
- feat/platform-mvp
- commercial/service-catalog

## Fichiers interdits dans Git

- .env
- *.key
- *.pem
- credentials.json
- secrets.json
- private-data/
- client-confidential/
- exports-sensibles/

## Validation avant livraison

Chaque livrable client doit verifier :

- coherence du besoin ;
- conformite aux exigences ;
- absence de donnees sensibles ;
- clarte des hypotheses ;
- qualite de la documentation ;
- validation finale humaine.
