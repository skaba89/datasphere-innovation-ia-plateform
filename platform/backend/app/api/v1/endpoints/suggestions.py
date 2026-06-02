"""
Suggestions endpoint — AI-suggested entities pending human validation.

GET  /suggestions/pending         — all pending suggestions (orgs + opps + tenders)
GET  /suggestions/count           — count per entity type
POST /suggestions/validate        — approve or reject suggestions (batch)
POST /suggestions/scan/boamp      — trigger BOAMP scan manually
POST /suggestions/import/text     — create suggestion from pasted text
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.suggestion_service import (
    count_pending_suggestions,
    suggest_from_boamp,
    suggest_from_text,
)

router = APIRouter(
    prefix="/suggestions",
    tags=["suggestions"],
    dependencies=[Depends(get_current_user)],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ValidationItem(BaseModel):
    entity_type: str   # "organization" | "opportunity" | "tender"
    entity_id: int
    accept: bool


class BatchValidateRequest(BaseModel):
    items: list[ValidationItem]
    validated_by: str = "Administrateur"


class BoampScanRequest(BaseModel):
    days_back: int = 3
    max_results: int = 20
    min_score: float = 0.4


class TextImportRequest(BaseModel):
    text: str
    source_label: str = "manual_import"
    source_url: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/count")
def get_pending_count(db: Session = Depends(get_db)) -> dict:
    """Return count of pending suggestions per entity type."""
    counts = count_pending_suggestions(db)
    counts["total"] = sum(counts.values())
    return counts


@router.get("/pending")
def list_pending(db: Session = Depends(get_db)) -> dict:
    """Return all pending suggestions grouped by entity type."""
    from app.crud.organization import list_pending_suggestions as orgs_pending
    from app.crud.opportunity import list_pending_suggestions as opps_pending
    from app.crud.tender import list_pending_suggestions as tenders_pending

    def _org_dict(o) -> dict:
        return {
            "id": o.id, "name": o.name, "sector": o.sector,
            "country": o.country, "website": o.website,
            "source": o.source, "confidence_score": o.confidence_score,
            "source_url": o.source_url, "ai_notes": o.ai_notes,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }

    def _opp_dict(o) -> dict:
        return {
            "id": o.id, "title": o.title, "organization_id": o.organization_id,
            "sector": o.sector, "probability": o.probability,
            "source": o.source, "confidence_score": o.confidence_score,
            "source_url": o.source_url, "ai_notes": o.ai_notes,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }

    def _tender_dict(t) -> dict:
        return {
            "id": t.id, "title": t.title, "buyer_name": t.buyer_name,
            "reference": t.reference,
            "submission_deadline": t.submission_deadline.isoformat() if t.submission_deadline else None,
            "source": t.source, "confidence_score": t.confidence_score,
            "source_url": t.source_url, "ai_notes": t.ai_notes,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }

    return {
        "organizations": [_org_dict(o) for o in orgs_pending(db)],
        "opportunities": [_opp_dict(o) for o in opps_pending(db)],
        "tenders": [_tender_dict(t) for t in tenders_pending(db)],
    }


@router.post("/validate")
def batch_validate(
    payload: BatchValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Approve or reject a batch of suggestions.
    Validated entities become visible in normal CRM views.
    """
    from app.crud.organization import validate_suggestion as validate_org
    from app.crud.opportunity import validate_suggestion as validate_opp
    from app.crud.tender import validate_suggestion as validate_tender
    from app.models.organization import Organization
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender

    by = payload.validated_by or current_user.email or "Administrateur"
    results = {"validated": 0, "rejected": 0, "not_found": 0}

    for item in payload.items:
        etype = item.entity_type.lower()
        if etype == "organization":
            obj = db.query(Organization).filter(Organization.id == item.entity_id).first()
            if obj:
                validate_org(db, obj, by, item.accept)
                results["validated" if item.accept else "rejected"] += 1
            else:
                results["not_found"] += 1

        elif etype == "opportunity":
            obj = db.query(Opportunity).filter(Opportunity.id == item.entity_id).first()
            if obj:
                validate_opp(db, obj, by, item.accept)
                results["validated" if item.accept else "rejected"] += 1
            else:
                results["not_found"] += 1

        elif etype == "tender":
            obj = db.query(Tender).filter(Tender.id == item.entity_id).first()
            if obj:
                validate_tender(db, obj, by, item.accept)
                results["validated" if item.accept else "rejected"] += 1
            else:
                results["not_found"] += 1

        else:
            raise HTTPException(status_code=400, detail=f"Unknown entity_type: {etype}")

    return {"success": True, **results, "validated_by": by}


@router.post("/scan/boamp")
def trigger_boamp_scan(
    payload: BoampScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Manually trigger a BOAMP scan.
    Runs synchronously — may take 10–60s depending on LLM latency.
    """
    result = suggest_from_boamp(
        db,
        days_back=payload.days_back,
        max_results=payload.max_results,
        min_score=payload.min_score,
    )
    return result


@router.post("/import/text")
def import_from_text(
    payload: TextImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Create a pending suggestion from pasted text
    (AO description, email, web page content…).
    LLM extracts structured fields automatically.
    """
    if len(payload.text.strip()) < 30:
        raise HTTPException(
            status_code=400,
            detail="Texte trop court. Collez au moins 30 caractères.",
        )
    return suggest_from_text(
        db,
        text=payload.text,
        source_label=payload.source_label,
        source_url=payload.source_url,
    )
