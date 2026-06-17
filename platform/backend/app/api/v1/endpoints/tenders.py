from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.workspace_scope import get_workspace_scope, WorkspaceContext
from app.models.user import User
from typing import Optional
from app.crud.opportunity import get_opportunity
from app.crud.tender import (
    create_tender,
    create_tender_requirement,
    delete_tender,
    delete_tender_requirement,
    get_tender,
    get_tender_requirement,
    list_tender_requirements,
    list_tenders,
    update_tender,
    update_tender_requirement,
)
from app.db.session import get_db
from app.schemas.tender import (
    TenderCreate,
    TenderRead,
    TenderRequirementCreate,
    TenderRequirementRead,
    TenderRequirementUpdate,
    TenderUpdate,
)

router = APIRouter(prefix="/tenders", tags=["tenders"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[TenderRead])
def read_tenders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    ws: Optional[WorkspaceContext] = Depends(get_workspace_scope),
):
    items = list_tenders(db, skip=skip, limit=limit)
    if ws is not None:
        items = [i for i in items if i.workspace_id is None or i.workspace_id == ws.id]
    return items


@router.post("", response_model=TenderRead, status_code=status.HTTP_201_CREATED)
def create_new_tender(payload: TenderCreate, db: Session = Depends(get_db)):
    opportunity = get_opportunity(db, payload.opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opportunity does not exist")
    return create_tender(db, payload)


@router.get("/{tender_id}", response_model=TenderRead)
def read_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = get_tender(db, tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return tender


@router.patch("/{tender_id}", response_model=TenderRead)
def patch_tender(tender_id: int, payload: TenderUpdate, db: Session = Depends(get_db)):
    tender = get_tender(db, tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return update_tender(db, tender, payload)


@router.delete("/{tender_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = get_tender(db, tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    delete_tender(db, tender)
    return None


@router.get("/{tender_id}/requirements", response_model=list[TenderRequirementRead])
def read_requirements(tender_id: int, skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    tender = get_tender(db, tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return list_tender_requirements(db, tender_id=tender_id, skip=skip, limit=limit)


@router.post("/{tender_id}/requirements", response_model=TenderRequirementRead, status_code=status.HTTP_201_CREATED)
def create_new_requirement(tender_id: int, payload: TenderRequirementCreate, db: Session = Depends(get_db)):
    """Create a requirement for a tender. tender_id in body is optional — auto-filled from URL."""
    tender = get_tender(db, tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    # Auto-set tender_id from URL if not in payload or mismatched
    if payload.tender_id != tender_id:
        payload = payload.model_copy(update={"tender_id": tender_id})
    return create_tender_requirement(db, payload)


@router.patch("/requirements/{requirement_id}", response_model=TenderRequirementRead)
def patch_requirement(requirement_id: int, payload: TenderRequirementUpdate, db: Session = Depends(get_db)):
    requirement = get_tender_requirement(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    return update_tender_requirement(db, requirement, payload)


@router.delete("/requirements/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_requirement(requirement_id: int, db: Session = Depends(get_db)):
    requirement = get_tender_requirement(db, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    delete_tender_requirement(db, requirement)
    return None

@router.post("/{tender_id}/score-ai")
def score_tender_with_rag(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Score Go/No-Go enrichi par RAG — analyse CCTP + historique livrables.
    Différenciateur clé : recommandation argumentée avec facteurs positifs/risques.
    """
    from app.models.tender import Tender
    from app.services.win_probability import compute_rag_enhanced_score

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="AO non trouvé")

    result = compute_rag_enhanced_score(db, tender)

    # Sauvegarder le score en base
    tender.go_no_go_score    = result["score"]
    tender.go_no_go_decision = result["decision"]
    tender.ai_notes          = result["recommendation"]
    db.commit()

    return result
