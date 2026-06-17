from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.workspace_scope import get_workspace_scope, WorkspaceContext
from app.models.user import User
from typing import Optional
from app.crud.opportunity import (
    create_opportunity,
    delete_opportunity,
    get_opportunity,
    list_opportunities,
    update_opportunity,
)
from app.crud.organization import get_organization
from app.db.session import get_db
from app.schemas.opportunity import OpportunityCreate, OpportunityRead, OpportunityUpdate

router = APIRouter(
    prefix="/opportunities",
    tags=["opportunities"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[OpportunityRead])
def read_opportunities(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    ws: Optional[WorkspaceContext] = Depends(get_workspace_scope),
):
    items = list_opportunities(db, skip=skip, limit=limit)
    if ws is not None:
        items = [i for i in items if getattr(i, "workspace_id", None) in (None, ws.id)]
    return items


@router.post("", response_model=OpportunityRead, status_code=status.HTTP_201_CREATED)
def create_new_opportunity(payload: OpportunityCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    organization = get_organization(db, payload.organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization does not exist")
    return create_opportunity(db, payload)


@router.get("/{opportunity_id}", response_model=OpportunityRead)
def read_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    opportunity = get_opportunity(db, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return opportunity


@router.patch("/{opportunity_id}", response_model=OpportunityRead)
def patch_opportunity(opportunity_id: int, payload: OpportunityUpdate, db: Session = Depends(get_db)):
    opportunity = get_opportunity(db, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return update_opportunity(db, opportunity, payload)


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    opportunity = get_opportunity(db, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    delete_opportunity(db, opportunity)
    return None


# ── Pipeline helpers ──────────────────────────────────────────────────────────

from pydantic import BaseModel  # noqa: E402

PIPELINE_STATUSES = [
    "Prospect identifié",
    "Besoin identifié",
    "Besoin qualifié",
    "Proposition envoyée",
    "Négociation",
    "Gagnée",
    "Perdue",
    "Abandonnée",
]

# English aliases for API compatibility (frontend/API clients may send English)
STATUS_ALIASES: dict[str, str] = {
    "prospect":   "Prospect identifié",
    "identified": "Besoin identifié",
    "qualified":  "Besoin qualifié",
    "proposal":   "Proposition envoyée",
    "negotiation": "Négociation",
    "won":        "Gagnée",
    "lost":       "Perdue",
    "abandoned":  "Abandonnée",
    "open":       "Prospect identifié",
    "closed":     "Gagnée",
}


class StatusMove(BaseModel):
    status: str

    @property
    def normalized_status(self) -> str:
        """Resolve English alias to French pipeline status."""
        return STATUS_ALIASES.get(self.status.lower(), self.status)


@router.patch("/{opportunity_id}/status", response_model=OpportunityRead)
def move_opportunity_status(
    opportunity_id: int,
    payload: StatusMove,
    db: Session = Depends(get_db),
):
    """Move an opportunity to a new pipeline status (kanban card move).
    Accepts both French values ('Gagnée') and English aliases ('won').
    """
    opportunity = get_opportunity(db, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    resolved = payload.normalized_status
    if resolved not in PIPELINE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Allowed: {PIPELINE_STATUSES} or English aliases: {list(STATUS_ALIASES.keys())}",
        )
    return update_opportunity(db, opportunity, OpportunityUpdate(status=resolved))


@router.get("/pipeline/board")
def get_pipeline_board(db: Session = Depends(get_db)):
    """
    Return all opportunities grouped by pipeline status for the kanban board.
    Each column includes the opportunity list + aggregate value.
    """
    from decimal import Decimal
    from app.models.opportunity import Opportunity
    from app.models.organization import Organization

    opps = (
        db.query(Opportunity, Organization.name.label("org_name"))
        .join(Organization, Organization.id == Opportunity.organization_id)
        .order_by(Opportunity.priority.desc(), Opportunity.created_at.desc())
        .all()
    )

    columns: dict[str, dict] = {
        s: {"status": s, "items": [], "total_value": 0.0, "pipeline_value": 0.0}
        for s in PIPELINE_STATUSES
    }

    for opp, org_name in opps:
        col_key = opp.status if opp.status in columns else "Prospect identifié"
        val = float(opp.potential_value or 0)
        prob = opp.probability or 0
        columns[col_key]["items"].append({
            "id": opp.id,
            "title": opp.title,
            "org_name": org_name,
            "priority": opp.priority,
            "probability": prob,
            "potential_value": val,
            "pipeline_value": round(val * prob / 100, 2),
            "owner_name": opp.owner_name,
            "next_action": opp.next_action,
            "sector": opp.sector,
            "country": opp.country,
            "created_at": opp.created_at.isoformat(),
        })
        columns[col_key]["total_value"] += val
        columns[col_key]["pipeline_value"] += val * prob / 100

    for col in columns.values():
        col["total_value"] = round(col["total_value"], 2)
        col["pipeline_value"] = round(col["pipeline_value"], 2)

    return list(columns.values())


@router.get("/pipeline/statuses")
def get_pipeline_statuses():
    """
    Return all valid pipeline statuses and their English aliases.
    Both French values ('Gagnée') and English aliases ('won') are accepted by PATCH /status.
    """
    return {
        "statuses": PIPELINE_STATUSES,
        "aliases": STATUS_ALIASES,
        "note": "PATCH /{id}/status accepts both French values and English aliases",
    }
