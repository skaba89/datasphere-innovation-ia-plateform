"""
Deliverable Draft Engine — génération de brouillons structurés par type de livrable.

MVP : templates markdown riches par type. Le moteur LLM viendra en Phase 2.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Templates par type de livrable
# ---------------------------------------------------------------------------

_TEMPLATES: dict[str, dict[str, str]] = {
    "note_cadrage": {
        "title": "Note de cadrage — {context}",
        "content": """\
# Note de cadrage

## 1. Contexte et enjeux

**Mission :** {context}

*Décrire ici les enjeux stratégiques identifiés, les informations clés collectées \
et les orientations attendues.*

## 2. Objectifs de la mission

| Objectif | Priorité | Indicateur de succès |
|---|---|---|
| Objectif principal | Haute | À définir avec le client |
| Objectif secondaire | Normale | À définir |

## 3. Périmètre

**Dans le périmètre :**
- À préciser après analyse du besoin.

**Hors périmètre :**
- À préciser après discussion client.

## 4. Parties prenantes

| Rôle | Nom | Responsabilités |
|---|---|---|
| Sponsor | À identifier | Validation budget et décisions |
| Chef de projet client | À identifier | Coordination et suivi |
| Expert métier | À identifier | Expertise domaine |
| Reviewer DataSphere | Sekouna KABA | Validation livrables |

## 5. Contraintes et risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Données incomplètes | Moyen | Élevé | Identifier dès le cadrage |
| Délai de validation | Fort | Moyen | Jalons hebdomadaires |
| Dépendances externes | Faible | Élevé | Cartographier en lancement |

## 6. Plan d'action proposé

1. **Lancement** (J1–J3) — réunion de cadrage, accès environnements
2. **Collecte et analyse** (J3–J15) — interviews, analyse données, diagnostic
3. **Restitution intermédiaire** (J15) — présentation avancement, ajustements
4. **Livraison finale** (J30) — livrables validés, transfert de compétences

## 7. Gouvernance et validation

La validation humaine est obligatoire avant toute transmission au client. \
Ce document doit être soumis au reviewer désigné.

## 8. Prochaines étapes

- [ ] Valider cette note de cadrage avec le sponsor.
- [ ] Identifier les parties prenantes manquantes.
- [ ] Planifier la réunion de lancement.
- [ ] Compléter les informations manquantes dans le CRM.

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à compléter et valider avant transmission.*
""",
    },
    "memoire_technique": {
        "title": "Mémoire technique — {context}",
        "content": """\
# Mémoire technique

## 1. Compréhension du besoin

**Mission :** {context}

*Synthèse de la lecture du cahier des charges et des enjeux identifiés.*

**Besoins exprimés :** À extraire du CDC ou de l'analyse de l'opportunité.

**Besoins implicites :** À identifier lors de l'analyse approfondie.

## 2. Notre approche méthodologique

### 2.1 Méthode globale

Nous proposons une démarche structurée en trois phases progressives :

1. **Cadrage et diagnostic** — analyse de l'existant, cartographie des besoins, \
identification des contraintes.
2. **Conception et réalisation** — production des livrables définis, revues techniques \
hebdomadaires.
3. **Recette et transfert** — validation qualité, documentation, formation des équipes.

### 2.2 Organisation projet

| Phase | Durée estimée | Livrables clés |
|---|---|---|
| Cadrage | 2 semaines | Note de cadrage, plan projet |
| Réalisation | 6–8 semaines | Livrables techniques, rapports d'avancement |
| Clôture | 1 semaine | Documentation finale, recette signée |

## 3. Moyens humains mobilisés

| Expert | Profil | Jours alloués |
|---|---|---|
| Lead Data Architect | Senior 10+ ans, Snowflake, dbt | À préciser |
| Data Engineer | Expert Python/Spark/Cloud | À préciser |
| Project Manager | Certifié, bilingue FR/EN | À préciser |

## 4. Références et expériences similaires

