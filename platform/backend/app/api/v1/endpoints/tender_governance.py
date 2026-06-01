from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.tender import get_tender, get_tender_requirement
from app.crud.tender_governance import (
    compute_compliance_summary,
    compute_go_no_go_summary,
    create_compliance_item,
    create_go_no_go_criterion,
    delete_compliance_item,
    delete_go_no_go_criterion,
    get_compliance_item,
    get_go_no_go_criterion,
    list_compliance_items,
    list_go_no_go_criteria,
    update_compliance_item,
    update_go_no_go_criterion,
)
from app.db.session import get_db
from app.schemas.tender_governance import (
    ComplianceMatrixItemCreate,
    ComplianceMatrixItemRead,
    ComplianceMatrixItemUpdate,
    ComplianceSummary,
    GoNoGoCriterionCreate,
    GoNoGoCriterionRead,
    GoNoGoCriterionUpdate,
    GoNoGoSummary,
)

router = APIRouter(prefix="/tender-governance", tags=["tender-governance"], dependencies=[Depends(get_current_user)])


@router.get("/tenders/{tender_id}/go-no-go", response_model=list[GoNoGoCriterionRead])
def read_go_no_go_criteria(tender_id: int, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return list_go_no_go_criteria(db, tender_id)


@router.post("/tenders/{tender_id}/go-no-go", response_model=GoNoGoCriterionRead, status_code=status.HTTP_201_CREATED)
def create_go_no_go(tender_id: int, payload: GoNoGoCriterionCreate, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    if payload.tender_id != tender_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload tender_id does not match URL tender_id")
    return create_go_no_go_criterion(db, payload)


@router.patch("/go-no-go/{criterion_id}", response_model=GoNoGoCriterionRead)
def patch_go_no_go(criterion_id: int, payload: GoNoGoCriterionUpdate, db: Session = Depends(get_db)):
    criterion = get_go_no_go_criterion(db, criterion_id)
    if criterion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Criterion not found")
    return update_go_no_go_criterion(db, criterion, payload)


@router.delete("/go-no-go/{criterion_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_go_no_go(criterion_id: int, db: Session = Depends(get_db)):
    criterion = get_go_no_go_criterion(db, criterion_id)
    if criterion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Criterion not found")
    delete_go_no_go_criterion(db, criterion)
    return None


@router.get("/tenders/{tender_id}/go-no-go/summary", response_model=GoNoGoSummary)
def read_go_no_go_summary(tender_id: int, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    criteria = list_go_no_go_criteria(db, tender_id)
    return compute_go_no_go_summary(criteria, tender_id)


@router.get("/tenders/{tender_id}/compliance", response_model=list[ComplianceMatrixItemRead])
def read_compliance_items(tender_id: int, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return list_compliance_items(db, tender_id)


@router.post("/tenders/{tender_id}/compliance", response_model=ComplianceMatrixItemRead, status_code=status.HTTP_201_CREATED)
def create_compliance(tender_id: int, payload: ComplianceMatrixItemCreate, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    if payload.tender_id != tender_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload tender_id does not match URL tender_id")
    if payload.requirement_id is not None and get_tender_requirement(db, payload.requirement_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requirement does not exist")
    return create_compliance_item(db, payload)


@router.patch("/compliance/{item_id}", response_model=ComplianceMatrixItemRead)
def patch_compliance(item_id: int, payload: ComplianceMatrixItemUpdate, db: Session = Depends(get_db)):
    item = get_compliance_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compliance item not found")
    return update_compliance_item(db, item, payload)


@router.delete("/compliance/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_compliance(item_id: int, db: Session = Depends(get_db)):
    item = get_compliance_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compliance item not found")
    delete_compliance_item(db, item)
    return None


@router.get("/tenders/{tender_id}/compliance/summary", response_model=ComplianceSummary)
def read_compliance_summary(tender_id: int, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    items = list_compliance_items(db, tender_id)
    return compute_compliance_summary(items, tender_id)


# ── Go/No-Go AI Recommendation ────────────────────────────────────────────────

from app.schemas.commercial import GoNoGoRecommendation  # noqa: E402


@router.get("/tenders/{tender_id}/go-no-go/recommendation", response_model=GoNoGoRecommendation)
def get_gonogo_recommendation(tender_id: int, db: Session = Depends(get_db)):
    """
    Generate an AI-powered Go/No-Go recommendation from criteria, tender and
    opportunity context. Falls back to rule-based analysis if no LLM is configured.
    """
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    try:
        from app.services.gonogo_advisor import get_go_no_go_recommendation
        return get_go_no_go_recommendation(db, tender_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation error: {exc}",
        ) from exc
