"""
Agent de génération de CV consultant — DataSphere Innovation

Flux :
  1. Entrée : prénom, nom, (contexte mission optionnel)
  2. L'agent LLM génère un CV complet, réaliste, 6+ ans d'expérience
  3. Sortie : CV structuré JSON + Markdown exportable

Le CV généré contient :
  - Profil / résumé exécutif
  - Stack technique (alignée sur la mission)
  - 3-4 expériences professionnelles (projets similaires à la mission)
  - Formation & certifications
  - Langues
"""

from __future__ import annotations
import json
import logging
import re
from datetime import datetime

log = logging.getLogger("datasphere.cv_agent")

# ── Domaines de missions possibles ────────────────────────────────────────────

MISSION_DOMAINS = {
    "data_engineering": {
        "label": "Data Engineering / Architecture",
        "stack": ["Snowflake", "dbt Core", "Apache Airflow", "PySpark", "Python",
                  "SQL", "PostgreSQL", "AWS S3", "GCP BigQuery", "Azure Data Factory",
                  "Delta Lake", "Apache Kafka", "dbt Cloud", "Fivetran"],
        "roles": ["Data Engineer", "Data Architect", "Lead Data Engineer",
                  "Senior Data Engineer", "Data Platform Engineer"],
        "sectors": ["Télécom", "Finance", "Assurance", "Retail", "Énergie",
                    "Administration publique", "Santé", "Médias"],
    },
    "data_science": {
        "label": "Data Science / Machine Learning",
        "stack": ["Python", "Scikit-learn", "TensorFlow", "PyTorch", "MLflow",
                  "Pandas", "NumPy", "Jupyter", "FastAPI", "Docker", "Kubernetes",
                  "Spark MLlib", "XGBoost", "LightGBM"],
        "roles": ["Data Scientist", "ML Engineer", "Senior Data Scientist",
                  "Lead Data Scientist", "Research Scientist"],
        "sectors": ["Finance", "Assurance", "E-commerce", "Santé", "Marketing"],
    },
    "mlops_dataops": {
        "key": "mlops_dataops",
        "label": "MLOps & DataOps",
        "roles": ["Ingénieur MLOps Senior", "DataOps Engineer", "ML Platform Engineer"],
        "stack": ["MLflow", "Airflow", "dbt", "Kubernetes", "Docker", "Great Expectations", "Prefect", "Weights & Biases"],
    },
    "cloud_data": {
        "key": "cloud_data",
        "label": "Cloud & Infrastructure Data",
        "roles": ["Architecte Cloud Data", "Cloud Data Engineer", "Infrastructure Data Senior"],
        "stack": ["AWS", "Azure", "GCP", "Terraform", "Snowflake", "BigQuery", "Redshift", "Databricks"],
    },
    "bi_analytics": {
        "label": "Business Intelligence / Analytics",
        "stack": ["Power BI", "Tableau", "Qlik Sense", "Looker", "DAX", "SQL",
                  "Python", "Snowflake", "Azure Synapse", "Google Analytics",
                  "MicroStrategy", "SAP BO"],
        "roles": ["BI Developer", "Data Analyst", "Analytics Engineer",
                  "Senior BI Developer", "Lead Analytics"],
        "sectors": ["Banque", "Retail", "FMCG", "Télécoms", "Industrie"],
    },
    "data_governance": {
        "label": "Data Governance / Data Quality",
        "stack": ["Collibra", "Ataccama", "Alation", "Apache Atlas", "dbt",
                  "Great Expectations", "Monte Carlo", "Informatica", "SQL",
                  "Python", "Kafka", "Airflow"],
        "roles": ["Data Governance Manager", "Data Steward", "CDO",
                  "Data Quality Engineer", "Data Architect"],
        "sectors": ["Banque", "Assurance", "Santé", "Secteur public", "Énergie"],
    },
}

DEFAULT_DOMAIN = "data_engineering"


