"""
Templates de livrables — DataSphere Innovation

5 templates professionnels prêts à l'emploi :
  1. Mémoire technique       — réponse AO technique
  2. Proposition commerciale — offre financière + équipe
  3. Note de synthèse        — résumé exécutif dirigeants
  4. Plan projet             — Gantt + jalons + ressources
  5. Présentation exécutive  — slides narrative 10 pages

Chaque template contient :
  - Structure de sections prédéfinie
  - Instructions pour l'IA dans chaque section
  - Contenu placeholder réaliste
  - Variables à remplacer [[VARIABLE]]
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class TemplateSection:
    key: str
    title: str
    content_markdown: str
    instructions_ia: str = ""
    order_index: int = 0


@dataclass
class DeliverableTemplate:
    key: str
    name: str
    description: str
    deliverable_type: str
    icon: str
    sections: list[TemplateSection]
    estimated_pages: str = "10-15 pages"
    use_cases: list[str] = field(default_factory=list)


# ── Template 1 : Mémoire Technique ───────────────────────────────────────────

MEMOIRE_TECHNIQUE = DeliverableTemplate(
    key="memoire_technique",
    name="Mémoire Technique",
    description="Réponse complète à un appel d'offres public — architecture, méthode, équipe, planning",
    deliverable_type="technical_proposal",
    icon="🏗️",
    estimated_pages="20-30 pages",
    use_cases=["Marchés publics BOAMP", "DSI grands comptes", "Appels d'offres UE"],
    sections=[
        TemplateSection(
            key="comprehension_besoin", order_index=1,
            title="1. Compréhension du besoin",
            instructions_ia="Analyser l'AO et reformuler le besoin client avec tes propres mots. Montrer que tu as compris les enjeux stratégiques.",
            content_markdown="""## 1. Compréhension du besoin

### 1.1 Contexte et enjeux

[[ACHETEUR]] fait face à des enjeux de **[[ENJEU_PRINCIPAL]]** qui nécessitent une modernisation de son infrastructure data.

> Notre lecture du besoin : [[REFORMULATION_BESOIN]]

### 1.2 Objectifs de la mission

| Objectif | Indicateur de succès | Priorité |
|---|---|---|
| [[OBJ_1]] | [[KPI_1]] | Haute |
| [[OBJ_2]] | [[KPI_2]] | Moyenne |
| [[OBJ_3]] | [[KPI_3]] | Normale |

### 1.3 Contraintes identifiées

- **Technique** : [[CONTRAINTE_TECH]]
- **Planning** : Livraison avant le [[DATE_LIVRAISON]]
- **Budget** : Enveloppe estimée [[BUDGET]]
""",
        ),
        TemplateSection(
            key="approche_methodologique", order_index=2,
            title="2. Approche méthodologique",
            instructions_ia="Décrire la méthode DataSphere : audit → architecture → implémentation → transfert. Adapter au contexte de l'AO.",
            content_markdown="""## 2. Approche méthodologique

### 2.1 Notre démarche en 4 phases

```
Phase 1 : Audit & Cadrage        → Semaines 1-2
Phase 2 : Architecture cible      → Semaines 3-5
Phase 3 : Implémentation          → Semaines 6-14
Phase 4 : Transfert & formation   → Semaines 15-16
```

### 2.2 Principes directeurs

1. **Data-as-a-product** — chaque dataset traité comme un produit livrable
2. **Medallion Architecture** — Bronze → Silver → Gold pour garantir la qualité
3. **DataOps** — CI/CD sur les pipelines, tests automatisés, observabilité
4. **Cloud-native** — pas de vendor lock-in, infrastructure as code

### 2.3 Stack technique proposée

| Couche | Technologie | Justification |
|---|---|---|
| Ingestion | [[TECH_INGESTION]] | [[RAISON_1]] |
| Transformation | [[TECH_TRANSFORM]] | [[RAISON_2]] |
| Stockage | [[TECH_STORAGE]] | [[RAISON_3]] |
| Orchestration | [[TECH_ORCHES]] | [[RAISON_4]] |
| Visualisation | [[TECH_VISU]] | [[RAISON_5]] |
""",
        ),
        TemplateSection(
            key="equipe_projet", order_index=3,
            title="3. Équipe projet",
            instructions_ia="Présenter l'équipe avec les profils pertinents pour cette mission. CVs en annexe.",
            content_markdown="""## 3. Équipe projet

