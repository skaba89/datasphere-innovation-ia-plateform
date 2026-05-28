# Demo end-to-end - DataSphere Innovation IA Platform

## Objectif

Ce guide sert a demontrer la plateforme devant un client, un partenaire, un investisseur ou une institution publique.

Il montre le positionnement produit :

```text
Cabinet de conseil Data, IT et IA augmente par des profils consultants specialises et des actions gouvernees.
```

## Parcours de demonstration

### 1. Demarrer la plateforme

Backend :

```bash
cd platform/backend
uvicorn app.main:app --reload --port 8000
```

Frontend :

```bash
cd platform/frontend
npm install
npm run dev
```

Ouvrir :

```text
http://localhost:5173
```

API Swagger :

```text
http://localhost:8000/docs
```

## 2. Creer le compte administrateur

Depuis Swagger :

```text
POST /api/v1/auth/bootstrap-admin
```

Payload exemple :

```json
{
  "email": "admin@datasphere-innovation.net",
  "password": "Admin123456!",
  "first_name": "Admin",
  "last_name": "DataSphere",
  "role": "admin",
  "is_active": true
}
```

## 3. Se connecter au frontend

Dans la console frontend :

```text
Email: admin@datasphere-innovation.net
Mot de passe: Admin123456!
```

## 4. Creer une organisation

Menu :

```text
Console > Organisations
```

Exemple :

```text
Nom: ARPT Guinee
Pays: Guinee
Secteur: Telecom / Regulateur public
Type: Institution publique
Site: https://www.arpt.gov.gn
Description: Institution cible pour une mission de transformation data et IA.
```

## 5. Creer une opportunite

Menu :

```text
Console > Opportunites
```

Exemple :

```text
Titre: Plateforme data et IA pour le pilotage des telecoms
Type: Appel d offres / Conseil
Pays: Guinee
Secteur: Telecom, Data, IA, Transformation digitale
Priorite: Haute
Probabilite: 70
Responsable: DataSphere Innovation
Notes: Opportunite strategique pour reference publique en Afrique de l Ouest.
```

## 6. Creer un appel d offres

Menu :

```text
Appels d offres
```

Creer un AO rattache a l opportunite.

Exemple :

```text
Reference: ARPT-DATA-IA-2026
Titre: Mise en place d une plateforme data et IA pour le pilotage du secteur telecom
Acheteur: ARPT Guinee
Decision Go / No-Go: A qualifier
Statut: draft
```

## 7. Ajouter les exigences de l AO

Exemples :

```text
REQ-001 - Architecture data moderne, securisee et scalable
REQ-002 - Gouvernance des donnees et qualite des indicateurs
REQ-003 - Tableaux de bord decisionnels pour la direction
REQ-004 - Documentation technique et transfert de competences
REQ-005 - Maintenance, support et accompagnement pendant 12 mois
```

## 8. Installer les profils consultants standards

Menu :

```text
Profils consultants
```

Cliquer sur :

```text
Installer les profils standards
```

Resultat attendu :

```text
5 profil(s) consultant/agent disponible(s)
```

Profils attendus :

```text
Data Architect Senior
Expert Reponse AO
Consultant Data Gouvernance
Business Analyst IT Data
Expert Documentation Client
```

## 9. Affecter un profil a une opportunite ou a un AO

Dans `Profils consultants`, descendre dans le panneau :

```text
Affecter un profil et generer les actions
```

Exemple :

```text
Profil consultant: Expert Reponse AO
Cible: Appel d offres
Element cible: Mise en place d une plateforme data et IA pour le pilotage du secteur telecom
Objectif: Analyser l appel d offres et proposer une strategie de reponse gagnante.
Livrable attendu: Plan d action, matrice de conformite et trame de memoire technique.
```

Cliquer sur :

```text
Creer l affectation
```

## 10. Planifier les actions gouvernees

Selectionner l affectation creee puis cliquer sur :

```text
Planifier les actions
```

Resultat attendu :

```text
Des actions sont generees automatiquement.
```

Exemples d actions :

```text
Analyse de contexte
Preparation livrable
Revue humaine
Revue exigences AO
```

## 11. Approuver et lancer les actions

Pour chaque action sensible :

```text
Approuver > Lancer
```

Pour une action non sensible :

```text
Lancer
```

La plateforme doit afficher un resultat resume et une prochaine etape.

## 12. Message business a presenter

```text
DataSphere Innovation IA Platform permet de piloter les opportunites, appels d offres et missions de conseil avec des profils consultants augmentes. Les agents proposent et structurent les actions, mais les decisions sensibles restent gouvernees par validation humaine. Cela permet de gagner du temps, standardiser les livrables, reduire les risques et professionnaliser la reponse aux appels d offres.
```

## 13. Points forts a montrer

- CRM opportunites ;
- suivi des organisations ;
- module appels d offres ;
- exigences et matrice de conformite ;
- profils consultants standards ;
- affectation des profils ;
- planification automatique des actions ;
- validation humaine obligatoire pour les actions sensibles ;
- execution controlee ;
- documentation projet.

## 14. Prochaines evolutions conseillees

- export PDF/Word du memo technique ;
- generation de proposition commerciale ;
- scoring avance Go / No-Go ;
- bibliotheque de templates sectoriels ;
- tableau de bord pipeline commercial ;
- integration email ;
- gestion multi-tenant ;
- audit logs ;
- roles et permissions avances.
