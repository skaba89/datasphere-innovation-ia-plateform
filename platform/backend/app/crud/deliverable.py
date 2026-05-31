from datetime import datetime

from sqlalchemy.orm import Session

from app.models.deliverable import Deliverable
from app.schemas.deliverable import DeliverableCreate, DeliverableUpdate


def list_deliverables(db: Session, skip: int = 0, limit: int = 100) -> list[Deliverable]:
    return db.query(Deliverable).order_by(Deliverable.created_at.desc()).offset(skip).limit(limit).all()


def get_deliverable(db: Session, deliverable_id: int) -> Deliverable | None:
    return db.query(Deliverable).filter(Deliverable.id == deliverable_id).first()


def create_deliverable(db: Session, payload: DeliverableCreate) -> Deliverable:
    deliverable = Deliverable(**payload.model_dump())
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    return deliverable


def update_deliverable(db: Session, deliverable: Deliverable, payload: DeliverableUpdate) -> Deliverable:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(deliverable, field, value)
    if payload.content_markdown is not None:
        deliverable.version = (deliverable.version or 1) + 1
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    return deliverable


def delete_deliverable(db: Session, deliverable: Deliverable) -> None:
    db.delete(deliverable)
    db.commit()


def mark_deliverable_in_review(db: Session, deliverable: Deliverable, reviewer_name: str) -> Deliverable:
    deliverable.status = "in_review"
    deliverable.reviewed_by = reviewer_name
    deliverable.reviewed_at = datetime.utcnow()
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    return deliverable


def approve_deliverable(db: Session, deliverable: Deliverable, approver_name: str) -> Deliverable:
    deliverable.status = "approved"
    deliverable.approved_by = approver_name
    deliverable.approved_at = datetime.utcnow()
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    return deliverable
