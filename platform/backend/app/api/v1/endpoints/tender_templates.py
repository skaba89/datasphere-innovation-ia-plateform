from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.tender import get_tender
from app.db.session import get_db
from app.schemas.tender_governance import ComplianceMatrixItemRead, GoNoGoCriterionRead
from app.services.tender_templates import (
    apply_default_go_no_go_template,
    generate_compliance_from_requirements,
)

router = APIRouter(prefix="/tender-templates", tags=["tender-templates"], dependencies=[Depends(get_current_user)])


@router.post("/tenders/{tender_id}/go-no-go/default", response_model=list[GoNoGoCriterionRead])
def apply_go_no_go_template(tender_id: int, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return apply_default_go_no_go_template(db, tender_id)


@router.post("/tenders/{tender_id}/compliance/from-requirements", response_model=list[ComplianceMatrixItemRead])
def build_compliance_from_requirements(tender_id: int, db: Session = Depends(get_db)):
    if get_tender(db, tender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return generate_compliance_from_requirements(db, tender_id)
