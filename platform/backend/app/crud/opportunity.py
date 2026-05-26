from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate


def list_opportunities(db: Session, skip: int = 0, limit: int = 100) -> list[Opportunity]:
    return db.query(Opportunity).order_by(Opportunity.created_at.desc()).offset(skip).limit(limit).all()


def get_opportunity(db: Session, opportunity_id: int) -> Opportunity | None:
    return db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()


def create_opportunity(db: Session, payload: OpportunityCreate) -> Opportunity:
    opportunity = Opportunity(**payload.model_dump())
    db.add(opportunity)
    db.commit()
    db.refresh(opportunity)
    return opportunity


def update_opportunity(db: Session, opportunity: Opportunity, payload: OpportunityUpdate) -> Opportunity:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(opportunity, field, value)
    db.add(opportunity)
    db.commit()
    db.refresh(opportunity)
    return opportunity


def delete_opportunity(db: Session, opportunity: Opportunity) -> None:
    db.delete(opportunity)
    db.commit()