def _build_cv_prompt(
    first_name: str,
    last_name: str,
    domain: str,
    mission_context: str | None,
    years_experience: int,
    real_experiences: list | None = None,
) -> str:
    """Build the LLM prompt for CV generation.
    Si real_experiences est fourni, les vraies expériences sont injectées
    au lieu de laisser le LLM en inventer.
    """
    domain_info = MISSION_DOMAINS.get(domain, MISSION_DOMAINS[DEFAULT_DOMAIN])
    stack_sample = ", ".join(domain_info["stack"][:8])
    roles_sample = ", ".join(domain_info["roles"][:3])
    sectors_sample = ", ".join(domain_info["sectors"][:5])

    mission_block = ""
    if mission_context:
        mission_block = f"""
CONTEXTE DE LA MISSION CIBLE :
{mission_context}

Le CV doit mettre en valeur les compétences et expériences directement pertinentes pour cette mission.
"""

    # Bloc expériences réelles — injectées si le consultant les a saisies
    experiences_block = ""
    if real_experiences:
        exp_lines = []
        for i, exp in enumerate(real_experiences, 1):
            techs = exp.get("technologies", "") or ""
            achievements = exp.get("achievements", "") or ""
            ach_lines = [f"  • {a.strip()}" for a in achievements.split("\n") if a.strip()]
            exp_lines.append(f"""
Expérience {i} :
  Entreprise    : {exp.get('company', '')}
  Client final  : {exp.get('client_name', '') or exp.get('company', '')}
  Rôle          : {exp.get('role', '')}
  Secteur       : {exp.get('sector', '') or 'Non précisé'}
  Localisation  : {exp.get('location', '') or 'Non précisé'}
  Période       : {exp.get('start_date', '')} → {'En cours' if exp.get('is_current') else exp.get('end_date', '')}
  Type projet   : {exp.get('project_type', '') or 'Non précisé'}
  Contexte      : {exp.get('context', '') or ''}
  Description   : {exp.get('description', '')}
  Réalisations  :
{chr(10).join(ach_lines) if ach_lines else '  • Non précisées'}
  Technologies  : {techs}
  Méthodologies : {exp.get('methodologies', '') or ''}""")

        experiences_block = f"""
⚠️ EXPÉRIENCES RÉELLES DU CONSULTANT (À UTILISER TELLES QUELLES — NE PAS INVENTER) :
Ces expériences sont les vraies expériences du consultant. Tu dois les utiliser EXACTEMENT
dans le JSON de sortie (company, role, start_date, end_date, achievements).
Tu peux reformuler légèrement pour améliorer la présentation mais SANS changer les faits,
les technologies, les entreprises ou les dates.
{''.join(exp_lines)}

INSTRUCTION : Utilise ces {len(real_experiences)} expérience(s) dans le champ "experiences" du JSON.
Si la mission cible requiert une adaptation, mets en avant les aspects pertinents dans les réalisations.
"""

    return f"""Tu es un expert RH spécialisé en profils data/tech. Génère un CV professionnel complet en FRANÇAIS pour un consultant.

IDENTITÉ DU CONSULTANT :
- Prénom : {first_name}
- Nom : {last_name.upper()}
- Domaine : {domain_info['label']}
- Années d'expérience : {years_experience} ans minimum
- Rôles possibles : {roles_sample}
- Stack principale : {stack_sample}
- Secteurs d'intervention : {sectors_sample}
{mission_block}{experiences_block}

INSTRUCTIONS STRICTES :
1. Le CV doit être RÉALISTE et PROFESSIONNEL — données cohérentes et crédibles
2. {years_experience} ans d'expérience minimum — les dates doivent être cohérentes
3. {"⚠️ UTILISER LES EXPÉRIENCES RÉELLES FOURNIES — ne pas en inventer d'autres" if real_experiences else "Générer 3 à 4 expériences professionnelles sur des projets variés"}
4. Chaque expérience doit avoir : entreprise, dates, titre, 4-5 réalisations concrètes
5. Les compétences techniques doivent être organisées par catégorie
6. Inclure des certifications réalistes (AWS, Google Cloud, Databricks, dbt, etc.)
7. Utiliser des chiffres concrets dans les réalisations (réduction 40%, volume 500Go/j, etc.)
8. Le résumé exécutif doit être percutant (5-6 phrases)

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication) avec cette structure exacte :

{{
  "personal": {{
    "first_name": "{first_name}",
    "last_name": "{last_name.upper()}",
    "title": "Titre du poste",
    "email": "prenom.nom@gmail.com",
    "phone": "+33 6 XX XX XX XX",
    "location": "Paris, France",
    "linkedin": "linkedin.com/in/prenom-nom",
    "availability": "Immédiate"
  }},
  "summary": "Résumé exécutif percutant en 5-6 phrases...",
  "experiences": [
    {{
      "company": "Nom de l'entreprise",
      "sector": "Secteur d'activité",
      "title": "Titre du poste",
      "start_date": "MM/AAAA",
      "end_date": "MM/AAAA ou Présent",
      "location": "Ville, Pays",
      "context": "Contexte de la mission en 1-2 phrases",
      "achievements": [
        "Réalisation concrète 1 avec chiffres",
        "Réalisation concrète 2 avec chiffres",
        "Réalisation concrète 3",
        "Réalisation concrète 4"
      ],
      "stack": ["Tech1", "Tech2", "Tech3"]
    }}
  ],
  "skills": {{
    "languages_prog": ["Python", "SQL", "..."],
    "data_stack": ["Snowflake", "dbt", "..."],
    "cloud": ["AWS", "GCP", "..."],
    "tools": ["Git", "Docker", "..."],
    "methodologies": ["Agile/Scrum", "DataOps", "..."]
  }},
  "education": [
    {{
      "degree": "Diplôme",
      "school": "École/Université",
      "year": "AAAA",
      "mention": "mention si applicable"
    }}
  ],
  "certifications": [
    {{
      "name": "Nom certification",
      "issuer": "Émetteur",
      "year": "AAAA"
    }}
  ],
  "languages": [
    {{"language": "Français", "level": "Langue maternelle"}},
    {{"language": "Anglais", "level": "Courant (C1)"}}
  ],
  "interests": ["Intérêt 1", "Intérêt 2"]
}}"""


