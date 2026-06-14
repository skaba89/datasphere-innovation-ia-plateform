"""
AgentPipelineOrchestrator — Orchestration bout en bout des agents IA

3 modes de fonctionnement :
  - 'manual'      : L'utilisateur déclenche chaque action manuellement
  - 'supervised'  : L'agent s'exécute, s'arrête pour validation humaine aux étapes clés
  - 'autonomous'  : L'agent s'exécute entièrement sans validation (sauf erreurs)

Pipeline type pour un AO (8 étapes) :
  1. context_analysis          → Analyse du contexte (auto, pas critique)
  2. tender_requirements_review → Revue des exigences (validate: go/no-go ← HUMAIN)
  3. go_no_go_analysis         → Recommandation Go/No-Go ← VALIDATION HUMAINE OBLIGATOIRE
  4. deliverable_plan          → Plan des livrables (auto si GO)
  5. commercial_proposal       → Rédaction proposition (auto)
  6. compliance_matrix         → Matrice de conformité (auto)
  7. human_review              → Revue finale ← VALIDATION HUMAINE
  8. staffing_plan             → Plan d'équipe (auto)
"""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from app.models.agent import AgentAction, AgentAssignment, AgentProfile
from app.models.tender import Tender

log = logging.getLogger("datasphere.agent_pipeline")


class RunMode(str, Enum):
    MANUAL     = "manual"       # User triggers each action
    SUPERVISED = "supervised"   # Auto-run + pause at key checkpoints
    AUTONOMOUS = "autonomous"   # Full auto, no human approval needed


# ── Pipeline definition ───────────────────────────────────────────────────────

# Étapes dans l'ordre, avec leur configuration
PIPELINE_STEPS = [
    {
        "action_type":          "context_analysis",
        "title":                "Analyse du contexte mission",
        "description":          "L'agent analyse le contexte de l'AO, les enjeux et les contraintes.",
        "requires_human":       False,   # Auto en mode supervised
        "critical_checkpoint":  False,
        "emoji":                "🔍",
    },
    {
        "action_type":          "tender_requirements_review",
        "title":                "Revue des exigences de l'AO",
        "description":          "Analyse des critères d'évaluation, exigences obligatoires, risques de non-conformité.",
        "requires_human":       False,
        "critical_checkpoint":  False,
        "emoji":                "📋",
    },
    {
        "action_type":          "go_no_go_analysis",
        "title":                "Recommandation Go / No-Go",
        "description":          "L'agent recommande de répondre ou non à cet AO. VALIDATION HUMAINE REQUISE.",
        "requires_human":       True,    # Toujours validation humaine
        "critical_checkpoint":  True,
        "emoji":                "⚖️",
    },
    {
        "action_type":          "deliverable_plan",
        "title":                "Plan des livrables",
        "description":          "Structure du plan de réponse : sections, contenu, rôles, jalons.",
        "requires_human":       False,
        "critical_checkpoint":  False,
        "emoji":                "📐",
    },
    {
        "action_type":          "commercial_proposal",
        "title":                "Rédaction de la proposition commerciale",
        "description":          "Génération de la proposition technique et commerciale complète.",
        "requires_human":       False,
        "critical_checkpoint":  False,
        "emoji":                "✍️",
    },
    {
        "action_type":          "compliance_matrix",
        "title":                "Matrice de conformité",
        "description":          "Vérification point par point des exigences du cahier des charges.",
        "requires_human":       False,
        "critical_checkpoint":  False,
        "emoji":                "✅",
    },
    {
        "action_type":          "human_review",
        "title":                "Revue finale humaine",
        "description":          "Validation de la proposition avant envoi au client. VALIDATION HUMAINE OBLIGATOIRE.",
        "requires_human":       True,
        "critical_checkpoint":  True,
        "emoji":                "👁️",
    },
    {
        "action_type":          "staffing_plan",
        "title":                "Plan de staffing",
        "description":          "Identification et assignation des consultants pour la mission.",
        "requires_human":       False,
        "critical_checkpoint":  False,
        "emoji":                "👥",
    },
]