| Client | Mission | Résultat |
|---|---|---|
| SACEM | Architecture Data Lakehouse Snowflake | Livré en temps |
| Thales Group | Migration BI, gouvernance qualité | +40 % performance |
| Accor | Pipeline dbt + Airflow | Automatisation complète |

*Adapter à l'appel d'offres visé.*

## 5. Gestion des risques

| Risque | Probabilité | Impact | Plan de mitigation |
|---|---|---|---|
| Retard livraison | Moyen | Élevé | Buffer 20 %, jalons hebdomadaires |
| Indisponibilité équipe client | Fort | Élevé | Protocole de décision documenté |
| Données incomplètes | Moyen | Moyen | Validation dès la phase cadrage |

## 6. Assurance qualité

Notre démarche qualité inclut des revues de code systématiques, des tests automatisés, \
une documentation continue et une validation humaine avant chaque livrable client. \
Toute décision sensible est tracée dans la plateforme DataSphere.

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à compléter et valider avant soumission.*
""",
    },
    "plan_action": {
        "title": "Plan d'action — {context}",
        "content": """\
# Plan d'action

## 1. Contexte

**Mission :** {context}

**Objectif de ce plan :** Formaliser les actions prioritaires, les responsables et \
les délais pour avancer efficacement.

## 2. Actions prioritaires

| # | Action | Responsable | Délai | Statut |
|---|---|---|---|---|
| 1 | Analyser les exigences du cahier des charges | Agent / Consultant | J+3 | En cours |
| 2 | Produire la note de cadrage | Data Architect | J+7 | À faire |
| 3 | Valider avec le sponsor | Reviewer humain | J+10 | À planifier |
| 4 | Livraison intermédiaire | Équipe DataSphere | J+21 | À planifier |
| 5 | Livraison finale et recette | Équipe + client | J+30 | À planifier |

## 3. Jalons

| Jalon | Date cible | Livrable |
|---|---|---|
| Kick-off | À fixer | CR de réunion de lancement |
| Revue mi-parcours | À fixer | Rapport d'avancement |
| Livraison finale | À fixer | Livrables complets validés |

## 4. Dépendances et points de blocage

| Blocage | Impact | Action corrective | Responsable |
|---|---|---|---|
| Accès environnements client | Critique | Demander en kick-off | Chef de projet |
| Informations manquantes dans CRM | Élevé | Compléter avant J+5 | Consultant |

## 5. Ressources nécessaires

- Accès aux données sources et environnements de production.
- Points de synchronisation hebdomadaires avec le client.
- Validation humaine DataSphere avant chaque livraison.

## 6. Prochaine action immédiate

- [ ] Valider ce plan avec le responsable humain.
- [ ] Identifier les dépendances bloquantes.
- [ ] Planifier le kick-off avec le client.

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à valider avant exécution.*
""",
    },
    "synthese_contexte": {
        "title": "Synthèse de contexte — {context}",
        "content": """\
# Synthèse de contexte

## 1. Résumé exécutif

**Mission :** {context}

*Cette synthèse consolide les informations clés collectées pour orienter \
les décisions stratégiques et opérationnelles.*

## 2. Informations disponibles

| Source | Type | Fiabilité |
|---|---|---|
| CRM DataSphere | Données opportunité | Haute |
| Cahier des charges | Document officiel | Haute |
| Entretiens | Notes collectées | Moyenne |

## 3. Éléments clés identifiés

### 3.1 Acteurs

| Acteur | Rôle | Intérêt | Influence |
|---|---|---|---|
| À identifier | Décideur | Élevé | Forte |
| À identifier | Expert métier | Moyen | Moyenne |

### 3.2 Enjeux stratégiques

1. **Enjeu 1 :** À préciser — transformation numérique, efficacité opérationnelle, etc.
2. **Enjeu 2 :** À préciser — conformité réglementaire, performance data, etc.
3. **Enjeu 3 :** À préciser — présence marché, capacité décisionnelle, etc.

### 3.3 Contraintes identifiées

