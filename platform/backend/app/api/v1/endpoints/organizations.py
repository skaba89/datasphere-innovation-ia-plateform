from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.organization import (
    create_organization,
    delete_organization,
    get_organization,
    list_organizations,
    update_organization,
)
from app.db.session import get_db
from app.schemas.organization import OrganizationCreate, OrganizationRead, OrganizationUpdate

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationRead])
def read_organizations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_organizations(db, skip=skip, limit=limit)


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_new_organization(payload: OrganizationCreate, db: Session = Depends(get_db)):
    return create_organization(db, payload)


@router.get("/{organization_id}", response_model=OrganizationRead)
def read_organization(organization_id: int, db: Session = Depends(get_db)):
    organization = get_organization(db, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


@router.patch("/{organization_id}", response_model=OrganizationRead)
def patch_organization(organization_id: int, payload: OrganizationUpdate, db: Session = Depends(get_db)):
    organization = get_organization(db, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return update_organization(db, organization, payload)


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_organization(organization_id: int, db: Session = Depends(get_db)):
    organization = get_organization(db, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    delete_organization(db, organization)
    return None
