from sqlalchemy.orm import Session

from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactUpdate


def list_contacts(
    db: Session,
    organization_id: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Contact]:
    query = db.query(Contact).order_by(Contact.last_name, Contact.first_name)
    if organization_id is not None:
        query = query.filter(Contact.organization_id == organization_id)
    if search:
        term = f"%{search}%"
        query = query.filter(
            Contact.first_name.ilike(term)
            | Contact.last_name.ilike(term)
            | Contact.professional_email.ilike(term)
            | Contact.job_title.ilike(term)
        )
    return query.offset(skip).limit(limit).all()


def get_contact(db: Session, contact_id: int) -> Contact | None:
    return db.query(Contact).filter(Contact.id == contact_id).first()


def create_contact(db: Session, payload: ContactCreate) -> Contact:
    contact = Contact(**payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def update_contact(db: Session, contact: Contact, payload: ContactUpdate) -> Contact:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def delete_contact(db: Session, contact: Contact) -> None:
    db.delete(contact)
    db.commit()


def count_contacts_by_org(db: Session, organization_id: int) -> int:
    return db.query(Contact).filter(Contact.organization_id == organization_id).count()
