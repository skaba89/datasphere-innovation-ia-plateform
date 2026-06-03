from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


def list_organizations(db: Session, skip: int = 0, limit: int = 100, include_pending: bool = False) -> list[Organization]:
    q = db.query(Organization).order_by(Organization.created_at.desc())
    if not include_pending:
        q = q.filter(Organization.validation_status != "pending")
    return q.offset(skip).limit(limit).all()


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


def get_organization_by_name(db: Session, name: str) -> Organization | None:
    return db.query(Organization).filter(
        Organization.name.ilike(name.strip())
    ).first()


def list_pending_suggestions(db: Session) -> list[Organization]:
    return (
        db.query(Organization)
        .filter(Organization.validation_status == "pending")
        .order_by(Organization.created_at.desc())
        .all()
    )


def validate_suggestion(
    db: Session,
    org: Organization,
    validated_by: str,
    accept: bool,
) -> Organization:
    from datetime import datetime
    org.validation_status = "validated" if accept else "rejected"
    org.validated_by = validated_by
    org.validated_at = datetime.utcnow()
    db.add(org)
    db.commit()
    db.refresh(org)
    return org
