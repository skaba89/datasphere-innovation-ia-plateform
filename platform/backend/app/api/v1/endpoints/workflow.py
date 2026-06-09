"""
Workflow API

POST /workflow/{tender_id}/start       — Démarrer le workflow automatisé
GET  /workflow/{tender_id}             — État du workflow + étapes
GET  /workflow/approvals/pending       — Toutes les étapes en attente
POST /workflow/steps/{step_id}/approve — Valider une étape (humain)
POST /workflow/steps/{step_id}/reject  — Rejeter une étape (avec raison)
POST /workflow/{tender_id}/reset       — Remettre à zéro
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.models.workflow import WORKFLOW_STEPS
from app.services.workflow_service import (
    approve_step, get_pending_approvals, get_workflow,
    reject_step, start_workflow,
)

log = logging.getLogger("datasphere.workflow_api")

router = APIRouter(
    prefix="/workflow",
    tags=["workflow"],
    dependencies=[Depends(get_current_user)],
)

STATUS_LABELS = {
    "idle":              "Non démarré",
    "running":           "En cours",
    "awaiting_approval": "En attente de validation",
    "paused":            "En pause",
    "completed":         "Terminé ✅",
    "failed":            "Erreur ❌",
}

STEP_STATUS_LABELS = {
    "pending":   "En attente",
    "running":   "En cours…",
    "awaiting":  "⏳ À valider",
    "done":      "✅ Terminé",
    "approved":  "✅ Validé",
    "rejected":  "❌ Rejeté",
    "skipped":   "Ignoré",
    "failed":    "Erreur",
}


class StartWorkflowRequest(BaseModel):
    force_reset: bool = False


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Raison du rejet")


def _serialize_step(step) -> dict:
    return {
        "id":               step.id,
        "step_key":         step.step_key,
        "step_label":       step.step_label,
        "order_index":      step.order_index,
        "status":           step.status,
        "status_label":     STEP_STATUS_LABELS.get(step.status, step.status),
        "requires_approval": step.requires_approval,
        "result_summary":   step.result_summary,
        "approved_by":      step.approved_by,
        "approved_at":      step.approved_at.isoformat() if step.approved_at else None,
        "rejection_reason": step.rejection_reason,
        "artifact_type":    step.artifact_type,
        "artifact_id":      step.artifact_id,
        "started_at":       step.started_at.isoformat() if step.started_at else None,
        "completed_at":     step.completed_at.isoformat() if step.completed_at else None,
    }


def _serialize_instance(instance) -> dict:
    steps = sorted(instance.steps, key=lambda s: s.order_index)
    done  = sum(1 for s in steps if s.status == "done")
    total = len(steps)
    pct   = int(done / total * 100) if total else 0

    # Find current awaiting step
    awaiting = next((s for s in steps if s.status == "awaiting"), None)

    return {
        "id":             instance.id,
        "tender_id":      instance.tender_id,
        "status":         instance.status,
        "status_label":   STATUS_LABELS.get(instance.status, instance.status),
        "current_step":   instance.current_step,
        "progress_pct":   pct,
        "steps_done":     done,
        "steps_total":    total,
        "started_by":     instance.started_by,
        "started_at":     instance.started_at.isoformat() if instance.started_at else None,
        "completed_at":   instance.completed_at.isoformat() if instance.completed_at else None,
        "error_message":  instance.error_message,
        "awaiting_step":  _serialize_step(awaiting) if awaiting else None,
        "steps":          [_serialize_step(s) for s in steps],
    }


@router.post("/{tender_id}/start")
def start(
    tender_id: int,
    payload: StartWorkflowRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Démarrer le workflow automatisé pour un appel d'offres."""
    existing = get_workflow(db, tender_id)
    if existing and existing.status not in ("idle", "failed", "paused", "completed") and not payload.force_reset:
        raise HTTPException(
            status_code=400,
            detail=f"Un workflow est déjà en cours (statut : {existing.status}). Utilisez force_reset=true pour recommencer.",
        )
    try:
        instance = start_workflow(db, tender_id, started_by=current_user.email)
        return _serialize_instance(instance)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/approvals/pending")
def pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lister toutes les étapes en attente de validation humaine."""
    steps = get_pending_approvals(db)
    result = []
    for step in steps:
        inst = step.instance
        from app.crud.tender import get_tender
        tender = get_tender(db, inst.tender_id)
        result.append({
            **_serialize_step(step),
            "tender_title":  tender.title if tender else f"AO #{inst.tender_id}",
            "tender_id":     inst.tender_id,
            "instance_id":   inst.id,
            "workflow_step_definition": next(
                (d for d in WORKFLOW_STEPS if d["key"] == step.step_key), {}
            ),
        })
    return {"pending": result, "count": len(result)}


@router.get("/{tender_id}")
def get_status(
    tender_id: int,
    db: Session = Depends(get_db),
):
    """État complet du workflow d'un tender."""
    instance = get_workflow(db, tender_id)
    if not instance:
        return {
            "tender_id":    tender_id,
            "status":       "idle",
            "status_label": "Non démarré",
            "steps":        [
                {
                    "step_key":          s["key"],
                    "step_label":        s["label"],
                    "order_index":       i,
                    "status":            "pending",
                    "status_label":      "En attente",
                    "requires_approval": s["requires_approval"],
                    "description":       s["description"],
                }
                for i, s in enumerate(WORKFLOW_STEPS)
            ],
        }
    return _serialize_instance(instance)


@router.post("/steps/{step_id}/approve")
def approve(
    step_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Valider une étape — débloque la suite du workflow."""
    try:
        step = approve_step(db, step_id, current_user.email, SessionLocal)
        return {
            "success": True,
            "message": f"Étape '{step.step_label}' validée par {current_user.email}. Workflow reprend.",
            "step": _serialize_step(step),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/steps/{step_id}/reject")
def reject(
    step_id: int,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rejeter une étape — met le workflow en pause."""
    try:
        step = reject_step(db, step_id, current_user.email, payload.reason)
        return {
            "success": True,
            "message": f"Étape rejetée. Workflow mis en pause.",
            "step": _serialize_step(step),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{tender_id}/reset")
def reset(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remettre le workflow à zéro."""
    from app.models.workflow import WorkflowInstance
    instance = db.query(WorkflowInstance).filter(
        WorkflowInstance.tender_id == tender_id
    ).first()
    if instance:
        db.delete(instance)
        db.commit()
    return {"success": True, "message": f"Workflow AO #{tender_id} remis à zéro."}
