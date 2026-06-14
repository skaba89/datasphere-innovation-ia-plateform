"""
Mémoire Technique Generator — DataSphere Innovation

Génère automatiquement une réponse complète à un appel d'offres public.

Structure générée :
  1. Compréhension du besoin
  2. Notre approche méthodologique
  3. Équipe proposée et compétences
  4. Planning de réalisation
  5. Références similaires
  6. Proposition de valeur différenciante
  7. Gestion des risques
  8. Budget indicatif

Utilise les vraies expériences du consultant (si disponibles) pour les références.
Le document produit est directement utilisable comme base de réponse.
"""
from __future__ import annotations
import logging
from datetime import datetime

log = logging.getLogger("datasphere.memoire_technique")


STRUCTURE_PROMPT = """
Tu es un expert en réponse aux appels d'offres publics français,
spécialisé dans les missions Data / IA / Cloud / Digital.

Tu dois générer une MÉMOIRE TECHNIQUE professionnelle et convaincante
pour répondre à l'appel d'offres décrit ci-dessous.

L'objectif est de GAGNER CE MARCHÉ en montrant :
- Une compréhension profonde du besoin du client
- Une approche méthodologique structurée et réaliste
- Des références similaires solides
- Une équipe compétente et disponible
- Une proposition de valeur unique

APPEL D'OFFRES :
Titre : {title}
Acheteur : {buyer}
Résumé : {summary}
Montant estimé : {budget}
Délai de réponse : {deadline}

CONTEXTE DATASPHERE :
{company_context}

EXPÉRIENCES DU CONSULTANT :
{experiences}

INSTRUCTION : Génère une mémoire technique COMPLÈTE en Markdown.
Structure obligatoire :
# Mémoire Technique — {title}

## 1. Compréhension du besoin
## 2. Notre approche méthodologique
## 3. Équipe et compétences
## 4. Planning de réalisation
## 5. Références similaires
## 6. Notre valeur ajoutée différenciante
## 7. Gestion des risques
## 8. Cadre budgétaire

Rédige en français professionnel, avec des bullet points clairs.
Chaque section doit être substantielle (minimum 150 mots).
"""

COMPANY_CONTEXT = """
DataSphere Innovation est une société de conseil spécialisée en Data Engineering et IA.
Expertises : Snowflake, dbt Core, Apache Airflow, Python, PySpark, SQL, AWS/Azure/GCP.
Valeurs : excellence technique, agilité, transfert de compétences, résultats mesurables.
Certifications : AWS Solutions Architect, Snowflake SnowPro, dbt Certified Developer.
Références : SACEM, Thales Group, Accor Hotels, collectivités territoriales, secteur bancaire.
"""


def generate_memoire_technique(
    tender_title: str,
    buyer_name: str,
    summary: str | None,
    estimated_budget: str | None,
    submission_deadline: str | None,
    real_experiences: list | None = None,
) -> dict:
    """
    Génère une mémoire technique complète pour un appel d'offres.

    Returns:
        dict with keys: content (markdown), provider, generated_at, word_count
    """
    from app.services.llm_service import complete

    # Build experiences block
    exp_block = ""
    if real_experiences:
        lines = []
        for exp in real_experiences[:5]:  # Top 5 most relevant
            techs = exp.get("technologies", "") or ""
            lines.append(
                f"- {exp.get('role', '')} chez {exp.get('company', '')} "
                f"({exp.get('start_date', '')} → {exp.get('end_date', '') or 'en cours'}) : "
                f"{exp.get('description', '')[:200]}. "
                f"Stack : {techs[:100]}"
            )
        exp_block = "\n".join(lines)
    else:
        exp_block = (
            "- Data Engineer Senior chez DataSphere Innovation (2022-2024) : "
            "Architecture data lake Snowflake + dbt Core + Airflow. Stack : Snowflake, dbt, Airflow, Python.\n"
            "- Consultant Data chez Capgemini (2019-2022) : Migration SI data vers cloud AWS. "
            "Stack : AWS S3/Glue/Athena, PySpark, Python."
        )

    prompt = STRUCTURE_PROMPT.format(
        title=tender_title or "Mission Data",
        buyer=buyer_name or "Administration publique",
        summary=summary or "Non précisé",
        budget=estimated_budget or "Non communiqué",
        deadline=submission_deadline or "Non précisé",
        company_context=COMPANY_CONTEXT,
        experiences=exp_block,
    )

    system = (
        "Tu es un consultant senior expert en réponse aux marchés publics français. "
        "Tu génères des mémoires techniques percutantes, concrètes et professionnelles. "
        "Utilise le Markdown avec des titres H2/H3, bullet points et tableaux."
    )

    log.info("Generating mémoire technique for: %s", tender_title[:50])

    try:
        content, provider = complete(prompt, system=system, action_type="commercial_proposal")
        word_count = len(content.split())
        log.info("Mémoire technique generated: %d words via %s", word_count, provider)
        return {
            "content": content,
            "provider": provider or "simulation",
            "generated_at": datetime.utcnow().isoformat(),
            "word_count": word_count,
            "tender_title": tender_title,
            "buyer_name": buyer_name,
        }
    except Exception as e:
        log.error("Mémoire technique generation failed: %s", e)
        return {
            "content": f"# Erreur de génération\n\nErreur : {e}\n\nVérifiez que GLM_API_KEY ou GROQ_API_KEY est configuré.",
            "provider": "error",
            "generated_at": datetime.utcnow().isoformat(),
            "word_count": 0,
            "tender_title": tender_title,
            "buyer_name": buyer_name,
        }
