from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class ConsultantProfile:
    id: int
    full_name: str
    role: str
    seniority: str
    daily_rate: float
    availability_percent: int
    location: str
    skills: list[str]
    certifications: list[str]
    languages: list[str]
    references: list[str]


CONSULTANT_POOL: list[ConsultantProfile] = [
    ConsultantProfile(
        id=1,
        full_name="Cheickna Kaba",
        role="Architecte Data / Tech Lead IA",
        seniority="Senior",
        daily_rate=750,
        availability_percent=80,
        location="France / Guinée",
        skills=["data", "ia", "architecture", "airflow", "dbt", "snowflake", "postgresql", "superset", "cloud"],
        certifications=["Data Architecture", "Cloud Data Platform"],
        languages=["français", "anglais"],
        references=["Banque", "Institution publique", "Plateforme data"],
    ),
    ConsultantProfile(
        id=2,
        full_name="Aminata Diallo",
        role="Cheffe de projet digital",
        seniority="Senior",
        daily_rate=620,
        availability_percent=65,
        location="Conakry",
        skills=["pmo", "digital", "portail", "workflow", "gouvernance", "formation", "conduite du changement"],
        certifications=["Prince2", "Agile"],
        languages=["français", "soussou", "anglais"],
        references=["Administration publique", "Ministère", "Transformation digitale"],
    ),
    ConsultantProfile(
        id=3,
        full_name="Mamadou Bah",
        role="Data Engineer Senior",
        seniority="Confirmé",
        daily_rate=520,
        availability_percent=90,
        location="Remote / Conakry",
        skills=["data", "pipeline", "postgresql", "python", "etl", "api", "minio", "airflow", "dbt"],
        certifications=["Python Data Engineering"],
        languages=["français", "poular"],
        references=["Pipeline data", "BI", "Secteur public"],
    ),
    ConsultantProfile(
        id=4,
        full_name="Fatou Camara",
        role="Experte BI / Dashboard",
        seniority="Confirmé",
        daily_rate=480,
        availability_percent=75,
        location="France / Remote",
        skills=["bi", "dashboard", "superset", "power bi", "sql", "kpi", "reporting", "analytics"],
        certifications=["Power BI", "SQL Analytics"],
        languages=["français", "anglais"],
        references=["Tableaux de bord", "Reporting direction", "Banque"],
    ),
    ConsultantProfile(
        id=5,
        full_name="Ibrahima Sylla",
        role="Expert cybersécurité / IAM",
        seniority="Senior",
        daily_rate=690,
        availability_percent=45,
        location="Remote",
        skills=["sécurité", "cybersécurité", "iam", "audit", "rgpd", "jwt", "rbac", "cloud"],
        certifications=["ISO 27001", "Security Architecture"],
        languages=["français", "anglais"],
        references=["Audit sécurité", "Administration", "Banque"],
    ),
]

STRATEGIC_SKILLS = {
    "airflow", "analytics", "api", "architecture", "azure", "bi", "cloud", "cybersécurité",
    "dashboard", "data", "databricks", "dbt", "digital", "gouvernance", "ia", "iam",
    "kpi", "pipeline", "postgresql", "power", "python", "reporting", "sécurité",
    "snowflake", "sql", "superset", "workflow",
}


def _normalize_terms(*values: str) -> set[str]:
    text = " ".join(values).lower().replace("/", " ").replace(",", " ").replace(";", " ")
    return {term.strip() for term in text.split() if len(term.strip()) > 2}


def _candidate_terms(profile: ConsultantProfile) -> set[str]:
    return _normalize_terms(
        profile.role,
        profile.seniority,
        profile.location,
        " ".join(profile.skills),
        " ".join(profile.certifications),
        " ".join(profile.languages),
        " ".join(profile.references),
    )


