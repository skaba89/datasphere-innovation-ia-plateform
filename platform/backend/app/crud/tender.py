from sqlalchemy.orm import Session

from app.models.tender import Tender, TenderRequirement
from app.schemas.tender import (
    TenderCreate,
    TenderRequirementCreate,
    TenderRequirementUpdate,
    TenderUpdate,
)


def list_tenders(db: Session, skip: int = 0, limit: int = 100) -> list[Tender]:
    return db.query(Tender).order_by(Tender.created_at.desc()).offset(skip).limit(limit).all()


def get_tender(db: Session, tender_id: int) -> Tender | None:
    return db.query(Tender).filter(Tender.id == tender_id).first()


def create_tender(db: Session, payload: TenderCreate) -> Tender:
    tender = Tender(**payload.model_dump())
    db.add(tender)
    db.commit()
    db.refresh(tender)
    return tender


def update_tender(db: Session, tender: Tender, payload: TenderUpdate) -> Tender:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tender, field, value)
    db.add(tender)
    db.commit()
    db.refresh(tender)
    return tender


def delete_tender(db: Session, tender: Tender) -> None:
    db.delete(tender)
    db.commit()


def list_tender_requirements(db: Session, tender_id: int, skip: int = 0, limit: int = 200) -> list[TenderRequirement]:
    return (
        db.query(TenderRequirement)
        .filter(TenderRequirement.tender_id == tender_id)
        .order_by(TenderRequirement.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_tender_requirement(db: Session, requirement_id: int) -> TenderRequirement | None:
    return db.query(TenderRequirement).filter(TenderRequirement.id == requirement_id).first()


def create_tender_requirement(db: Session, payload: TenderRequirementCreate) -> TenderRequirement:
    requirement = TenderRequirement(**payload.model_dump())
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def update_tender_requirement(db: Session, requirement: TenderRequirement, payload: TenderRequirementUpdate) -> TenderRequirement:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(requirement, field, value)
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def delete_tender_requirement(db: Session, requirement: TenderRequirement) -> None:
    db.delete(requirement)
    db.commit()
