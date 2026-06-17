from fastapi import APIRouter, File, Query, UploadFile, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.models.user import User
from app.api.workspace_scope import get_workspace_scope, WorkspaceContext
from typing import Optional
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
    current_user=Depends(get_current_user),
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

@router.post("/import-csv")
async def import_contacts_csv(
    file: UploadFile = File(...),
    organization_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import de contacts depuis un fichier CSV ou Excel.
    Colonnes acceptées (flexibles): prenom/first_name, nom/last_name,
    email/professional_email, poste/job_title, organisation/organization,
    telephone/phone, linkedin
    """
    import io, csv
    from app.crud.organization import get_organization_by_name, create_organization
    from app.schemas.organization import OrganizationCreate
    from app.schemas.contact import ContactCreate

    content_bytes = await file.read()
    content_str = content_bytes.decode("utf-8-sig", errors="replace")

    # Détecter le séparateur (virgule ou point-virgule)
    sep = ";" if content_str.count(";") > content_str.count(",") else ","

    reader = csv.DictReader(io.StringIO(content_str), delimiter=sep)

    # Normaliser les noms de colonnes (majuscules, accents, espaces)
    import unicodedata
    def norm(s: str) -> str:
        s = unicodedata.normalize("NFD", s.lower().strip())
        return "".join(c for c in s if unicodedata.category(c) != "Mn").replace(" ", "_")

    created = 0
    skipped = 0
    errors  = []

    FIELD_MAP = {
        "prenom": "first_name", "firstname": "first_name", "first_name": "first_name",
        "nom": "last_name",     "lastname": "last_name",   "last_name": "last_name",
        "email": "email",       "mail": "email",           "professional_email": "email",
        "courriel": "email",
        "poste": "job_title",   "fonction": "job_title",   "job_title": "job_title",
        "titre": "job_title",
        "organisation": "org",  "entreprise": "org",       "societe": "org",
        "company": "org",       "organization": "org",
        "telephone": "phone",   "tel": "phone",            "phone": "phone",
        "linkedin": "linkedin_url",
        "notes": "notes",
    }

    for i, row in enumerate(reader):
        if i > 500:  # max 500 lignes par import
            break
        try:
            norm_row = {FIELD_MAP.get(norm(k), norm(k)): v.strip() for k, v in row.items() if v.strip()}

            email = norm_row.get("email", "")
            first = norm_row.get("first_name", "")
            last  = norm_row.get("last_name", "")

            if not email and not (first and last):
                skipped += 1
                continue

            # Organisation
            org_id = organization_id
            if not org_id and norm_row.get("org"):
                org = get_organization_by_name(db, norm_row["org"])
                if not org:
                    org = create_organization(db, OrganizationCreate(
                        name=norm_row["org"][:255],
                        source="csv_import",
                    ))
                org_id = org.id

            if not org_id:
                skipped += 1
                errors.append(f"Ligne {i+2}: organisation manquante pour {email or first}")
                continue

            # Créer le contact
            from app.crud.contact import get_contact_by_email, create_contact
            if email and get_contact_by_email(db, email):
                skipped += 1
                continue

            create_contact(db, ContactCreate(
                organization_id=org_id,
                first_name=first[:100] if first else None,
                last_name=last[:100]   if last  else None,
                professional_email=email[:255] if email else None,
                job_title=norm_row.get("job_title", "")[:200] or None,
                linkedin_url=norm_row.get("linkedin_url", "")[:500] or None,
                notes=norm_row.get("notes", "")[:500] or None,
                source="csv_import",
            ))
            created += 1

        except Exception as e:
            errors.append(f"Ligne {i+2}: {str(e)[:80]}")

    return {
        "created": created,
        "skipped": skipped,
        "errors": len(errors),
        "error_samples": errors[:5],
        "message": f"✅ {created} contact(s) importé(s)" + (f", {skipped} ignoré(s)" if skipped else ""),
    }
