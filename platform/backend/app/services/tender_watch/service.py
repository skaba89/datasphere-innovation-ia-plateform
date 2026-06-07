from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from hashlib import sha1

from app.services.tender_watch.scoring import score_tender_candidate


@dataclass(frozen=True)
class TenderWatchCandidate:
    title: str
    reference: str
    buyer_name: str
    country: str
    sector: str
    source_name: str
    source_url: str
    summary: str
    estimated_value: float
    deadline: str | None
    requirements: list[str]


BASE_SOURCES: list[TenderWatchCandidate] = [
    TenderWatchCandidate(
        title="Modernisation de la plateforme data et analytique nationale",
        reference="WATCH-BCRG-DATA",
        buyer_name="Banque Centrale de Guinée",
        country="Guinée",
        sector="Banque / Institution publique",
        source_name="Veille BCRG",
        source_url="https://www.bcrg-guinee.org/",
        estimated_value=850000,
        deadline=None,
        summary=(
            "Projet de modernisation data : ingestion multi-sources, entrepôt de données, "
            "tableaux de bord, gouvernance, sécurité et assistance IA."
        ),
        requirements=[
            "Mettre en place une architecture data sécurisée et scalable.",
            "Intégrer les sources internes et externes dans un pipeline fiable.",
            "Produire des tableaux de bord exécutifs et opérationnels.",
            "Prévoir la gouvernance, l’audit et la traçabilité des données.",
        ],
    ),
    TenderWatchCandidate(
        title="Mise en œuvre d’un portail numérique de services publics",
        reference="WATCH-GOV-PORTAL",
        buyer_name="Ministère de la Transformation Digitale",
        country="Guinée",
        sector="Administration publique",
        source_name="Veille ministères",
        source_url="https://www.gouvernement.gov.gn/",
        estimated_value=620000,
        deadline=None,
        summary=(
            "Plateforme web et mobile pour digitaliser les démarches administratives, "
            "avec back-office, authentification, workflow et reporting."
        ),
        requirements=[
            "Concevoir un portail web responsive et un back-office sécurisé.",
            "Mettre en place l’authentification et la gestion des rôles.",
            "Suivre les demandes citoyennes via des workflows configurables.",
            "Fournir des indicateurs de performance et de qualité de service.",
        ],
    ),
    TenderWatchCandidate(
        title="Déploiement d’une solution IA pour l’analyse documentaire",
        reference="WATCH-AI-DOCS",
        buyer_name="Agence Nationale de Digitalisation",
        country="Guinée",
        sector="IA / Transformation digitale",
        source_name="Veille innovation publique",
        source_url="https://example.org/opportunities/ai-documents",
        estimated_value=430000,
        deadline=None,
        summary=(
            "Solution d’analyse automatique de documents, extraction d’informations, "
            "recherche sémantique et génération de synthèses contrôlées."
        ),
        requirements=[
            "Indexer les documents PDF, DOCX et tableurs.",
            "Mettre en place une recherche sémantique avec contrôle des accès.",
            "Générer des résumés, risques et recommandations.",
            "Assurer la confidentialité et la journalisation des usages IA.",
        ],
    ),
    TenderWatchCandidate(
        title="Assistance technique pour une plateforme BI et pilotage projets",
        reference="WATCH-BI-PMO",
        buyer_name="Agence de Développement Numérique",
        country="Guinée",
        sector="Business Intelligence / PMO",
        source_name="Veille bailleurs et institutions",
        source_url="https://example.org/opportunities/bi-pmo",
        estimated_value=510000,
        deadline=None,
        summary=(
            "Mission d’assistance technique pour structurer un dispositif BI, "
            "suivre les projets prioritaires et produire des indicateurs direction générale."
        ),
        requirements=[
            "Définir un modèle de données décisionnel.",
            "Mettre en place des dashboards exécutifs.",
            "Former les équipes internes à l’exploitation des indicateurs.",
            "Documenter les processus de gouvernance et d’exploitation.",
        ],
    ),
]


def _matches(candidate: TenderWatchCandidate, query: str) -> bool:
    if not query.strip():
        return True
    haystack = " ".join(
        [candidate.title, candidate.buyer_name, candidate.country, candidate.sector, candidate.summary]
    ).lower()
    terms = [term.strip().lower() for term in query.replace(",", " ").split() if term.strip()]
    return any(term in haystack for term in terms)


def discover_tenders(query: str = "", limit: int = 20) -> list[dict]:
    """Return normalized tender candidates enriched with Go/No-Go scoring.

    This deterministic implementation is safe for local demos and CI.
    Real source connectors can later enrich BASE_SOURCES without changing the API contract.
    """
    today = date.today().strftime("%Y%m%d")
    selected = [candidate for candidate in BASE_SOURCES if _matches(candidate, query)][:limit]
    results: list[dict] = []

    for candidate in selected:
        fingerprint = sha1(f"{candidate.reference}:{query}:{today}".encode("utf-8")).hexdigest()[:8].upper()
        scoring = score_tender_candidate(
            title=candidate.title,
            sector=candidate.sector,
            summary=candidate.summary,
            buyer_name=candidate.buyer_name,
            country=candidate.country,
            estimated_value=candidate.estimated_value,
        )
        results.append(
            {
                "title": candidate.title,
                "reference": f"{candidate.reference}-{today}-{fingerprint}",
                "buyer_name": candidate.buyer_name,
                "country": candidate.country,
                "sector": candidate.sector,
                "source_name": candidate.source_name,
                "source_url": candidate.source_url,
                "summary": candidate.summary,
                "estimated_value": candidate.estimated_value,
                "deadline": candidate.deadline,
                "requirements": candidate.requirements,
                "qualification_score": scoring["global_score"],
                "recommendation": scoring["recommendation"],
                "score_breakdown": scoring,
                "rationale": scoring["rationale"],
            }
        )

    return results