def create_pipeline_actions(
    db: Session,
    assignment: AgentAssignment,
    mode: RunMode = RunMode.SUPERVISED,
) -> list[AgentAction]:
    """Crée les 8 actions du pipeline pour un assignment."""
    from app.crud.agent import create_action
    from app.schemas.agent import AgentActionCreate

    actions = []
    for i, step in enumerate(PIPELINE_STEPS):
        # En mode autonomous : aucune validation humaine
        needs_human = step["requires_human"] if mode != RunMode.AUTONOMOUS else False
        # En mode manual : toutes les actions nécessitent une approbation
        if mode == RunMode.MANUAL:
            needs_human = True

        action_payload = AgentActionCreate(
            assignment_id=assignment.id,
            action_type=step["action_type"],
            title=f"{step['emoji']} {step['title']}",
            description=step["description"],
            priority="Haute" if step["critical_checkpoint"] else "Moyenne",
            status="suggested" if i > 0 else "auto_ready",  # First action ready to run
            requires_human_approval=needs_human,
        )
        action = create_action(db, action_payload)
        actions.append(action)

    log.info("Pipeline created: %d actions for assignment %d (mode: %s)",
             len(actions), assignment.id, mode)
    return actions


def execute_action_and_advance(
    db: Session,
    action: AgentAction,
    user_email: str = "system",
) -> dict[str, Any]:
    """
    Exécute une action et avance automatiquement à la suivante si possible.
    
    Returns:
        {"action": action, "next_action": next | None, "status": "done"|"awaiting"|"error"}
    """
    from app.services.agent_executor import execute_action
    from app.models.agent import AgentAction

    # Execute the action
    try:
        action.status = "executing"
        action.executed_at = datetime.utcnow()
        db.add(action)
        db.commit()

        result_summary, next_step = execute_action(db, action)

        action.status = "done"
        action.result_summary = result_summary
        action.next_step = next_step
        db.add(action)
        db.commit()

        log.info("Action %d (%s) completed", action.id, action.action_type)

    except Exception as e:
        action.status = "failed"
        action.result_summary = f"Erreur: {str(e)[:500]}"
        db.add(action)
        db.commit()
        log.error("Action %d failed: %s", action.id, e)
        return {"action": action, "next_action": None, "status": "error", "error": str(e)}

    # Find next action in this assignment's pipeline
    next_action = (
        db.query(AgentAction)
        .filter(
            AgentAction.assignment_id == action.assignment_id,
            AgentAction.status == "suggested",
        )
        .order_by(AgentAction.id.asc())
        .first()
    )

    if next_action:
        if next_action.requires_human_approval:
            # Pause: mark as awaiting human approval
            next_action.status = "awaiting"
            db.add(next_action)
            db.commit()
            log.info("Next action %d requires human approval — status: awaiting", next_action.id)
            return {"action": action, "next_action": next_action, "status": "awaiting_approval"}
        else:
            # Auto-advance: mark as ready to run
            next_action.status = "auto_ready"
            db.add(next_action)
            db.commit()
            return {"action": action, "next_action": next_action, "status": "auto_ready"}

    # Pipeline complete
    _complete_assignment(db, action.assignment_id)
    return {"action": action, "next_action": None, "status": "pipeline_complete"}


def run_auto_actions(
    db: Session,
    assignment_id: int,
    max_steps: int = 10,
) -> dict[str, Any]:
    """
    Exécute automatiquement toutes les actions 'auto_ready' du pipeline.
    S'arrête à la première action nécessitant une validation humaine.
    
    Returns summary of what was executed.
    """
    executed = []
    pending_approval = None

    for _ in range(max_steps):
        # Find next auto_ready action
        action = (
            db.query(AgentAction)
            .filter(
                AgentAction.assignment_id == assignment_id,
                AgentAction.status == "auto_ready",
            )
            .order_by(AgentAction.id.asc())
            .first()
        )

        if not action:
            break

        result = execute_action_and_advance(db, action)
        executed.append({
            "action_id": action.id,
            "action_type": action.action_type,
            "title": action.title,
            "status": result["status"],
            "summary": action.result_summary[:200] if action.result_summary else "",
        })

        if result["status"] in ("awaiting_approval", "error", "pipeline_complete"):
            if result["status"] == "awaiting_approval":
                pending_approval = result.get("next_action")
            break

    return {
        "executed": executed,
        "steps_run": len(executed),
        "pending_approval": {
            "id": pending_approval.id,
            "title": pending_approval.title,
            "action_type": pending_approval.action_type,
            "description": pending_approval.description,
        } if pending_approval else None,
        "pipeline_complete": not pending_approval and len(executed) > 0,
    }