- **Budgétaires :** À identifier après échange avec le client.
- **Techniques :** Stack existant, contraintes d'intégration.
- **Réglementaires :** RGPD, normes sectorielles, exigences appel d'offres.

## 4. Informations manquantes

- [ ] Confirmer le budget disponible auprès du client.
- [ ] Obtenir les accès aux systèmes sources.
- [ ] Identifier les décideurs réels vs. interlocuteurs désignés.

## 5. Recommandation préliminaire

*Sur la base des informations disponibles, la recommandation est : \
à compléter après analyse approfondie et validation humaine.*

## 6. Prochaines étapes

- [ ] Enrichir cette synthèse avec les informations manquantes.
- [ ] Soumettre au reviewer humain avant utilisation client.

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à enrichir et valider avant utilisation.*
""",
    },
    "rapport_conformite": {
        "title": "Rapport de conformité — {context}",
        "content": """\
# Rapport de conformité

## 1. Objet du rapport

**Mission :** {context}

Ce rapport évalue la conformité par rapport aux exigences définies dans le cahier des charges \
ou le contrat. Il est produit dans le cadre du processus qualité DataSphere Innovation.

## 2. Périmètre d'évaluation

- **Référentiel :** Exigences du cahier des charges / contrat associé
- **Date d'évaluation :** À renseigner
- **Évaluateur :** DataSphere Innovation — Gouvernance qualité

## 3. Résultats par exigence

| Code | Exigence | Statut | Preuve | Écart |
|---|---|---|---|---|
| EX-001 | À renseigner | ✅ Conforme | À documenter | Aucun |
| EX-002 | À renseigner | ⚠️ Partiel | À compléter | À préciser |
| EX-003 | À renseigner | ❌ Non conforme | Manquant | À traiter |

## 4. Synthèse

| Statut | Nombre | % |
|---|---|---|
| Conforme | 0 | 0 % |
| Partiel | 0 | 0 % |
| Non conforme | 0 | 0 % |
| **Total** | **0** | **100 %** |

**Taux de conformité global :** À calculer après évaluation complète.

## 5. Plan de correction

| Écart identifié | Action corrective | Responsable | Délai |
|---|---|---|---|
| À identifier | À planifier | À affecter | À fixer |

## 6. Conclusion et recommandation

*Conclusion à rédiger après analyse complète. La validation humaine est requise \
avant transmission au client ou à l'organisme évaluateur.*

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à compléter et valider par le responsable qualité.*
""",
    },
    "offre_commerciale": {
        "title": "Offre commerciale — {context}",
        "content": """\
# Offre commerciale

**Émetteur :** DataSphere Innovation  
**Destinataire :** À renseigner  
**Objet :** {context}  
**Date :** À renseigner  
**Validité :** 30 jours

---

## 1. Compréhension du besoin

**Besoin principal :** À préciser d'après l'analyse du contexte.

**Contexte :** {context}

DataSphere Innovation propose une réponse adaptée combinant expertise Data/IA, \
méthode éprouvée et gouvernance rigoureuse.

## 2. Notre solution

### 2.1 Approche proposée

Nous structurons notre intervention en phases progressives permettant \
une validation continue et un risque maîtrisé :

1. Cadrage et diagnostic (2 semaines)
2. Conception et réalisation (6–8 semaines)
3. Recette et transfert (1 semaine)

### 2.2 Livrables inclus

| Livrable | Description | Format |
|---|---|---|
| Note de cadrage | Analyse du besoin et plan de mission | PDF |
| Architecture cible | Schéma et documentation technique | PDF |
| Rapport de mission | Bilan complet et recommandations | PDF |
| Documentation | Guides techniques et fonctionnels | Markdown / PDF |

## 3. Équipe mobilisée

| Expert | Profil | Jours |
|---|---|---|
| Lead Data Architect | Senior 10+ ans, Snowflake, dbt, Airflow | À préciser |
| Data Engineer Senior | Python, Spark, AWS/GCP/Azure | À préciser |
| Project Manager | Bilingue FR/EN, certifié | À préciser |

