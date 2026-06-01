from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.contact import (
    count_contacts_by_org,
    create_contact,
    delete_contact,
    get_contact,
    list_contacts,
    update_contact,
)
from app.crud.organization import get_organization
from app.db.session import get_db
from app.schemas.contact import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[ContactRead])
def read_contacts(
    organization_id: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List contacts. Filter by organization and/or search term."""
    return list_contacts(db, organization_id=organization_id, search=search, skip=skip, limit=limit)


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def create_new_contact(payload: ContactCreate, db: Session = Depends(get_db)):
    if get_organization(db, payload.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization does not exist")
    return create_contact(db, payload)


@router.get("/{contact_id}", response_model=ContactRead)
def read_contact(contact_id: int, db: Session = Depends(get_db)):
    c = get_contact(db, contact_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return c


@router.patch("/{contact_id}", response_model=ContactRead)
def patch_contact(contact_id: int, payload: ContactUpdate, db: Session = Depends(get_db)):
    c = get_contact(db, contact_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return update_contact(db, c, payload)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(contact_id: int, db: Session = Depends(get_db)):
    c = get_contact(db, contact_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    delete_contact(db, c)
    return None