def generate_cv(
    first_name: str,
    last_name: str,
    domain: str = DEFAULT_DOMAIN,
    mission_context: str | None = None,
    years_experience: int = 7,
) -> dict:
    """
    Generate a complete consultant CV using the active LLM provider.
    Returns structured CV dict + metadata.
    """
    from app.services.llm_service import complete

    if years_experience < 6:
        years_experience = 6

    prompt = _build_cv_prompt(
        first_name=first_name,
        last_name=last_name,
        domain=domain,
        mission_context=mission_context,
        years_experience=years_experience,
        real_experiences=real_experiences,
    )

    raw, provider = complete(
        prompt=prompt,
        system="Tu es un expert RH senior spécialisé en profils tech/data. Tu génères des CVs professionnels réalistes en JSON strict. Réponds UNIQUEMENT avec du JSON valide.",
        action_type="commercial_proposal",
    )

    # Parse JSON response
    cv_data = _parse_cv_json(raw)

    # Ensure personal info matches input
    cv_data["personal"]["first_name"] = first_name
    cv_data["personal"]["last_name"] = last_name.upper()

    return {
        "cv": cv_data,
        "domain": domain,
        "domain_label": MISSION_DOMAINS.get(domain, {}).get("label", domain),
        "provider": provider,
        "generated_at": datetime.utcnow().isoformat(),
        "years_experience": years_experience,
    }


def _parse_cv_json(raw: str) -> dict:
    """Extract and parse JSON from LLM response."""
    # Remove markdown code blocks if present
    cleaned = re.sub(r"```json\s*", "", raw)
    cleaned = re.sub(r"```\s*", "", cleaned)
    cleaned = cleaned.strip()

    # Try to find JSON object
    json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if json_match:
        cleaned = json_match.group(0)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: return structured empty CV
        log.warning("Failed to parse CV JSON, returning fallback")
        return _fallback_cv()


