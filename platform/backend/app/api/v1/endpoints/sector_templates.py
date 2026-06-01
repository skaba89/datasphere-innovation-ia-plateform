from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.sector_template import install_builtin_templates, list_sector_templates, get_sector_template
from app.db.session import get_db
from app.models.deliverable import Deliverable
from app.schemas.commercial import SectorTemplateApplyRequest, SectorTemplateRead
from app.schemas.deliverable import DeliverableCreate, DeliverableRead
from app.crud.deliverable import create_deliverable
from app.services.deliverable_draft_engine import build_context_label, build_draft_title

router = APIRouter(
    prefix="/sector-templates",
    tags=["sector-templates"],
    dependencies=[Depends(get_current_user)],
)

# ── Sector key labels ────────────────────────────────────────────────────────
_SECTOR_LABELS: dict[str, str] = {
    "telecom": "Télécommunications & Régulation",
    "finance": "Finance, Banque & Assurance",
    "public": "Secteur public & Institutions",
    "energy": "Énergie, Industrie & Environnement",
    "it_digital": "IT, Digital & SaaS",
}


@router.post("/install", response_model=list[SectorTemplateRead], status_code=status.HTTP_201_CREATED)
def install_templates(db: Session = Depends(get_db)):
    """Install all built-in sector templates (idempotent)."""
    return install_builtin_templates(db)


@router.get("", response_model=list[SectorTemplateRead])
def list_templates(
    sector_key: str | None = None,
    deliverable_type: str | None = None,
    db: Session = Depends(get_db),
):
    """List sector templates with optional filters."""
    return list_sector_templates(db, sector_key=sector_key, deliverable_type=deliverable_type)


@router.get("/sectors")
def list_sectors():
    """Return the list of available sectors."""
    return [
        {"key": k, "label": v}
        for k, v in _SECTOR_LABELS.items()
    ]


@router.post("/apply", response_model=DeliverableRead, status_code=status.HTTP_201_CREATED)
def apply_sector_template(payload: SectorTemplateApplyRequest, db: Session = Depends(get_db)):
    """
    Create a new deliverable from a sector template.
    The template content replaces the generic default content.
    """
    tpl = get_sector_template(db, payload.sector_key, payload.deliverable_type)
    if tpl is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No template found for sector '{payload.sector_key}' and type '{payload.deliverable_type}'. "
                   "Run POST /sector-templates/install first.",
        )

    # Build context label for the title
    context_label = build_context_label(
        db,
        payload.opportunity_id,
        payload.tender_id,
        payload.assignment_id,
        None,
    )

    title = tpl.title_template.replace("{context}", context_label) if "{context}" in tpl.title_template else tpl.title_template

    new_deliverable = DeliverableCreate(
        opportunity_id=payload.opportunity_id,
        tender_id=payload.tender_id,
        assignment_id=payload.assignment_id,
        title=title,
        deliverable_type=payload.deliverable_type,
        content_markdown=tpl.content_markdown,
        generated_by=f"sector-template/{payload.sector_key}",
        language=payload.language,
        audience=payload.audience or tpl.description,
        summary=tpl.description,
        tags=tpl.tags,
        status="draft",
    )

    return create_deliverable(db, new_deliverable)
