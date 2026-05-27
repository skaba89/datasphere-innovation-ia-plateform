from datetime import datetime

from sqlalchemy.orm import Session

from app.models.work_item import WorkItem
from app.schemas.work_item import WorkItemCreate, WorkItemUpdate


def list_work_items(db: Session, skip: int = 0, limit: int = 100) -> list[WorkItem]:
    return db.query(WorkItem).order_by(WorkItem.created_at.desc()).offset(skip).limit(limit).all()


def get_work_item(db: Session, item_id: int) -> WorkItem | None:
    return db.query(WorkItem).filter(WorkItem.id == item_id).first()


def create_work_item(db: Session, payload: WorkItemCreate) -> WorkItem:
    item = WorkItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_work_item(db: Session, item: WorkItem, payload: WorkItemUpdate) -> WorkItem:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def mark_reviewed(db: Session, item: WorkItem, reviewer: str) -> WorkItem:
    item.status = "reviewed"
    item.reviewed_by = reviewer
    item.reviewed_at = datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def mark_completed(db: Session, item: WorkItem) -> WorkItem:
    item.status = "completed"
    item.completed_at = datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
