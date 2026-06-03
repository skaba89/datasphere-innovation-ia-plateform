from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.deliverable_section import AgentContribution, DeliverableSection
from app.schemas.deliverable_section import (
    AgentContributionCreate,
    AgentContributionUpdate,
    DeliverableSectionCreate,
    DeliverableSectionUpdate,
)


# --- Sections ---


def list_sections(db: Session, deliverable_id: int) -> list[DeliverableSection]:
    return (
        db.query(DeliverableSection)
        .filter(DeliverableSection.deliverable_id == deliverable_id)
        .order_by(DeliverableSection.position)
        .all()
    )


def get_section(db: Session, section_id: int) -> DeliverableSection | None:
    return db.query(DeliverableSection).filter(DeliverableSection.id == section_id).first()


def create_section(db: Session, payload: DeliverableSectionCreate) -> DeliverableSection:
    section = DeliverableSection(**payload.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def update_section(db: Session, section: DeliverableSection, payload: DeliverableSectionUpdate) -> DeliverableSection:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def delete_section(db: Session, section: DeliverableSection) -> None:
    db.delete(section)
    db.commit()


def review_section(db: Session, section: DeliverableSection, reviewer_name: str) -> DeliverableSection:
    section.status = "in_review"
    section.reviewed_by = reviewer_name
    section.reviewed_at = datetime.now(timezone.utc)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def approve_section(db: Session, section: DeliverableSection, approver_name: str) -> DeliverableSection:
    section.status = "approved"
    section.approved_by = approver_name
    section.approved_at = datetime.now(timezone.utc)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


# --- Contributions ---


def list_contributions(db: Session, deliverable_id: int) -> list[AgentContribution]:
    return (
        db.query(AgentContribution)
        .filter(AgentContribution.deliverable_id == deliverable_id)
        .order_by(AgentContribution.created_at.desc())
        .all()
    )


def get_contribution(db: Session, contribution_id: int) -> AgentContribution | None:
    return db.query(AgentContribution).filter(AgentContribution.id == contribution_id).first()


def create_contribution(db: Session, payload: AgentContributionCreate) -> AgentContribution:
    contribution = AgentContribution(**payload.model_dump())
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


def update_contribution(
    db: Session, contribution: AgentContribution, payload: AgentContributionUpdate
) -> AgentContribution:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contribution, field, value)
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution
