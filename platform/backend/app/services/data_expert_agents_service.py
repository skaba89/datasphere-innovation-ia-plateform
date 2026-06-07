from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class AgentDeliverable:
    name: str
    description: str
    content: dict


DATA_ENGINEER_KEYWORDS = {
    "airflow", "api", "cdc", "data", "databricks", "dbt", "etl", "elt", "kafka",
    "lakehouse", "minio", "pipeline", "postgresql", "snowflake", "warehouse", "orchestration",
}

DATA_ANALYST_KEYWORDS = {
    "analytics", "bi", "dashboard", "kpi", "metabase", "power", "reporting", "sql",
    "superset", "tableau", "visualisation", "analyse", "indicateur",
}


def _terms(*values: str) -> set[str]:
    text = " ".join(values).lower().replace("/", " ").replace(",", " ").replace(";", " ")
    return {term.strip() for term in text.split() if len(term.strip()) > 2}


def _extract_keywords(context: str) -> set[str]:
    terms = _terms(context)
    return terms.intersection(DATA_ENGINEER_KEYWORDS.union(DATA_ANALYST_KEYWORDS))


def run_data_engineer_agent(*, project_title: str, context: str, requirements: list[str] | None = None) -> dict:
    requirement_text = "\n".join(requirements or [])
    keywords = _extract_keywords(f"{project_title} {context} {requirement_text}")
    detected_stack = sorted(keywords.intersection(DATA_ENGINEER_KEYWORDS)) or ["postgresql", "airflow", "dbt", "api"]

    deliverables = [
        AgentDeliverable(
            name="Architecture data cible",
            description="Proposition d'architecture technique pour l'ingestion, le stockage, la transformation et l'exposition des données.",
            content={
                "layers": ["source", "ingestion", "bronze", "silver", "gold", "serving", "observability"],
                "recommended_stack": detected_stack,
                "principles": [
                    "Séparer ingestion, transformation et exposition.",
                    "Tracer les traitements et historiser les chargements.",
                    "Prévoir orchestration, monitoring et rejeu des pipelines.",
                ],
            },
        ),
        AgentDeliverable(
            name="Plan pipelines",
            description="Découpage des flux data à construire.",
            content={
                "pipelines": [
                    {"name": "Ingestion sources", "mode": "batch/API/CDC", "priority": "high"},
                    {"name": "Qualité et normalisation", "mode": "dbt/tests", "priority": "high"},
                    {"name": "Agrégats métier", "mode": "gold marts", "priority": "medium"},
                    {"name": "Exposition BI/API", "mode": "SQL/API", "priority": "medium"},
                ]
            },
        ),
        AgentDeliverable(
            name="Backlog Data Engineer",
            description="Backlog technique initial exploitable par l'équipe delivery.",
            content={
                "user_stories": [
                    "En tant que data engineer, je veux connecter les sources identifiées afin d'automatiser l'ingestion.",
                    "En tant que data engineer, je veux créer les couches bronze/silver/gold afin de fiabiliser les usages analytiques.",
                    "En tant que tech lead, je veux monitorer les DAGs et les erreurs afin de garantir l'exploitation.",
                ],
                "risks": ["Qualité source insuffisante", "Volumes mal estimés", "Accès aux environnements retardé"],
            },
        ),
    ]

    return {
        "agent": "DATA_ENGINEER",
        "project_title": project_title,
        "generated_at": date.today().isoformat(),
        "detected_keywords": sorted(keywords),
        "summary": "Analyse Data Engineer générée à partir du contexte projet et des exigences disponibles.",
        "deliverables": [deliverable.__dict__ for deliverable in deliverables],
    }


def run_data_analyst_agent(*, project_title: str, context: str, requirements: list[str] | None = None) -> dict:
    requirement_text = "\n".join(requirements or [])
    keywords = _extract_keywords(f"{project_title} {context} {requirement_text}")
    detected_stack = sorted(keywords.intersection(DATA_ANALYST_KEYWORDS)) or ["sql", "dashboard", "kpi", "superset"]

    deliverables = [
        AgentDeliverable(
            name="Cadrage analytique",
            description="Traduction du besoin en axes d'analyse et questions métier.",
            content={
                "business_questions": [
                    "Quels indicateurs doivent être suivis par la direction ?",
                    "Quels segments, périodes et dimensions doivent filtrer les analyses ?",
                    "Quels seuils d'alerte doivent déclencher une action ?",
                ],
                "recommended_stack": detected_stack,
            },
        ),
        AgentDeliverable(
            name="Catalogue KPI",
            description="Première proposition d'indicateurs métier.",
            content={
                "kpis": [
                    {"name": "Volume traité", "definition": "Nombre d'enregistrements ou dossiers traités", "priority": "high"},
                    {"name": "Taux de conformité", "definition": "Part des éléments conformes aux règles métier", "priority": "high"},
                    {"name": "Délai moyen", "definition": "Temps moyen entre création et clôture", "priority": "medium"},
                    {"name": "Taux d'anomalie", "definition": "Part des éléments en erreur ou à corriger", "priority": "high"},
                ]
            },
        ),
        AgentDeliverable(
            name="Maquette dashboard",
            description="Structure de dashboard recommandée.",
            content={
                "pages": [
                    {"name": "Vue exécutive", "charts": ["Big numbers", "tendance", "répartition"]},
                    {"name": "Analyse opérationnelle", "charts": ["table détaillée", "filtres", "statuts"]},
                    {"name": "Qualité des données", "charts": ["anomalies", "complétude", "fraîcheur"]},
                ],
                "filters": ["période", "organisation", "statut", "secteur", "responsable"],
            },
        ),
    ]

    return {
        "agent": "DATA_ANALYST",
        "project_title": project_title,
        "generated_at": date.today().isoformat(),
        "detected_keywords": sorted(keywords),
        "summary": "Analyse Data Analyst générée à partir du contexte projet et des exigences disponibles.",
        "deliverables": [deliverable.__dict__ for deliverable in deliverables],
    }


def run_data_expert_agents(*, project_title: str, context: str, requirements: list[str] | None = None) -> dict:
    engineer = run_data_engineer_agent(project_title=project_title, context=context, requirements=requirements)
    analyst = run_data_analyst_agent(project_title=project_title, context=context, requirements=requirements)
    return {
        "project_title": project_title,
        "generated_at": date.today().isoformat(),
        "agents": [engineer, analyst],
        "combined_recommendations": [
            "Valider les sources de données, les accès et la fréquence de mise à jour.",
            "Définir les KPIs prioritaires avec les métiers avant la construction des dashboards.",
            "Mettre en place une gouvernance qualité dès les premières itérations.",
            "Aligner backlog data engineering et backlog analytique pour éviter les dashboards non alimentés.",
        ],
    }
