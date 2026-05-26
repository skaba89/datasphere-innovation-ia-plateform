from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


def list_organizations(db: Session, skip: int = 0, limit: int = 100) -> list[Organization]:
    return db.query(Organization).order_by(Organization.created_at.desc()).offset(skip).limit(limit).all()


def get_organization(db: Session, organization_id: int) -> Organization | None:
    return db.query(Organization).filter(Organization.id == organization_id).first()


def create_organization(db: Session, payload: OrganizationCreate) -> Organization:
    organization = Organization(**payload.model_dump())
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def update_organization(db: Session, organization: Organization, payload: OrganizationUpdate) -> Organization:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(organization, field, value)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def delete_organization(db: Session, organization: Organization) -> None:
    db.delete(organization)
    db.commit()