def approve_and_continue(
    db: Session,
    action_id: int,
    approved_by: str,
    comment: str | None = None,
    auto_continue: bool = True,
) -> dict[str, Any]:
    """
    Valide une action en attente et continue le pipeline.
    
    Args:
        auto_continue: Si True, exécute automatiquement les prochaines actions auto
    """
    action = db.query(AgentAction).filter(AgentAction.id == action_id).first()
    if not action:
        return {"error": "Action non trouvée"}

    if action.status not in ("awaiting", "suggested"):
        return {"error": f"Action en statut '{action.status}', pas en attente d'approbation"}

    # Approve the action
    action.status = "auto_ready"
    action.approved_by = approved_by
    action.approved_at = datetime.utcnow()
    if comment:
        action.description = (action.description or "") + f"\n\n[Commentaire: {comment}]"
    db.add(action)
    db.commit()

    if not auto_continue:
        return {"approved": True, "action_id": action_id}

    # Execute this action and auto-continue
    result = run_auto_actions(db, action.assignment_id)
    return {"approved": True, "action_id": action_id, **result}


def reject_action(
    db: Session,
    action_id: int,
    rejected_by: str,
    reason: str = "",
) -> dict[str, Any]:
    """Rejette une action et marque le pipeline comme stoppé."""
    action = db.query(AgentAction).filter(AgentAction.id == action_id).first()
    if not action:
        return {"error": "Action non trouvée"}

    action.status = "skipped"
    action.approved_by = f"REJECTED by {rejected_by}"
    action.result_summary = f"Rejeté : {reason}"
    db.add(action)

    # Stop remaining suggested actions
    db.query(AgentAction).filter(
        AgentAction.assignment_id == action.assignment_id,
        AgentAction.status == "suggested",
    ).update({"status": "skipped"})
    db.commit()

    return {"rejected": True, "action_id": action_id, "reason": reason}


def get_pipeline_status(db: Session, assignment_id: int) -> dict[str, Any]:
    """Retourne l'état complet du pipeline."""
    actions = (
        db.query(AgentAction)
        .filter(AgentAction.assignment_id == assignment_id)
        .order_by(AgentAction.id.asc())
        .all()
    )

    assignment = db.query(AgentAssignment).filter(AgentAssignment.id == assignment_id).first()

    done         = [a for a in actions if a.status == "done"]
    awaiting     = [a for a in actions if a.status == "awaiting"]
    executing    = [a for a in actions if a.status == "executing"]
    auto_ready   = [a for a in actions if a.status == "auto_ready"]
    remaining    = [a for a in actions if a.status == "suggested"]
    failed       = [a for a in actions if a.status == "failed"]
    skipped      = [a for a in actions if a.status == "skipped"]

    total = len(actions)
    progress = round(len(done) / max(total, 1) * 100)

    return {
        "assignment_id": assignment_id,
        "objective":     assignment.objective if assignment else "",
        "progress_pct":  progress,
        "total_steps":   total,
        "done":          len(done),
        "awaiting":      len(awaiting),
        "executing":     len(executing),
        "auto_ready":    len(auto_ready),
        "remaining":     len(remaining),
        "failed":        len(failed),
        "is_complete":   len(done) == total and total > 0,
        "needs_approval": len(awaiting) > 0,
        "actions":       [
            {
                "id":           a.id,
                "action_type":  a.action_type,
                "title":        a.title,
                "status":       a.status,
                "requires_human_approval": a.requires_human_approval,
                "result_summary": a.result_summary,
                "next_step":    a.next_step,
                "approved_by":  a.approved_by,
                "executed_at":  a.executed_at.isoformat() if a.executed_at else None,
            }
            for a in actions
        ],
    }


def _complete_assignment(db: Session, assignment_id: int) -> None:
    db.query(AgentAssignment).filter(AgentAssignment.id == assignment_id).update({
        "status": "completed",
        "updated_at": datetime.utcnow(),
    })
    db.commit()
    log.info("Assignment %d pipeline COMPLETE", assignment_id)
