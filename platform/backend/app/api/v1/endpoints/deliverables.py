from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.deliverable import (
    approve_deliverable,
    create_deliverable,
    delete_deliverable,
    get_deliverable,
    list_deliverables,
    mark_deliverable_in_review,
    update_deliverable,
)
from app.crud.deliverable_section import (
    approve_section,
    create_contribution,
    create_section,
    delete_section,
    get_contribution,
    get_section,
    list_contributions,
    list_sections,
    review_section,
    update_contribution,
    update_section,
)
from app.db.session import get_db
from app.schemas.deliverable import (
    DeliverableApproveRequest,
    DeliverableCreate,
    DeliverableGenerateDraftRequest,
    DeliverableRead,
    DeliverableReviewRequest,
    DeliverableUpdate,
)
from app.schemas.deliverable_section import (
    AgentContributionCreate,
    AgentContributionRead,
    AgentContributionUpdate,
    DeliverableSectionCreate,
    DeliverableSectionRead,
    DeliverableSectionUpdate,
    SectionApproveRequest,
    SectionReviewRequest,
)
from app.services.deliverable_draft_engine import (
    build_context_label,
    build_draft_title,
    generate_draft_content,
)

router = APIRouter(
    prefix="/deliverables",
    tags=["deliverables"],
    dependencies=[Depends(get_current_user)],
)


# ---------------------------------------------------------------------------
# Deliverables
# ---------------------------------------------------------------------------


@router.get("", response_model=list[DeliverableRead])
def read_deliverables(
    opportunity_id: int | None = None,
    tender_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    results = list_deliverables(db, skip=skip, limit=limit)
    if opportunity_id is not None:
        results = [d for d in results if d.opportunity_id == opportunity_id]
    if tender_id is not None:
        results = [d for d in results if d.tender_id == tender_id]
    return results


@router.post("", response_model=DeliverableRead, status_code=status.HTTP_201_CREATED)
def create_new_deliverable(payload: DeliverableCreate, db: Session = Depends(get_db)):
    return create_deliverable(db, payload)


@router.get("/{deliverable_id}", response_model=DeliverableRead)
def read_deliverable(deliverable_id: int, db: Session = Depends(get_db)):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return deliverable


@router.patch("/{deliverable_id}", response_model=DeliverableRead)
def patch_deliverable(deliverable_id: int, payload: DeliverableUpdate, db: Session = Depends(get_db)):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return update_deliverable(db, deliverable, payload)


@router.delete("/{deliverable_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_deliverable(deliverable_id: int, db: Session = Depends(get_db)):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    delete_deliverable(db, deliverable)


@router.post("/generate-draft", response_model=DeliverableRead, status_code=status.HTTP_201_CREATED)
def generate_draft_deliverable(payload: DeliverableGenerateDraftRequest, db: Session = Depends(get_db)):
    context_label = build_context_label(
        db,
        payload.opportunity_id,
        payload.tender_id,
        payload.assignment_id,
        payload.action_id,
    )
    title = build_draft_title(payload.deliverable_type, context_label)
    content = generate_draft_content(payload.deliverable_type, context_label, payload.language or "fr")

    create_payload = DeliverableCreate(
        opportunity_id=payload.opportunity_id,
        tender_id=payload.tender_id,
        assignment_id=payload.assignment_id,
        action_id=payload.action_id,
        title=title,
        deliverable_type=payload.deliverable_type,
        status="draft",
        language=payload.language or "fr",
        audience=payload.audience,
        content_markdown=content,
        generated_by=payload.generated_by or "agent",
        summary=f"Brouillon genere automatiquement pour : {context_label}",
    )
    return create_deliverable(db, create_payload)


@router.post("/{deliverable_id}/review", response_model=DeliverableRead)
def review_deliverable_action(
    deliverable_id: int,
    payload: DeliverableReviewRequest,
    db: Session = Depends(get_db),
):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return mark_deliverable_in_review(db, deliverable, payload.reviewer_name)


@router.post("/{deliverable_id}/approve", response_model=DeliverableRead)
def approve_deliverable_action(
    deliverable_id: int,
    payload: DeliverableApproveRequest,
    db: Session = Depends(get_db),
):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return approve_deliverable(db, deliverable, payload.approver_name)


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


@router.get("/{deliverable_id}/sections", response_model=list[DeliverableSectionRead])
def read_sections(deliverable_id: int, db: Session = Depends(get_db)):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return list_sections(db, deliverable_id)


@router.post(
    "/{deliverable_id}/sections",
    response_model=DeliverableSectionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_new_section(
    deliverable_id: int,
    payload: DeliverableSectionCreate,
    db: Session = Depends(get_db),
):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    if payload.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="deliverable_id mismatch")
    return create_section(db, payload)


@router.patch("/{deliverable_id}/sections/{section_id}", response_model=DeliverableSectionRead)
def patch_section(
    deliverable_id: int,
    section_id: int,
    payload: DeliverableSectionUpdate,
    db: Session = Depends(get_db),
):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return update_section(db, section, payload)


@router.delete("/{deliverable_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_section(deliverable_id: int, section_id: int, db: Session = Depends(get_db)):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    delete_section(db, section)


@router.post("/{deliverable_id}/sections/{section_id}/review", response_model=DeliverableSectionRead)
def review_section_action(
    deliverable_id: int,
    section_id: int,
    payload: SectionReviewRequest,
    db: Session = Depends(get_db),
):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return review_section(db, section, payload.reviewer_name)


@router.post("/{deliverable_id}/sections/{section_id}/approve", response_model=DeliverableSectionRead)
def approve_section_action(
    deliverable_id: int,
    section_id: int,
    payload: SectionApproveRequest,
    db: Session = Depends(get_db),
):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return approve_section(db, section, payload.approver_name)


# ---------------------------------------------------------------------------
# Contributions
# ---------------------------------------------------------------------------


@router.get("/{deliverable_id}/contributions", response_model=list[AgentContributionRead])
def read_contributions(deliverable_id: int, db: Session = Depends(get_db)):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return list_contributions(db, deliverable_id)


@router.post(
    "/{deliverable_id}/contributions",
    response_model=AgentContributionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_new_contribution(
    deliverable_id: int,
    payload: AgentContributionCreate,
    db: Session = Depends(get_db),
):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    if payload.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="deliverable_id mismatch")
    return create_contribution(db, payload)


@router.patch(
    "/{deliverable_id}/contributions/{contribution_id}",
    response_model=AgentContributionRead,
)
def patch_contribution(
    deliverable_id: int,
    contribution_id: int,
    payload: AgentContributionUpdate,
    db: Session = Depends(get_db),
):
    contribution = get_contribution(db, contribution_id)
    if contribution is None or contribution.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")
    return update_contribution(db, contribution, payload)