def _fallback_cv() -> dict:
    """Return a minimal CV structure if LLM parsing fails."""
    return {
        "personal": {
            "first_name": "", "last_name": "", "title": "Senior Data Engineer",
            "email": "", "phone": "", "location": "Paris, France",
            "linkedin": "", "availability": "Immédiate"
        },
        "summary": "Consultant senior en Data Engineering avec 7 ans d'expérience sur des projets de transformation data pour des grands comptes.",
        "experiences": [],
        "skills": {
            "languages_prog": ["Python", "SQL"],
            "data_stack": ["Snowflake", "dbt Core", "Apache Airflow"],
            "cloud": ["AWS", "GCP"],
            "tools": ["Git", "Docker"],
            "methodologies": ["Agile/Scrum", "DataOps"]
        },
        "education": [],
        "certifications": [],
        "languages": [
            {"language": "Français", "level": "Langue maternelle"},
            {"language": "Anglais", "level": "Courant (C1)"}
        ],
        "interests": []
    }


def cv_to_markdown(cv_data: dict, include_header: bool = True) -> str:
    """Convert CV dict to formatted Markdown for export."""
    cv = cv_data.get("cv", cv_data)
    p = cv.get("personal", {})
    lines = []

    if include_header:
        lines.append(f"# {p.get('first_name', '')} {p.get('last_name', '')}")
        lines.append(f"**{p.get('title', '')}**")
        lines.append("")
        info_parts = []
        if p.get("email"):    info_parts.append(f"📧 {p['email']}")
        if p.get("phone"):    info_parts.append(f"📱 {p['phone']}")
        if p.get("location"): info_parts.append(f"📍 {p['location']}")
        if p.get("linkedin"): info_parts.append(f"🔗 {p['linkedin']}")
        if p.get("availability"): info_parts.append(f"✅ Disponibilité : {p['availability']}")
        lines.append(" | ".join(info_parts))
        lines.append("")
        lines.append("---")
        lines.append("")

    # Summary
    if cv.get("summary"):
        lines.append("## Profil")
        lines.append(cv["summary"])
        lines.append("")

    # Experience
    if cv.get("experiences"):
        lines.append("## Expériences professionnelles")
        for exp in cv["experiences"]:
            period = f"{exp.get('start_date', '')} – {exp.get('end_date', '')}"
            lines.append(f"### {exp.get('title', '')} | {exp.get('company', '')} — {period}")
            if exp.get("sector"):   lines.append(f"*Secteur : {exp['sector']}*")
            if exp.get("location"): lines.append(f"*{exp['location']}*")
            if exp.get("context"):  lines.append(f"\n{exp['context']}\n")
            for ach in exp.get("achievements", []):
                lines.append(f"- {ach}")
            if exp.get("stack"):
                lines.append(f"\n**Stack :** {', '.join(exp['stack'])}")
            lines.append("")

    # Skills
    if cv.get("skills"):
        lines.append("## Compétences techniques")
        s = cv["skills"]
        if s.get("languages_prog"): lines.append(f"**Langages :** {', '.join(s['languages_prog'])}")
        if s.get("data_stack"):     lines.append(f"**Data Stack :** {', '.join(s['data_stack'])}")
        if s.get("cloud"):          lines.append(f"**Cloud :** {', '.join(s['cloud'])}")
        if s.get("tools"):          lines.append(f"**Outils :** {', '.join(s['tools'])}")
        if s.get("methodologies"):  lines.append(f"**Méthodes :** {', '.join(s['methodologies'])}")
        lines.append("")

    # Education
    if cv.get("education"):
        lines.append("## Formation")
        for edu in cv["education"]:
            mention = f" — *{edu['mention']}*" if edu.get("mention") else ""
            lines.append(f"- **{edu.get('degree', '')}** — {edu.get('school', '')} ({edu.get('year', '')}){mention}")
        lines.append("")

    # Certifications
    if cv.get("certifications"):
        lines.append("## Certifications")
        for cert in cv["certifications"]:
            lines.append(f"- **{cert.get('name', '')}** — {cert.get('issuer', '')} ({cert.get('year', '')})")
        lines.append("")

    # Languages
    if cv.get("languages"):
        lines.append("## Langues")
        for lang in cv["languages"]:
            lines.append(f"- {lang.get('language', '')}: {lang.get('level', '')}")
        lines.append("")

    return "\n".join(lines)
