"""
Go/No-Go AI Advisor — LLM-powered recommendation for tender qualification.

Builds a structured prompt from criteria + scores + tender + opportunity context,
calls the LLM service, then parses the response into a structured recommendation.
Falls back to rule-based analysis when no LLM is configured.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.models.tender import Tender, TenderRequirement
from app.models.tender_governance import GoNoGoCriterion
from app.schemas.commercial import (
    GoNoGoOpportunityItem,
    GoNoGoRecommendation,
    GoNoGoRiskItem,
)
from app.services import llm_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(
    tender: Tender,
    criteria: list[GoNoGoCriterion],
    requirements: list[TenderRequirement],
    opportunity: Opportunity | None,
) -> str:
    score_total = sum(c.score * c.weight for c in criteria if c.score and c.weight)
    max_score = sum(10 * c.weight for c in criteria if c.weight)
    pct = round(score_total / max_score * 100, 1) if max_score else 0

    lines = [
        "=== MISSION : DÉCISION GO / NO-GO ===",
        "",
        "Tu es un expert senior en réponse aux appels d'offres chez DataSphere Innovation.",
        "Analyse les informations suivantes et formule une recommandation Go/No-Go argumentée.",
        "",
        "=== APPEL D'OFFRES ===",
        f"Référence : {tender.reference or 'N/A'}",
        f"Titre : {tender.title}",
        f"Acheteur : {tender.buyer_name or 'Non précisé'}",
        f"Résumé : {tender.summary or 'Non renseigné'}",
        f"Score Go/No-Go actuel : {tender.go_no_go_score or '?'}/100",
        f"Décision saisie : {tender.go_no_go_decision or 'Non qualifié'}",
        "",
    ]

    if opportunity:
        lines += [
            "=== OPPORTUNITÉ ===",
            f"Titre : {opportunity.title}",
            f"Secteur : {opportunity.sector or '?'}",
            f"Pays : {opportunity.country or '?'}",
            f"Priorité : {opportunity.priority}",
            f"Probabilité actuelle : {opportunity.probability}%",
            f"Valeur potentielle : {opportunity.potential_value or '?'} €",
            f"Notes : {opportunity.notes or 'Aucune'}",
            "",
        ]

    if criteria:
        lines.append("=== CRITÈRES DE SCORING ===")
        for c in criteria:
            weighted = (c.score or 0) * (c.weight or 1)
            lines.append(
                f"- [{c.score or 0}/10 × poids {c.weight or 1} = {weighted}] "
                f"{c.name} : {c.description or ''}"
                + (f" → {c.recommendation}" if c.recommendation else "")
            )
        lines.append(f"\nScore pondéré total : {score_total}/{max_score} ({pct}%)")
        lines.append("")

    if requirements:
        lines.append("=== EXIGENCES CLÉS ===")
        for r in requirements[:8]:
            lines.append(
                f"- [{r.requirement_type or 'N/A'}] {r.requirement_code or ''} : "
                f"{r.description[:120]}..."
            )
        lines.append("")

    lines += [
        "=== FORMAT DE RÉPONSE ATTENDU (JSON strict) ===",
        "Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après :",
        "",
        "{",
        '  "decision": "Go" | "No-Go" | "Go conditionnel",',
        '  "confidence": 0-100,',
        '  "summary": "2-3 phrases de synthèse exécutive",',
        '  "reasoning": "argumentation détaillée en 4-6 phrases",',
        '  "risks": [{"level": "high|medium|low", "category": "technique|commercial|délai|ressources|compétences", "description": "...", "mitigation": "..."}],',
        '  "opportunities": [{"category": "différenciation|référence|partenariat|innovation", "description": "...", "impact": "fort|moyen|faible"}],',
        '  "conditions": ["condition 1", "condition 2"],',
        '  "recommended_actions": ["action 1", "action 2", "action 3"]',
        "}",
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Rule-based fallback (no LLM)
# ---------------------------------------------------------------------------

def _rule_based_recommendation(
    tender: Tender,
    criteria: list[GoNoGoCriterion],
) -> dict:
    score_total = sum((c.score or 0) * (c.weight or 1) for c in criteria)
    max_score = sum(10 * (c.weight or 1) for c in criteria)
    pct = round(score_total / max_score * 100, 1) if max_score else float(tender.go_no_go_score or 50)

    if pct >= 70:
        decision = "Go"
        summary = (
            f"Le dossier {tender.reference or tender.title} présente un profil favorable "
            f"avec un score de {pct}%. Les critères clés sont couverts. "
            "DataSphere est en bonne position pour répondre à cet appel d'offres."
        )
    elif pct >= 45:
        decision = "Go conditionnel"
        summary = (
            f"Le dossier présente un potentiel réel ({pct}%) mais plusieurs points "
            "nécessitent une attention particulière. Un Go est possible sous conditions. "
            "Un plan d'action ciblé permettra de renforcer la réponse."
        )
    else:
        decision = "No-Go"
        summary = (
            f"Le score de {pct}% révèle des lacunes significatives par rapport aux exigences. "
            "Les ressources seraient mieux investies sur d'autres opportunités. "
            "Un refus motivé est recommandé."
        )

    risks = [
        {"level": "high", "category": "compétences",
         "description": "Adéquation profil / exigences à confirmer",
         "mitigation": "Mapper chaque exigence à un profil consultant disponible"},
        {"level": "medium", "category": "délai",
         "description": "Délai de remise à surveiller",
         "mitigation": "Établir un plan de production dès la décision Go"},
    ]
    if pct < 60:
        risks.append({
            "level": "high", "category": "commercial",
            "description": "Faible probabilité de succès compte tenu du score",
            "mitigation": "Reconsidérer la pertinence de répondre à cet AO"
        })

    return {
        "decision": decision,
        "confidence": min(90, max(40, int(pct))),
        "summary": summary,
        "reasoning": (
            f"Analyse basée sur {len(criteria)} critère(s) pondéré(s). "
            f"Score global : {score_total}/{max_score} ({pct}%). "
            "L'évaluation tient compte de l'adéquation technique, du positionnement commercial "
            "et des contraintes opérationnelles identifiées dans les critères renseignés."
        ),
        "risks": risks,
        "opportunities": [
            {
                "category": "différenciation",
                "description": "Expertise Data & IA en Afrique francophone — rare sur ce marché",
                "impact": "fort"
            },
            {
                "category": "référence",
                "description": "Ce contrat renforcerait le portfolio DataSphere dans le secteur ciblé",
                "impact": "moyen"
            }
        ],
        "conditions": (
            ["Confirmer la disponibilité des profils clés", "Valider le budget prévisionnel"]
            if decision == "Go conditionnel" else []
        ),
        "recommended_actions": [
            "Organiser une réunion de qualification avec les parties prenantes internes",
            "Compléter la matrice de conformité avec les preuves disponibles",
            "Préparer une liste de références sectorielles pertinentes",
        ],
    }


# ---------------------------------------------------------------------------
# JSON parsing
# ---------------------------------------------------------------------------

def _parse_llm_json(raw: str) -> dict | None:
    # Strip markdown code fences if present
    raw = re.sub(r"```(?:json)?", "", raw).strip()
    # Extract first JSON object
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_go_no_go_recommendation(
    db: Session,
    tender_id: int,
) -> GoNoGoRecommendation:
    from app.crud.tender import get_tender, list_tender_requirements
    from app.crud.tender_governance import list_go_no_go_criteria

    tender = get_tender(db, tender_id)
    if tender is None:
        raise ValueError(f"Tender {tender_id} not found")

    criteria = list_go_no_go_criteria(db, tender_id)
    requirements = list_tender_requirements(db, tender_id)
    opportunity = (
        db.query(Opportunity).filter(Opportunity.id == tender.opportunity_id).first()
        if tender.opportunity_id else None
    )

    score_total = sum((c.score or 0) * (c.weight or 1) for c in criteria)
    max_score = sum(10 * (c.weight or 1) for c in criteria) or 1
    pct = round(score_total / max_score * 100, 1)

    rec_dict: dict | None = None
    provider = llm_service.provider_label()

    if llm_service.provider_label() != "simulation":
        try:
            prompt = _build_prompt(tender, criteria, requirements, opportunity)
            raw, _ = llm_service.complete(
                prompt=prompt,
                system=(
                    "Tu es un expert en réponse aux appels d'offres Data & IA. "
                    "Tu réponds UNIQUEMENT en JSON valide sans aucun texte autour."
                ),
                action_type="go_no_go_recommendation",
            )
            rec_dict = _parse_llm_json(raw)
            if rec_dict:
                logger.info("GoNoGo recommendation generated via LLM for tender #%d", tender_id)
        except Exception as exc:
            logger.warning("LLM GoNoGo failed, using rule-based: %s", exc)

    if not rec_dict:
        provider = "simulation"
        rec_dict = _rule_based_recommendation(tender, criteria)

    # Build typed objects
    risks = [GoNoGoRiskItem(**r) for r in rec_dict.get("risks", [])]
    opps = [GoNoGoOpportunityItem(**o) for o in rec_dict.get("opportunities", [])]

    return GoNoGoRecommendation(
        tender_id=tender_id,
        decision=rec_dict.get("decision", "No-Go"),
        confidence=int(rec_dict.get("confidence", 50)),
        score_global=round(score_total, 2),
        score_percentage=pct,
        summary=rec_dict.get("summary", ""),
        reasoning=rec_dict.get("reasoning", ""),
        risks=risks,
        opportunities=opps,
        conditions=rec_dict.get("conditions", []),
        recommended_actions=rec_dict.get("recommended_actions", []),
        provider=provider,
        computed_at=datetime.utcnow(),
    )