## 4. Budget prévisionnel

| Poste | Jours | TJM | Montant HT |
|---|---|---|---|
| Direction de mission | À préciser | 800 € | À calculer |
| Ingénierie data | À préciser | 650 € | À calculer |
| Gestion de projet | À préciser | 600 € | À calculer |
| **Total HT** | | | **À calculer** |

## 5. Conditions générales

- Facturation mensuelle sur avancement validé par le client.
- Validation humaine obligatoire avant chaque livrable client.
- Conformité RGPD garantie — aucune donnée sensible hors périmètre défini.

## 6. Prochaines étapes

1. Validation de cette offre et retours du client.
2. Signature du bon de commande ou du contrat.
3. Planification du kick-off de mission.

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à personnaliser et valider avant envoi au client.*
""",
    },
    "bilan_mission": {
        "title": "Bilan de mission — {context}",
        "content": """\
# Bilan de mission

## 1. Rappel des objectifs

**Mission :** {context}

*Rappeler brièvement les objectifs fixés en phase de cadrage.*

## 2. Livrables produits

| Livrable | Statut | Date de livraison | Commentaire |
|---|---|---|---|
| Note de cadrage | ✅ Livré | À renseigner | Validé par le client |
| À compléter | — | — | — |

## 3. Résultats obtenus

*Décrire les résultats concrets obtenus par rapport aux objectifs initiaux.*

| Objectif | Résultat | Atteint |
|---|---|---|
| Objectif 1 | À documenter | ✅ / ⚠️ / ❌ |
| Objectif 2 | À documenter | ✅ / ⚠️ / ❌ |

## 4. Enseignements et bonnes pratiques

*Ce qui a bien fonctionné et ce qui peut être amélioré pour les prochaines missions.*

**Points forts :**
- À documenter.

**Points d'amélioration :**
- À documenter.

## 5. Recommandations pour la suite

*Préconisations adressées au client ou à l'équipe DataSphere pour capitaliser \
sur les acquis de la mission.*

## 6. Satisfaction client

- Feedback qualitatif : À collecter.
- Renouvellement / référencement : À confirmer.

---
*Brouillon généré par DataSphere Innovation IA Platform — \
à compléter et valider avant archivage.*
""",
    },
}

_DEFAULT_TEMPLATE: dict[str, str] = {
    "title": "Livrable — {context}",
    "content": """\
# Livrable

## 1. Contexte

**Mission :** {context}

## 2. Contenu principal

*À renseigner selon le type de livrable et les besoins de la mission.*

## 3. Prochaines étapes

- [ ] Compléter ce document.
- [ ] Soumettre au reviewer humain pour validation.

---
*Brouillon généré par DataSphere Innovation IA Platform.*
""",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_supported_types() -> list[str]:
    return list(_TEMPLATES.keys())


def generate_draft_content(deliverable_type: str, context: str, language: str = "fr") -> str:  # noqa: ARG001
    """Generate a structured markdown draft for the given deliverable type and context."""
    template = _TEMPLATES.get(deliverable_type, _DEFAULT_TEMPLATE)
    return template["content"].format(context=context)


def build_draft_title(deliverable_type: str, context: str) -> str:
    template = _TEMPLATES.get(deliverable_type, _DEFAULT_TEMPLATE)
    return template["title"].format(context=context)


def build_context_label(
    db: Session,
    opportunity_id: int | None,
    tender_id: int | None,
    assignment_id: int | None,
    action_id: int | None,  # noqa: ARG001
) -> str:
    """Resolve scope IDs to a human-readable context label for draft generation."""
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender

    if tender_id is not None:
        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if tender:
            ref = tender.reference or "sans ref."
            return f"{tender.title} ({ref})"

    if opportunity_id is not None:
        opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
        if opp:
            return opp.title

    if assignment_id is not None:
        return f"Assignment #{assignment_id}"

    return "Mission DataSphere Innovation"
