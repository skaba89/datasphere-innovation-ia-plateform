"""
Agent Executor — Executes an AgentAction with full mission context via LLM.

Builds a rich context prompt from the DB (opportunity, tender, assignment, agent profile)
and calls the LLM service. Falls back to simulation when no API key is configured.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.agent import AgentAction, AgentAssignment, AgentProfile
from app.models.opportunity import Opportunity
from app.models.tender import Tender
from app.services import llm_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

_ACTION_INSTRUCTIONS: dict[str, str] = {
    "context_analysis": (
        "Analyse le contexte de mission ci-dessus. Identifie : les enjeux stratégiques, "
        "les parties prenantes clés, les contraintes, les risques principaux et les informations manquantes. "
        "Produis une synthèse de cadrage opérationnelle en français."
    ),
    "tender_requirements_review": (
        "Analyse les exigences de l'appel d'offres. Identifie : les exigences obligatoires, "
        "les critères de notation, les preuves attendues, les risques de non-conformité et "
        "les axes de différenciation. Propose une stratégie de réponse claire."
    ),
    "deliverable_plan": (
        "Structure le plan du livrable attendu. Définis les sections, les hypothèses clés, "
        "les données nécessaires, les rôles et les points de validation. "
        "Le plan doit être directement utilisable par le consultant en charge."
    ),
    "compliance_matrix": (
        "Construis une matrice de conformité préliminaire en analysant le contexte. "
        "Évalue le taux de couverture estimé, les points forts et les lacunes à combler."
    ),
    "commercial_proposal": (
        "Rédige les éléments clés d'une proposition commerciale adaptée au contexte. "
        "Inclus : l'approche proposée, l'équipe, les jalons et une estimation budgétaire."
    ),
}

_DEFAULT_INSTRUCTION = (
    "Analyse le contexte de la mission et produis un résultat structuré, opérationnel et "
    "directement utilisable. Reste factuel, professionnel et orienté résultats."
)


def _build_prompt(db: Session, action: AgentAction) -> str:
    """Build the full context prompt for LLM execution."""
    assignment: AgentAssignment | None = (
        db.query(AgentAssignment).filter(AgentAssignment.id == action.assignment_id).first()
    )
    if not assignment:
        return f"Exécute l'action : {action.title}\n\n{action.description or ''}"

    opportunity: Opportunity | None = None
    tender: Tender | None = None

    if assignment.opportunity_id:
        opportunity = db.query(Opportunity).filter(Opportunity.id == assignment.opportunity_id).first()
    if assignment.tender_id:
        tender = db.query(Tender).filter(Tender.id == assignment.tender_id).first()

    # Organisation for opportunity
    org_name = ""
    if opportunity and opportunity.organization_id:
        from app.models.organization import Organization
        org = db.query(Organization).filter(Organization.id == opportunity.organization_id).first()
        if org:
            org_name = f"{org.name} ({org.country or '?'})"

    lines = [
        "=== MISSION DE CONSEIL ===",
        f"Objectif : {assignment.objective}",
        f"Livrable attendu : {assignment.expected_deliverable or 'À définir'}",
        f"Priorité : {assignment.priority}",
        f"Reviewer humain : {assignment.human_reviewer or 'DataSphere'}",
        "",
    ]

    if opportunity:
        lines += [
            "=== CONTEXTE OPPORTUNITÉ ===",
            f"Client : {org_name or 'Non précisé'}",
            f"Opportunité : {opportunity.title}",
            f"Pays : {opportunity.country or '?'} | Secteur : {opportunity.sector or '?'}",
            f"Priorité : {opportunity.priority} | Probabilité : {opportunity.probability}%",
            f"Notes : {opportunity.notes or 'Aucune note.'}",
            "",
        ]

    if tender:
        lines += [
            "=== APPEL D'OFFRES ===",
            f"Référence : {tender.reference or 'N/A'}",
            f"Titre : {tender.title}",
            f"Acheteur : {tender.buyer_name or 'Non précisé'}",
            f"Décision Go/No-Go : {tender.go_no_go_decision or 'À qualifier'} "
            f"(score : {tender.go_no_go_score or '?'}/100)",
            f"Résumé : {tender.summary or 'Non renseigné.'}",
            "",
        ]

    instruction = _ACTION_INSTRUCTIONS.get(action.action_type, _DEFAULT_INSTRUCTION)

    lines += [
        "=== ACTION À EXÉCUTER ===",
        f"Type : {action.action_type}",
        f"Titre : {action.title}",
        f"Description : {action.description or 'Voir instructions.'}",
        "",
        "=== INSTRUCTIONS ===",
        instruction,
        "",
        "=== FORMAT DE RÉPONSE OBLIGATOIRE ===",
        "Réponds UNIQUEMENT dans ce format exact (en français) :",
        "",
        "RÉSUMÉ:",
        "[3 à 5 phrases résumant le résultat, les enjeux et les décisions clés]",
        "",
        "PROCHAINE ÉTAPE:",
        "[Une phrase recommandant la prochaine action concrète et immédiate]",
    ]

    return "\n".join(lines)


def _get_system_prompt(db: Session, action: AgentAction) -> str:
    """Get the agent's system prompt or return a professional default."""
    assignment = db.query(AgentAssignment).filter(AgentAssignment.id == action.assignment_id).first()
    if assignment:
        agent = db.query(AgentProfile).filter(AgentProfile.id == assignment.agent_id).first()
        if agent and agent.system_prompt:
            return agent.system_prompt

    return (
        "Tu es un consultant expert en Data, IA et transformation digitale chez DataSphere Innovation. "
        "Tu travailles en France et en Afrique francophone. Tu produis des analyses précises, "
        "des livrables professionnels et des recommandations opérationnelles. "
        "Tu respectes les règles de gouvernance : toute décision sensible est soumise à validation humaine."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def execute_action(db: Session, action: AgentAction) -> tuple[str, str | None]:
    """
    Execute an action using LLM with full mission context.
    Returns (result_summary, next_step).
    """
    try:
        prompt = _build_prompt(db, action)
        system = _get_system_prompt(db, action)
        result, next_step = llm_service.complete(
            prompt=prompt,
            system=system,
            action_type=action.action_type,
        )
        provider = llm_service.provider_label()
        logger.info(
            "Action #%d [%s] executed via %s — %d chars",
            action.id,
            action.action_type,
            provider,
            len(result),
        )
        return result, next_step
    except Exception as exc:
        logger.error("Action #%d execution failed: %s", action.id, exc)
        raise