def _required_skills(title: str, sector: str, summary: str, requirements: list[str] | None) -> set[str]:
    tender_terms = _normalize_terms(title, sector, summary, " ".join(requirements or []))
    strategic_matches = tender_terms.intersection(STRATEGIC_SKILLS)
    if strategic_matches:
        return strategic_matches
    return {term for term in tender_terms if term in {"data", "digital", "architecture", "sécurité", "cloud", "dashboard"}}


def analyze_staffing_gaps(required_skills: set[str], matches: list[dict]) -> dict:
    covered_skills = set()
    for item in matches:
      covered_skills.update(item["consultant"]["skills"])
      covered_skills.update(item.get("matched_terms", []))

    covered_required_skills = sorted(required_skills.intersection(covered_skills))
    missing_skills = sorted(required_skills.difference(covered_skills))
    coverage_rate = round((len(covered_required_skills) / len(required_skills)) * 100) if required_skills else 100

    if not missing_skills:
        actions = ["Aucune compétence critique manquante détectée."]
    else:
        actions = [
            f"Prévoir sous-traitance ou renfort ponctuel sur : {', '.join(missing_skills)}.",
            "Vérifier les CV et références avant engagement commercial.",
            "Ajouter une action de recrutement si le besoin est récurrent.",
        ]

    return {
        "required_skills": sorted(required_skills),
        "covered_skills": covered_required_skills,
        "missing_skills": missing_skills,
        "coverage_rate": coverage_rate,
        "recommended_actions": actions,
    }


def match_consultants_for_tender(
    *,
    title: str,
    sector: str,
    summary: str,
    requirements: list[str] | None = None,
    max_results: int = 5,
) -> list[dict]:
    tender_terms = _normalize_terms(title, sector, summary, " ".join(requirements or []))
    matches: list[dict] = []

    for profile in CONSULTANT_POOL:
        profile_terms = _candidate_terms(profile)
        matched_terms = sorted(tender_terms.intersection(profile_terms))
        skill_score = min(len(matched_terms) * 9, 70)
        availability_score = min(profile.availability_percent, 100) * 0.20
        seniority_bonus = 10 if profile.seniority.lower() == "senior" else 6
        reference_bonus = 8 if any(ref.lower() in " ".join([title, sector, summary]).lower() for ref in profile.references) else 0
        total_score = round(min(skill_score + availability_score + seniority_bonus + reference_bonus, 100))

        if total_score >= 20:
            matches.append(
                {
                    "consultant": asdict(profile),
                    "match_score": total_score,
                    "matched_terms": matched_terms,
                    "recommendation": "PRIMARY" if total_score >= 70 else "BACKUP" if total_score >= 45 else "TO_REVIEW",
                    "rationale": [
                        f"Compétences communes détectées : {', '.join(matched_terms[:8]) or 'à qualifier'}.",
                        f"Disponibilité estimée : {profile.availability_percent}%.",
                        f"Positionnement : {profile.role} ({profile.seniority}).",
                    ],
                }
            )

    return sorted(matches, key=lambda item: item["match_score"], reverse=True)[:max_results]


def build_staffing_recommendation(
    *,
    title: str,
    sector: str,
    summary: str,
    requirements: list[str] | None = None,
    max_results: int = 5,
) -> dict:
    matches = match_consultants_for_tender(
        title=title,
        sector=sector,
        summary=summary,
        requirements=requirements,
        max_results=max_results,
    )
    required_skills = _required_skills(title, sector, summary, requirements)
    gap_analysis = analyze_staffing_gaps(required_skills, matches)
    global_team_score = round(sum(item["match_score"] for item in matches) / len(matches)) if matches else 0
    primary_count = sum(1 for item in matches if item["recommendation"] == "PRIMARY")
    summary_text = (
        f"{len(matches)} consultant(s) recommandé(s), dont {primary_count} profil(s) principal(aux). "
        f"Score équipe moyen : {global_team_score}/100. Couverture compétences : {gap_analysis['coverage_rate']}/100."
    )
    return {
        "recommended_team": matches,
        "global_team_score": global_team_score,
        "summary": summary_text,
        "gap_analysis": gap_analysis,
    }
