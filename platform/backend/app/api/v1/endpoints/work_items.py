from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.agent import get_agent, get_assignment
from app.crud.opportunity import get_opportunity
from app.crud.tender import get_tender
from app.crud.work_item import create_work_item, get_work_item, list_work_items, mark_completed, mark_reviewed, update_work_item
from app.db.session import get_db
from app.schemas.user import UserRead
from app.schemas.work_item import WorkItemCreate, WorkItemRead, WorkItemUpdate

router = APIRouter(prefix="/work-items", tags=["work-items"], dependencies=[Depends(get_current_user)])


def validate_relations(db: Session, payload: WorkItemCreate) -> None:
    if payload.agent_id is not None and get_agent(db, payload.agent_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent does not exist")
    if payload.assignment_id is not None and get_assignment(db, payload.assignment_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not exist")
    if payload.opportunity_id is not None and get_opportunity(db, payload.opportunity_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opportunity does not exist")
    if payload.tender_id is not None and get_tender(db, payload.tender_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tender does not exist")


@router.get("", response_model=list[WorkItemRead])
def read_work_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_work_items(db, skip=skip, limit=limit)


@router.post("", response_model=WorkItemRead, status_code=status.HTTP_201_CREATED)
def create_new_work_item(payload: WorkItemCreate, db: Session = Depends(get_db)):
    validate_relations(db, payload)
    return create_work_item(db, payload)


@router.get("/{item_id}", response_model=WorkItemRead)
def read_work_item(item_id: int, db: Session = Depends(get_db)):
    item = get_work_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")
    return item


@router.patch("/{item_id}", response_model=WorkItemRead)
def patch_work_item(item_id: int, payload: WorkItemUpdate, db: Session = Depends(get_db)):
    item = get_work_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")
    return update_work_item(db, item, payload)


@router.post("/{item_id}/review", response_model=WorkItemRead)
def review_work_item(item_id: int, current_user: UserRead = Depends(get_current_user), db: Session = Depends(get_db)):
    item = get_work_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")
    reviewer = current_user.email
    return mark_reviewed(db, item, reviewer)


@router.post("/{item_id}/complete", response_model=WorkItemRead)
def complete_work_item(item_id: int, db: Session = Depends(get_db)):
    item = get_work_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")
    if item.needs_review and item.reviewed_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Review required before completion")
    return mark_completed(db, item)
