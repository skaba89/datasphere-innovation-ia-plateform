"""
CRM Automation Endpoints — automatisation du CRM via agents IA

POST /crm/auto/sync           → sync complet (orgs + opportunités)
POST /crm/auto/sync-orgs      → organisations depuis AOs seulement
POST /crm/auto/sync-opps      → opportunités depuis AOs seulement
GET  /crm/auto/stats          → stats d'automatisation
POST /crm/auto/pipeline/{tender_id}/{status} → mise à jour pipeline
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.crm_agent_service import (
    get_crm_stats,
    sync_opportunities_from_tenders,
    sync_organizations_from_tenders,
    update_pipeline_from_workflow,
)

router = APIRouter(prefix="/crm/auto", tags=["crm-automation"])


@router.post("/sync")
def full_crm_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Sync CRM complet : organisations + opportunités depuis tous les AOs.
    Sûr à appeler plusieurs fois (idempotent).
    """
    orgs = sync_organizations_from_tenders(db)
    opps = sync_opportunities_from_tenders(db)
    stats = get_crm_stats(db)
    return {
        "status": "done",
        "organizations": orgs,
        "opportunities": opps,
        "crm_stats": stats,
    }


@router.post("/sync-orgs")
def sync_orgs_only(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Crée les Organisations manquantes depuis buyer_name des AOs."""
    result = sync_organizations_from_tenders(db)
    return {"status": "done", **result}


@router.post("/sync-opps")
def sync_opps_only(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Crée les Opportunités manquantes depuis les AOs GO/actifs."""
    result = sync_opportunities_from_tenders(db)
    return {"status": "done", **result}


@router.get("/stats")
def crm_automation_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Stats CRM : taux d'automatisation, pipeline, etc."""
    return get_crm_stats(db)


@router.post("/pipeline/{tender_id}/{status}")
def update_pipeline(
    tender_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Met à jour le pipeline commercial quand le statut d'un AO change."""
    updated = update_pipeline_from_workflow(db, tender_id, status)
    return {"updated": updated, "tender_id": tender_id, "new_status": status}
