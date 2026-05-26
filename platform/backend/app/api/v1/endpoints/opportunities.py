from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("", response_model=list[OpportunityRead])
def read_opportunities(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_opportunities(db, skip=skip, limit=limit)


@router.post("", response_model=OpportunityRead, status_code=status.HTTP_201_CREATED)
def create_new_opportunity(payload: OpportunityCreate, db: Session = Depends(get_db)):
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