### 3.1 Organisation de l'équipe

```
Chef de projet          → [[NOM_CDP]]     (100% — présent toute la durée)
Data Architect Senior   → [[NOM_ARCH]]    (100% — phases 1-3)
Data Engineer Lead      → [[NOM_ENG1]]    (100% — phases 2-4)
Data Engineer           → [[NOM_ENG2]]    (80%  — phases 2-3)
Expert Gouvernance      → [[NOM_GOV]]     (50%  — phases 1-2)
```

### 3.2 Profils clés

#### [[NOM_ARCH]] — Data Architect Senior
- **Expérience** : [[EXP_ARCH]] ans
- **Certifications** : [[CERTS_ARCH]]
- **Références** : [[REF_ARCH]]

#### [[NOM_ENG1]] — Data Engineer Lead
- **Expérience** : [[EXP_ENG]] ans
- **Stack** : [[STACK_ENG]]

> Les CVs complets sont fournis en Annexe A.
""",
        ),
        TemplateSection(
            key="planning", order_index=4,
            title="4. Planning et jalons",
            instructions_ia="Créer un planning réaliste avec jalons clés et livrables attendus à chaque étape.",
            content_markdown="""## 4. Planning et jalons

### 4.1 Calendrier macro

| Jalon | Date | Livrable |
|---|---|---|
| Kick-off | J+0 | Feuille de route validée |
| Audit AS-IS | J+10 | Rapport d'état des lieux |
| Architecture validée | J+30 | DAT (Document d'Architecture Technique) |
| MVP en prod | J+60 | Premiers pipelines opérationnels |
| Recette | J+90 | PV de recette signé |
| Go-live | J+[[DUREE]] | Transfert de compétences |

### 4.2 Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Accès données tardif | Moyenne | Fort | Convention d'accès J+5 |
| Qualité données AS-IS | Haute | Moyen | Audit qualité dès J+3 |
| [[RISQUE_3]] | [[PROB_3]] | [[IMP_3]] | [[MITIGATION_3]] |
""",
        ),
        TemplateSection(
            key="references", order_index=5,
            title="5. Références similaires",
            instructions_ia="Lister 3 références de missions similaires. Adapter au secteur de l'acheteur.",
            content_markdown="""## 5. Références similaires

### Mission [[REF1_NOM]] — [[REF1_SECTEUR]]
- **Client** : [[REF1_CLIENT]] (sous confidentialité)
- **Périmètre** : [[REF1_PERIMETRE]]
- **Stack** : [[REF1_STACK]]
- **Résultat** : [[REF1_RESULTAT]]
- **Contact** : [[REF1_CONTACT]] (disponible sur demande)

### Mission [[REF2_NOM]] — [[REF2_SECTEUR]]
- **Client** : [[REF2_CLIENT]]
- **Périmètre** : [[REF2_PERIMETRE]]
- **Résultat** : [[REF2_RESULTAT]]
""",
        ),
    ],
)

# ── Template 2 : Proposition Commerciale ──────────────────────────────────────

PROPOSITION_COMMERCIALE = DeliverableTemplate(
    key="proposition_commerciale",
    name="Proposition Commerciale",
    description="Offre commerciale complète : pricing, équipe, valeur ajoutée, conditions",
    deliverable_type="commercial_proposal",
    icon="💼",
    estimated_pages="8-12 pages",
    use_cases=["Grands comptes privés", "ETI", "Scale-ups"],
    sections=[
        TemplateSection(
            key="executive_summary", order_index=1,
            title="Résumé exécutif",
            instructions_ia="Résumé percutant en 5 points : problème, solution, valeur, investissement, ROI.",
            content_markdown="""## Résumé exécutif

**À l'attention de [[PRENOM_NOM]] — [[FONCTION]]**

Nous avons analysé votre besoin de **[[BESOIN_PRINCIPAL]]** et proposons une approche en [[NB_PHASES]] phases qui vous permettra d'atteindre **[[OBJECTIF_CHIFFRE]]** en [[DELAI]].

| | Votre situation actuelle | Avec DataSphere |
|---|---|---|
| [[METRIQUE_1]] | [[VALEUR_ACTUELLE_1]] | **[[VALEUR_CIBLE_1]]** |
| [[METRIQUE_2]] | [[VALEUR_ACTUELLE_2]] | **[[VALEUR_CIBLE_2]]** |
| ROI estimé | — | **[[ROI]]x en [[DELAI_ROI]]** |
""",
        ),
        TemplateSection(
            key="notre_solution", order_index=2,
            title="Notre solution",
            instructions_ia="Décrire la solution technique en language business — pas trop technique.",
            content_markdown="""## Notre solution

### Ce que nous vous proposons

[[DESCRIPTION_SOLUTION_1_PHRASE]]

```
┌─────────────────────────────────────────────┐
│  PHASE 1 — [[PHASE1_NOM]] ([[PHASE1_DUREE]])│
│  [[PHASE1_DESCRIPTION]]                     │
├─────────────────────────────────────────────┤
│  PHASE 2 — [[PHASE2_NOM]] ([[PHASE2_DUREE]])│
│  [[PHASE2_DESCRIPTION]]                     │
├─────────────────────────────────────────────┤
│  PHASE 3 — [[PHASE3_NOM]] ([[PHASE3_DUREE]])│
│  [[PHASE3_DESCRIPTION]]                     │
└─────────────────────────────────────────────┘
```
""",
        ),
        TemplateSection(
            key="investissement", order_index=3,
            title="Investissement",
            instructions_ia="Présenter le pricing de façon transparente. Inclure des options.",
            content_markdown="""## Investissement

### Grille tarifaire

| Profil | TJM HT | Jours | Total HT |
|---|---|---|---|
| [[PROFIL_1]] | [[TJM_1]] € | [[JOURS_1]] | [[TOTAL_1]] € |
| [[PROFIL_2]] | [[TJM_2]] € | [[JOURS_2]] | [[TOTAL_2]] € |
| **Total mission** | | **[[TOTAL_JOURS]] j** | **[[TOTAL_HT]] € HT** |

### Options

| Option | Tarif HT | Bénéfice |
|---|---|---|
| [[OPTION_1]] | [[PRIX_OPT1]] € | [[BENEFICE_OPT1]] |
| [[OPTION_2]] | [[PRIX_OPT2]] € | [[BENEFICE_OPT2]] |

*Devis valable 60 jours à compter du [[DATE_DEVIS]]*
""",
        ),
    ],
)

# ── Template 3 : Note de Synthèse ─────────────────────────────────────────────

NOTE_SYNTHESE = DeliverableTemplate(
    key="note_synthese",
    name="Note de Synthèse",
    description="Document exécutif concis — pour les décideurs qui ont 5 minutes",
    deliverable_type="executive_summary",
    icon="📋",
    estimated_pages="3-5 pages",
    use_cases=["Comité de direction", "COPIL", "Board review"],
    sections=[
        TemplateSection(
            key="situation", order_index=1,
            title="Situation actuelle",
            instructions_ia="3 phrases max. Aller droit au but. Chiffres clés uniquement.",
            content_markdown="""## Situation actuelle

[[ACHETEUR]] dispose actuellement de **[[NB_SOURCES]] sources de données** non consolidées, générant **[[TEMPS_PERDU]] heures/semaine** de réconciliation manuelle et un taux d'erreur estimé à **[[TAUX_ERREUR]]%**.

> **Impact financier estimé** : [[COUT_PROBLEME]] €/an en coûts directs et indirects.
""",
        ),
        TemplateSection(
            key="recommandation", order_index=2,
            title="Recommandation",
            instructions_ia="La solution en 1 paragraphe. Pourquoi cette approche et pas une autre.",
            content_markdown="""## Recommandation

Nous recommandons la mise en place d'une **[[NOM_SOLUTION]]** basée sur [[STACK_PRINCIPALE]], permettant de centraliser et qualifier l'ensemble des flux data en **[[DELAI]]**.

Cette approche a été choisie après analyse de [[NB_ALTERNATIVES]] alternatives en raison de :
1. [[RAISON_1]]
2. [[RAISON_2]]
3. [[RAISON_3]]
""",
        ),
        TemplateSection(
            key="decision", order_index=3,
            title="Points de décision",
            instructions_ia="Lister les 3 décisions que les décideurs doivent prendre.",
            content_markdown="""## Points de décision

| # | Décision | Option A | Option B | Notre recommandation |
|---|---|---|---|---|
| 1 | [[DECISION_1]] | [[OPT_A_1]] | [[OPT_B_1]] | **[[RECO_1]]** |
| 2 | [[DECISION_2]] | [[OPT_A_2]] | [[OPT_B_2]] | **[[RECO_2]]** |
| 3 | [[DECISION_3]] | [[OPT_A_3]] | [[OPT_B_3]] | **[[RECO_3]]** |

**Prochaine étape** : [[PROCHAINE_ETAPE]] avant le [[DATE_LIMITE]]
""",
        ),
    ],
)

# ── Template 4 : Plan Projet ──────────────────────────────────────────────────

PLAN_PROJET = DeliverableTemplate(
    key="plan_projet",
    name="Plan Projet",
    description="Document de pilotage : WBS, RACI, risques, planning détaillé",
    deliverable_type="project_plan",
    icon="📅",
    estimated_pages="12-20 pages",
    use_cases=["Chef de projet", "PMO", "Pilotage programme"],
    sections=[
        TemplateSection(
            key="perimetre", order_index=1,
            title="Périmètre et livrables",
            instructions_ia="Définir précisément IN SCOPE vs OUT OF SCOPE pour éviter les dérives.",
            content_markdown="""## Périmètre et livrables

### In scope ✅
- [[IN_SCOPE_1]]
- [[IN_SCOPE_2]]
- [[IN_SCOPE_3]]

### Out of scope ❌
- [[OUT_SCOPE_1]]
- [[OUT_SCOPE_2]]

### Livrables contractuels

| # | Livrable | Format | Date | Validation |
|---|---|---|---|---|
| L1 | [[LIVRABLE_1]] | [[FORMAT_1]] | [[DATE_L1]] | [[VALIDEUR_1]] |
| L2 | [[LIVRABLE_2]] | [[FORMAT_2]] | [[DATE_L2]] | [[VALIDEUR_2]] |
| L3 | [[LIVRABLE_3]] | [[FORMAT_3]] | [[DATE_L3]] | [[VALIDEUR_3]] |
""",
        ),
        TemplateSection(
            key="raci", order_index=2,
            title="RACI — Matrice des responsabilités",
            instructions_ia="Créer le RACI complet pour les principales activités.",
            content_markdown="""## RACI — Matrice des responsabilités

> R = Responsable | A = Approbateur | C = Consulté | I = Informé

| Activité | [[ROLE_1]] | [[ROLE_2]] | [[ROLE_3]] | [[ROLE_4]] |
|---|---|---|---|---|
| [[ACTIVITE_1]] | R | A | C | I |
| [[ACTIVITE_2]] | C | R | A | I |
| [[ACTIVITE_3]] | I | C | R | A |
| Validation finale | C | A | R | I |
""",
        ),
        TemplateSection(
            key="risques", order_index=3,
            title="Registre des risques",
            instructions_ia="Identifier les 5-7 risques principaux avec plan de mitigation.",
            content_markdown="""## Registre des risques

| ID | Risque | Proba | Impact | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R1 | [[RISQUE_1]] | H | H | 🔴 | [[MITIGATION_1]] | [[OWNER_1]] |
| R2 | [[RISQUE_2]] | M | H | 🟠 | [[MITIGATION_2]] | [[OWNER_2]] |
| R3 | [[RISQUE_3]] | L | M | 🟡 | [[MITIGATION_3]] | [[OWNER_3]] |
| R4 | [[RISQUE_4]] | H | L | 🟡 | [[MITIGATION_4]] | [[OWNER_4]] |
""",
        ),
    ],
)

# ── Template 5 : Présentation Exécutive ──────────────────────────────────────

PRESENTATION_EXECUTIVE = DeliverableTemplate(
    key="presentation_executive",
    name="Présentation Exécutive",
    description="Support de présentation narrative — structure storytelling en 5 actes",
    deliverable_type="presentation",
    icon="🎯",
    estimated_pages="10-15 slides",
    use_cases=["Comité exécutif", "Pitch client", "Restitution mission"],
    sections=[
        TemplateSection(
            key="accroche", order_index=1,
            title="Slide 1 — Accroche",
            instructions_ia="1 chiffre choc + 1 question rhétorique. Maximum 20 mots.",
            content_markdown="""## Slide 1 — Accroche

> # **[[CHIFFRE_CHOC]]**
> [[SOUS_TITRE_CHOC]]

### [[QUESTION_RHETHORIQUE]] ?

*[[NOM_ORGANISATION]] — [[DATE]]*
""",
        ),
        TemplateSection(
            key="probleme", order_index=2,
            title="Slides 2-3 — Le problème",
            instructions_ia="Décrire le problème en 3 points. Utiliser des analogies visuelles.",
            content_markdown="""## Slides 2-3 — Le problème

### Aujourd'hui, vous perdez du temps et de l'argent

```
Sources       Traitement        Décision
  data    →   manuel/lent   →   tardive
  silotées    [[TEMPS_PERDU]]   [[COUT_RETARD]]
```

### Les 3 symptômes

1. 📊 **[[SYMPTOME_1]]** — [[DETAIL_1]]
2. ⏱️ **[[SYMPTOME_2]]** — [[DETAIL_2]]
3. 💸 **[[SYMPTOME_3]]** — [[DETAIL_3]]
""",
        ),
        TemplateSection(
            key="solution_vision", order_index=3,
            title="Slides 4-6 — La solution",
            instructions_ia="Présenter la vision cible avec une architecture simple (pas trop technique).",
            content_markdown="""## Slides 4-6 — La solution

### Notre vision pour [[ACHETEUR]]

```
AVANT          →          APRÈS
[[ETAT_AVT]]              [[ETAT_APRES]]
```

### Les 3 bénéfices clés

| | Ce que vous gagnez | En chiffres |
|---|---|---|
| 🚀 | [[BENEFICE_1]] | **[[CHIFFRE_1]]** |
| 💡 | [[BENEFICE_2]] | **[[CHIFFRE_2]]** |
| 🏆 | [[BENEFICE_3]] | **[[CHIFFRE_3]]** |
""",
        ),
        TemplateSection(
            key="next_steps", order_index=4,
            title="Slide — Prochaines étapes",
            instructions_ia="Appel à l'action clair avec 3 étapes concrètes et dates.",
            content_markdown="""## Slide — Prochaines étapes

### Pour démarrer d'ici [[DELAI_DEMARRAGE]]

```
Semaine 1    Semaine 2    Semaine 3
   ↓             ↓            ↓
[Accord]    [Kick-off]   [Livraison]
             
[[ETAPE_1]] [[ETAPE_2]]  [[ETAPE_3]]
```

**Contact :** [[CONTACT_NOM]] — [[CONTACT_EMAIL]] — [[CONTACT_PHONE]]
""",
        ),
    ],
)


# ── Registry ──────────────────────────────────────────────────────────────────

ALL_TEMPLATES: dict[str, DeliverableTemplate] = {
    t.key: t for t in [
        MEMOIRE_TECHNIQUE,
        PROPOSITION_COMMERCIALE,
        NOTE_SYNTHESE,
        PLAN_PROJET,
        PRESENTATION_EXECUTIVE,
    ]
}


def get_template(key: str) -> DeliverableTemplate | None:
    return ALL_TEMPLATES.get(key)


def list_templates() -> list[dict]:
    return [
        {
            "key":            t.key,
            "name":           t.name,
            "description":    t.description,
            "deliverable_type": t.deliverable_type,
            "icon":           t.icon,
            "sections_count": len(t.sections),
            "estimated_pages": t.estimated_pages,
            "use_cases":      t.use_cases,
        }
        for t in ALL_TEMPLATES.values()
    ]


def apply_template(key: str, tender_title: str | None = None,
                   buyer_name: str | None = None) -> dict:
    """
    Apply a template and return ready-to-use deliverable data.
    Replaces generic placeholders with tender-specific values where possible.
    """
    tmpl = get_template(key)
    if not tmpl:
        raise ValueError(f"Template '{key}' not found")

    # Build initial markdown from sections
    full_markdown = "\n\n".join(
        s.content_markdown for s in sorted(tmpl.sections, key=lambda x: x.order_index)
    )

    # Replace common placeholders if context is provided
    if tender_title:
        full_markdown = full_markdown.replace("[[MISSION]]", tender_title)
    if buyer_name:
        full_markdown = full_markdown.replace("[[ACHETEUR]]", buyer_name)
        full_markdown = full_markdown.replace("[[NOM_ORGANISATION]]", buyer_name)

    return {
        "title":            f"{tmpl.icon} {tmpl.name}",
        "deliverable_type": tmpl.deliverable_type,
        "status":           "draft",
        "content_markdown": full_markdown,
        "version":          1,
        "template_key":     key,
        "sections":         [
            {
                "key":              s.key,
                "title":            s.title,
                "content_markdown": s.content_markdown,
                "order_index":      s.order_index,
                "instructions_ia":  s.instructions_ia,
            }
            for s in sorted(tmpl.sections, key=lambda x: x.order_index)
        ],
    }
