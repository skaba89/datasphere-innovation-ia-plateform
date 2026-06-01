"""
Built-in sector templates for DataSphere Innovation.
5 sectors × 2 deliverable types = 10 templates.
"""

from __future__ import annotations

_TEMPLATES = [

    # ── TELECOM ───────────────────────────────────────────────────────────────
    {
        "sector_key": "telecom",
        "sector_label": "Télécommunications & Régulation",
        "deliverable_type": "memoire_technique",
        "title_template": "Mémoire technique — Mission Data & IA Télécom",
        "description": "Template pour les AO télécom, régulateurs et opérateurs mobiles.",
        "tags": "telecom,régulateur,ARPT,Orange,MTN,data,IA",
        "content_markdown": """\
# Mémoire technique — Mission Data & IA Télécom

## 1. Compréhension du besoin

Le secteur des télécommunications fait face à des défis majeurs : explosion des volumes de données de supervision réseau, besoin de pilotage réglementaire en temps réel, pression sur la qualité de service (QoS/QoE) et montée en puissance de la 4G/5G.

**Enjeux identifiés :**
- Consolidation des données réseau dispersées entre plusieurs systèmes (OSS/BSS, CRM, facturation)
- Tableaux de bord décisionnels pour la direction et les régulateurs
- Détection d'anomalies et prédiction de pannes par IA
- Conformité réglementaire et reporting automatisé

## 2. Approche méthodologique

**Phase 1 — Audit et cadrage (J1–J30)**
- Cartographie des sources de données existantes (OSS, BSS, supervision réseau)
- Évaluation de la maturité data et identification des quick wins
- Définition de l'architecture cible (Lakehouse)

**Phase 2 — Plateforme data (J30–J90)**
- Mise en place de l'ingestion temps réel (Kafka/Airflow)
- Couche de transformation et qualité des données (dbt)
- Stockage optimisé (Snowflake / BigQuery)

**Phase 3 — IA et visualisation (J90–J180)**
- Modèles de prédiction pannes, détection fraude, segmentation clients
- Tableaux de bord exécutifs (Superset / Power BI)
- Transfert de compétences et documentation

## 3. Équipe proposée

| Rôle | Profil | Charge |
|---|---|---|
| Lead Data Architect | Sekouna KABA — 10 ans télécom | 80% |
| Data Engineer Senior | Expert Airflow/Snowflake/dbt | 100% |
| Data Scientist | Spécialiste anomaly detection | 60% |
| Chef de projet | PMP certifié | 30% |

## 4. Références sectorielles

- Migration data warehouse ARPT Guinée — architecture Lakehouse souveraine
- Plateforme analytique Orange Africa — 15 pays, 200+ indicateurs réseau
- Monitoring QoS temps réel — opérateur 4G, 2M abonnés

## 5. Gestion des risques

| Risque | Probabilité | Impact | Plan de mitigation |
|---|---|---|---|
| Accès aux données OSS/BSS | Moyen | Élevé | Contractualiser les SLAs d'accès dès J1 |
| Hétérogénéité des sources | Fort | Moyen | Cartographie exhaustive en Phase 1 |
| Adoption interne | Moyen | Élevé | Plan de conduite du changement intégré |

## 6. Assurance qualité

- Revues hebdomadaires avec le comité de pilotage
- Validation humaine de chaque livrable par DataSphere avant remise
- Tests de recette définis conjointement avec le client
- Documentation technique et opérationnelle incluse
""",
    },
    {
        "sector_key": "telecom",
        "sector_label": "Télécommunications & Régulation",
        "deliverable_type": "note_cadrage",
        "title_template": "Note de cadrage — Transformation Data Télécom",
        "description": "Cadrage mission data pour opérateurs et régulateurs télécoms.",
        "tags": "telecom,cadrage,data,régulation",
        "content_markdown": """\
# Note de cadrage — Transformation Data Télécom

## 1. Contexte et enjeux

Le secteur télécom connaît une transformation profonde sous l'effet de la convergence numérique et de la pression réglementaire. La donnée est au cœur de la performance opérationnelle et de la conformité réglementaire.

**Enjeux stratégiques :**
- Visibilité complète sur les indicateurs réseau et de qualité de service
- Automatisation du reporting réglementaire (obligations légales)
- Monétisation des données par des services à valeur ajoutée

## 2. Objectifs de la mission

| Objectif | KPI cible | Délai |
|---|---|---|
| Centraliser les données réseau | 100% des sources intégrées | M+3 |
| Tableaux de bord réglementaires | Rapport auto en < 24h | M+6 |
| Réduction des incidents | -30% d'incidents non détectés | M+9 |

## 3. Périmètre

**Dans le périmètre :** Données réseau, supervision, facturation, reporting réglementaire
**Hors périmètre :** Refonte des systèmes sources, gestion RH

## 4. Parties prenantes

| Rôle | Responsabilités |
|---|---|
| Directeur Général | Sponsor exécutif |
| DSI | Coordination technique |
| Directeur Réglementation | Validation conformité |
| Lead DataSphere | Delivery et qualité |

## 5. Prochaines étapes

1. Atelier de lancement — présentation équipe et méthodologie
2. Audit des sources de données existantes (2 semaines)
3. Présentation des recommandations architecture (M+1)
""",
    },

    # ── FINANCE & BANQUE ─────────────────────────────────────────────────────
    {
        "sector_key": "finance",
        "sector_label": "Finance, Banque & Assurance",
        "deliverable_type": "memoire_technique",
        "title_template": "Mémoire technique — Plateforme Data Finance",
        "description": "Template pour missions data dans le secteur bancaire, assurance et fintech.",
        "tags": "finance,banque,assurance,risk,conformité,BCBS,DORA",
        "content_markdown": """\
# Mémoire technique — Plateforme Data Finance

## 1. Compréhension du besoin

Les établissements financiers font face à une triple pression : réglementaire (BCBS 239, DORA, IFRS 9), opérationnelle (risque de crédit, fraude) et compétitive (fintechs, open banking). La maîtrise de la donnée est devenue un enjeu de survie.

**Problématiques clés :**
- Agrégation et réconciliation des données de risque en temps réel
- Calcul des indicateurs prudentiels (LCR, NSFR, NPL) automatisé
- Détection de fraude par machine learning
- Conformité RGPD et gouvernance des données personnelles

## 2. Architecture proposée

```
Sources : Core Banking / CBS, CRM, Market Data, External APIs
   ↓
Ingestion : Apache Kafka (streaming) + Airflow (batch)
   ↓
Lakehouse : Snowflake / Delta Lake — Bronze / Silver / Gold
   ↓
IA & Analytics : Python ML, modèles scoring risque
   ↓
Distribution : Tableaux de bord direction, reporting régulateur, API
```

## 3. Conformité et sécurité

- Chiffrement des données au repos et en transit (AES-256, TLS 1.3)
- Gestion des droits d'accès (RBAC) et audit trail complet
- Anonymisation et pseudonymisation des données clients (RGPD)
- Archivage légal conforme aux obligations réglementaires

## 4. Équipe et gouvernance

Gouvernance humaine obligatoire sur tous les modèles de risque : aucun modèle IA ne décide sans validation par un expert humain qualifié.

## 5. Références

- Système de scoring crédit — banque commerciale, 500k clients
- Plateforme reporting prudentiel — groupe bancaire régional
- Détection fraude temps réel — fintech, 99.7% de précision
""",
    },
    {
        "sector_key": "finance",
        "sector_label": "Finance, Banque & Assurance",
        "deliverable_type": "offre_commerciale",
        "title_template": "Proposition commerciale — Mission Data Finance",
        "description": "Proposition commerciale complète pour missions data finance.",
        "tags": "finance,offre,prix,budget",
        "content_markdown": """\
# Proposition commerciale — Mission Data & IA Finance

## Résumé exécutif

DataSphere Innovation propose une solution de plateforme data et IA conçue pour les établissements financiers. Notre approche combine expertise technique, gouvernance des données et conformité réglementaire.

**Valeur créée :**
- Réduction de 60% du temps de production des reportings réglementaires
- Détection fraude en < 50ms (vs 48h actuellement)
- Conformité BCBS 239 / DORA atteinte dans les délais réglementaires

## Solution proposée

### Architecture Lakehouse sécurisée
Infrastructure souveraine, déployable on-premise ou cloud privé, avec audit trail complet et chiffrement de bout en bout.

### Modules livrés
| Module | Description | Délai |
|---|---|---|
| Data ingestion | Connecteurs CBS, CRM, Market Data | M+2 |
| Data quality | Validation, réconciliation, Master Data | M+3 |
| Reporting réglementaire | LCR, NSFR, NPL, COREP automatisés | M+5 |
| Détection fraude | Modèle ML temps réel | M+7 |
| Tableaux de bord | Direction, compliance, opérations | M+8 |

## Budget prévisionnel

| Poste | Jours | Taux | Montant HT |
|---|---|---|---|
| Architecture & conception | 20 | 850 €/j | 17 000 € |
| Développement plateforme | 60 | 750 €/j | 45 000 € |
| Data science & IA | 30 | 800 €/j | 24 000 € |
| Formation & transfert | 10 | 700 €/j | 7 000 € |
| **TOTAL** | **120** | | **93 000 € HT** |

## Conditions commerciales

- Engagement : Contrat de prestation intellectuelle
- Facturation : 30% à la commande, 40% à la recette intermédiaire (M+4), 30% à la recette finale
- Garantie : 3 mois de support post-déploiement inclus
- Propriété intellectuelle : Code source livré en fin de mission
""",
    },

    # ── SECTEUR PUBLIC ───────────────────────────────────────────────────────
    {
        "sector_key": "public",
        "sector_label": "Secteur public & Institutions",
        "deliverable_type": "memoire_technique",
        "title_template": "Mémoire technique — Transformation numérique publique",
        "description": "Template AO public : ministères, agences, collectivités, régulateurs.",
        "tags": "public,gouvernement,transformation,numérique,open-data",
        "content_markdown": """\
# Mémoire technique — Transformation numérique et Data

## 1. Compréhension du besoin

Les institutions publiques doivent moderniser leur gestion de la donnée pour améliorer le service aux citoyens, respecter les obligations de transparence et optimiser les dépenses publiques.

**Défis spécifiques au secteur public :**
- Systèmes d'information hétérogènes et souvent vieillissants (legacy)
- Exigences de souveraineté des données (hébergement national)
- Obligations d'accessibilité et d'open data
- Contraintes budgétaires et processus d'achat public

## 2. Approche adaptée au secteur public

**Principes directeurs :**
- Architecture souveraine : déploiement on-premise ou cloud certifié (SecNumCloud)
- Open source en priorité : réduction des coûts de licence
- Transfert de compétences obligatoire : formation des équipes internes
- Documentation exhaustive : pérennité post-mission

**Méthodologie agile adaptée :**
Sprints de 2 semaines avec démonstration aux parties prenantes, validation par le comité de pilotage avant chaque livraison.

## 3. Références secteur public

- Plateforme open data — ministère, 500+ jeux de données publiés
- Tableau de bord indicateurs socio-économiques — régulateur national
- Système d'adressage numérique — administration territoriale (6 communes)

## 4. Transfert de compétences

Formation des équipes techniques et métier incluse :
- 5 jours de formation architecture data
- 3 jours de formation exploitation des tableaux de bord
- Documentation opérationnelle complète en français
- Support post-déploiement 6 mois

## 5. Conformité et sécurité

- Conformité RGPD et protection des données personnelles
- Audit de sécurité avant mise en production
- Plan de continuité d'activité (PCA/PRA) fourni
""",
    },
    {
        "sector_key": "public",
        "sector_label": "Secteur public & Institutions",
        "deliverable_type": "note_cadrage",
        "title_template": "Note de cadrage — Mission de service public numérique",
        "description": "Cadrage mission numérique pour institutions et collectivités.",
        "tags": "public,cadrage,numérique,collectivité",
        "content_markdown": """\
# Note de cadrage — Mission de service public numérique

## 1. Contexte institutionnel

Cette mission s'inscrit dans le cadre de la stratégie nationale de transformation numérique et vise à doter l'institution d'une capacité data moderne, souveraine et pérenne.

## 2. Objectifs stratégiques

| Objectif | Indicateur | Cible |
|---|---|---|
| Modernisation SI data | % sources intégrées | 100% en M+6 |
| Service citoyen amélioré | Délai de traitement | -50% en M+9 |
| Transparence & open data | Jeux de données publiés | 20+ en M+12 |
| Autonomie des équipes | Agents formés | 100% en M+10 |

## 3. Gouvernance de la mission

La gouvernance est assurée par un comité de pilotage mixte (décideurs politiques + experts techniques) se réunissant mensuellement. DataSphere fournit un compte-rendu après chaque réunion.

## 4. Budget et calendrier

Budget prévisionnel : à définir selon les phases validées
Calendrier : 12 mois de mission, démarrage sous 4 semaines après notification

## 5. Livrables attendus

1. Rapport d'audit des systèmes existants (M+1)
2. Architecture cible validée (M+2)
3. Plateforme data opérationnelle (M+6)
4. Tableaux de bord et open data (M+9)
5. Documentation et formation (M+11)
6. Rapport de clôture et recommandations (M+12)
""",
    },

    # ── ÉNERGIE & INDUSTRIE ──────────────────────────────────────────────────
    {
        "sector_key": "energy",
        "sector_label": "Énergie, Industrie & Environnement",
        "deliverable_type": "memoire_technique",
        "title_template": "Mémoire technique — Data & IA Énergie",
        "description": "Template missions data pour opérateurs énergie, industrie, environnement.",
        "tags": "énergie,industrie,IoT,maintenance prédictive,environnement",
        "content_markdown": """\
# Mémoire technique — Plateforme Data & IA Énergie

## 1. Compréhension du besoin

Le secteur de l'énergie et de l'industrie génère des volumes massifs de données IoT (capteurs, compteurs, équipements) nécessitant une plateforme capable d'ingestion temps réel, de détection d'anomalies et d'optimisation opérationnelle.

**Enjeux identifiés :**
- Maintenance prédictive : prévenir les pannes avant qu'elles surviennent
- Optimisation de la consommation énergétique par IA
- Conformité aux obligations de reporting environnemental (RSE, Scope 1/2/3)
- Supervision en temps réel des actifs distribués

## 2. Architecture IoT & Data

```
Capteurs terrain / SCADA / Smart meters
   ↓
Edge computing → MQTT/HTTP
   ↓
Stream processing : Apache Kafka
   ↓
Stockage time-series : InfluxDB / Snowflake
   ↓
IA : maintenance prédictive, optimisation, détection anomalies
   ↓
Dashboards : supervision temps réel + reporting direction
```

## 3. Cas d'usage prioritaires

| Cas d'usage | Technologie | ROI estimé |
|---|---|---|
| Maintenance prédictive | Random Forest, LSTM | -40% coûts maintenance |
| Optimisation consommation | Reinforcement Learning | -15% énergie |
| Détection fuites/anomalies | Isolation Forest | -25% pertes |
| Reporting RSE automatisé | Pipeline ETL + LLM | -80% temps rapport |

## 4. Sécurité industrielle

- Cloisonnement réseau IT/OT (zones Purdue)
- Authentification forte sur les accès aux données sensibles
- Audit trail complet sur les commandes de supervision

## 5. Équipe spécialisée

Nos ingénieurs data ont une expérience directe de l'environnement industriel et comprennent les contraintes de continuité de service (24h/7j, criticité haute).
""",
    },
    {
        "sector_key": "energy",
        "sector_label": "Énergie, Industrie & Environnement",
        "deliverable_type": "note_cadrage",
        "title_template": "Note de cadrage — Transformation data énergie",
        "description": "Cadrage data pour opérateurs énergie et industriels.",
        "tags": "énergie,cadrage,IoT,industrie",
        "content_markdown": """\
# Note de cadrage — Transformation Data Énergie

## 1. Contexte

La transition énergétique impose une maîtrise fine de la donnée de production, distribution et consommation. L'IA permet d'optimiser ces flux et de réduire l'empreinte environnementale.

## 2. Périmètre de la mission

| Inclus | Exclus |
|---|---|
| Données capteurs / SCADA | Remplacement des équipements terrain |
| Indicateurs de performance (KPI) | Gestion RH |
| Reporting RSE automatisé | Refonte ERP |
| Maintenance prédictive | Gestion contractuelle clients |

## 3. Contraintes techniques

- Continuité de service : aucune interruption de la supervision réseau
- Latence : alertes temps réel en < 500ms
- Volumétrie : jusqu'à 10 millions de points de mesure/jour

## 4. Plan de déploiement

Phase 1 (M1–M2) : Audit et cartographie des sources
Phase 2 (M3–M5) : Infrastructure data temps réel
Phase 3 (M6–M8) : Modèles IA et dashboards
Phase 4 (M9–M10) : Formation et transfert de compétences
""",
    },

    # ── IT & DIGITAL ─────────────────────────────────────────────────────────
    {
        "sector_key": "it_digital",
        "sector_label": "IT, Digital & SaaS",
        "deliverable_type": "memoire_technique",
        "title_template": "Mémoire technique — Modernisation data IT",
        "description": "Template missions data pour entreprises IT, éditeurs SaaS et pure players digital.",
        "tags": "IT,SaaS,digital,cloud,BI,analytics",
        "content_markdown": """\
# Mémoire technique — Modernisation Data IT & Digital

## 1. Compréhension du besoin

Les entreprises IT et SaaS génèrent une quantité considérable de données (usage produit, logs, événements business) souvent sous-exploitées. L'enjeu est de transformer ces données en avantage compétitif.

**Problématiques typiques :**
- Product analytics : comprendre les comportements utilisateurs pour améliorer le produit
- Revenue analytics : LTV, churn, MRR/ARR — métriques SaaS en temps réel
- Data as a Service : monétiser les données auprès des clients
- Observabilité : monitoring applicatif et infrastructure

## 2. Stack technologique recommandée

**Cloud-native & moderne :**
- Ingestion : Segment, Fivetran, custom Python connectors
- Warehouse : Snowflake / BigQuery
- Transformation : dbt Core
- Orchestration : Airflow / Prefect
- BI : Metabase / Superset (open source) ou Tableau
- ML : Python scikit-learn, MLflow pour le tracking

## 3. Roadmap product analytics

**Sprint 1–2 :** Tracking plan et instrumentation
**Sprint 3–4 :** Entrepôt de données et modèles dbt
**Sprint 5–6 :** Tableaux de bord produit et finance
**Sprint 7–8 :** Modèles prédictifs (churn, upsell)

## 4. Indicateurs clés délivrés

- DAU/MAU, session duration, feature adoption rate
- MRR, ARR, churn rate, NRR, LTV/CAC
- Funnel conversion, activation, retention (cohortes)
- Anomaly detection sur les métriques business critiques
""",
    },
    {
        "sector_key": "it_digital",
        "sector_label": "IT, Digital & SaaS",
        "deliverable_type": "offre_commerciale",
        "title_template": "Proposition commerciale — Mission Data IT/SaaS",
        "description": "Offre commerciale pour missions data dans l'IT et le SaaS.",
        "tags": "IT,SaaS,offre,prix",
        "content_markdown": """\
# Proposition commerciale — Mission Data & Analytics IT

## Résumé exécutif

DataSphere Innovation accompagne votre équipe dans la construction d'une infrastructure data moderne, scalable et orientée business. Nous livrons de la valeur dès les premières semaines.

## Notre approche : « Data-First, Sprint-Based »

Contrairement aux projets data traditionnels (18 mois, ROI incertain), notre méthode livre des résultats visibles en 4 semaines grâce à des sprints courts avec démonstration à chaque itération.

## Modules proposés

### Module 1 — Data Foundation (M+0 à M+2) — 25 000 € HT
- Audit du stack existant et benchmarks
- Architecture cible validée
- Entrepôt de données configuré (Snowflake/BigQuery)
- 5 pipelines de données critiques opérationnels

### Module 2 — Analytics Layer (M+2 à M+4) — 20 000 € HT
- Modèles dbt pour les métriques business clés
- Tableaux de bord product & finance (10 dashboards)
- Alertes automatiques sur les KPIs critiques

### Module 3 — IA & Prédictif (M+4 à M+6) — 25 000 € HT
- Modèle de prédiction churn (précision cible > 80%)
- Scoring propension à l'upsell
- Segmentation clients automatisée

**Total forfait complet : 70 000 € HT** (possibilité de démarrer par Module 1 seul)

## Garanties

- Code source livré et documenté
- Formation de l'équipe interne incluse
- 2 mois de support post-déploiement
- Satisfaction garantie : revue à M+1 avec possibilité d'ajustement
""",
    },
]


def get_builtin_templates() -> list[dict]:
    return _TEMPLATES
