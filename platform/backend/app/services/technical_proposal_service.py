from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class ProposalSection:
    title: str
    content: str
    bullets: list[str]


def _bulletize(items: list[str], fallback: str) -> list[str]:
    cleaned = [item.strip() for item in items if item and item.strip()]
    return cleaned or [fallback]


def build_technical_proposal(
    *,
    tender_title: str,
    buyer_name: str | None,
    summary: str | None,
    requirements: list[str],
    recommended_team: list[dict] | None = None,
    gap_analysis: dict | None = None,
) -> dict:
    buyer = buyer_name or "Client / donneur d'ordre"
    team = recommended_team or []
    gaps = gap_analysis or {}
    today = date.today().isoformat()

    team_bullets = [
        f"{item['consultant']['full_name']} — {item['consultant']['role']} — score {item['match_score']}/100"
        for item in team
        if item.get("consultant")
    ]

    missing_skills = gaps.get("missing_skills", []) or []
    covered_skills = gaps.get("covered_skills", []) or []
    recommended_actions = gaps.get("recommended_actions", []) or []

    sections = [
        ProposalSection(
            title="1. Synthèse exécutive",
            content=(
                f"DataSphere Innovation propose une réponse structurée pour l'appel d'offres « {tender_title} » "
                f"porté par {buyer}. L'approche vise à sécuriser la compréhension du besoin, cadrer les livrables, "
                "mobiliser une équipe adaptée et réduire les risques de delivery."
            ),
            bullets=[
                "Qualification initiale du besoin et des exigences.",
                "Proposition d'une équipe projet alignée avec les compétences clés.",
                "Pilotage par jalons, indicateurs de suivi et gouvernance projet.",
            ],
        ),
        ProposalSection(
            title="2. Compréhension du besoin",
            content=summary or "Le besoin sera précisé lors de la phase de cadrage avec le client.",
            bullets=_bulletize(requirements[:8], "Exigences à consolider pendant le cadrage."),
        ),
        ProposalSection(
            title="3. Méthodologie proposée",
            content=(
                "La méthodologie proposée repose sur une démarche progressive : cadrage, conception, réalisation, "
                "recette, transfert de compétences et accompagnement au démarrage. Chaque étape produit des livrables "
                "validables afin de sécuriser l'avancement."
            ),
            bullets=[
                "Atelier de cadrage fonctionnel, technique et organisationnel.",
                "Conception de l'architecture cible et validation des hypothèses.",
                "Développement itératif avec démonstrations régulières.",
                "Recette, documentation et transfert de compétences.",
            ],
        ),
        ProposalSection(
            title="4. Architecture et solution cible",
            content=(
                "La solution cible sera conçue selon des principes de modularité, sécurité, traçabilité et évolutivité. "
                "Elle intégrera les exigences de gouvernance, d'auditabilité et d'exploitation opérationnelle."
            ),
            bullets=[
                "Architecture modulaire et extensible.",
                "Sécurisation des accès et gestion des rôles.",
                "Journalisation des actions et traçabilité des traitements.",
                "Indicateurs de pilotage et reporting directionnel.",
            ],
        ),
        ProposalSection(
            title="5. Organisation projet et équipe",
            content=(
                "L'équipe projet est proposée sur la base du matching IA entre les exigences de l'appel d'offres, "
                "les compétences disponibles et la disponibilité estimée des profils."
            ),
            bullets=_bulletize(team_bullets, "Équipe à confirmer après qualification des profils."),
        ),
        ProposalSection(
            title="6. Analyse des compétences et risques",
            content=(
                f"Couverture des compétences identifiées : {gaps.get('coverage_rate', 0)}%. "
                "Les écarts détectés doivent être traités avant engagement final."
            ),
            bullets=[
                f"Compétences couvertes : {', '.join(covered_skills) if covered_skills else 'à confirmer'}.",
                f"Compétences manquantes : {', '.join(missing_skills) if missing_skills else 'aucune compétence critique détectée'}.",
                *recommended_actions,
            ],
        ),
        ProposalSection(
            title="7. Planning indicatif",
            content=(
                "Le planning sera affiné après cadrage. Une trajectoire initiale peut être organisée en lots courts "
                "afin d'obtenir rapidement des résultats visibles et validables."
            ),
            bullets=[
                "Semaine 1-2 : cadrage et backlog détaillé.",
                "Semaine 3-6 : conception et premiers livrables.",
                "Semaine 7-10 : intégration, tests et recette.",
                "Semaine 11-12 : documentation, formation et passage en exploitation.",
            ],
        ),
        ProposalSection(
            title="8. Gouvernance et qualité",
            content=(
                "La gouvernance projet s'appuiera sur des comités réguliers, un suivi des risques, une gestion des décisions "
                "et des validations formalisées."
            ),
            bullets=[
                "Comité projet hebdomadaire.",
                "Comité de pilotage mensuel ou à jalon clé.",
                "Registre des risques, décisions et actions.",
                "Reporting d'avancement et indicateurs de qualité.",
            ],
        ),
        ProposalSection(
            title="9. Conclusion",
            content=(
                "DataSphere Innovation se positionne comme un partenaire de transformation capable de combiner expertise data, "
                "IA, architecture technique, pilotage projet et accompagnement opérationnel."
            ),
            bullets=[
                "Approche structurée et pragmatique.",
                "Équipe recommandée par matching IA.",
                "Réduction des risques grâce à la qualification et au suivi des écarts.",
            ],
        ),
    ]

    markdown = "\n\n".join(
        [
            f"# Mémoire technique — {tender_title}\n\n"
            f"**Client :** {buyer}\n\n"
            f"**Date :** {today}\n\n"
        ]
        + [
            f"## {section.title}\n\n{section.content}\n\n" + "\n".join(f"- {bullet}" for bullet in section.bullets)
            for section in sections
        ]
    )

    return {
        "title": f"Mémoire technique — {tender_title}",
        "buyer_name": buyer,
        "generated_at": today,
        "sections": [section.__dict__ for section in sections],
        "markdown": markdown,
    }
