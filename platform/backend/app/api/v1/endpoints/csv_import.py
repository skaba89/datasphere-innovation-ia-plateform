"""
CSV Import — import en masse organisations et contacts.

POST /import/organizations  — importer depuis un CSV organisations
POST /import/contacts       — importer depuis un CSV contacts
GET  /import/template/organizations — télécharger un CSV template
GET  /import/template/contacts      — télécharger un CSV template

Format attendu (organisations) :
  name,country,sector,website,phone,email,description
  "Ministère du Numérique GN","GN","Public","","","","..."

Format attendu (contacts) :
  first_name,last_name,email,phone,job_title,organization_name,country
  "Mamadou","Diallo","m.diallo@example.com","","DSI","BCRG","GN"
"""

from __future__ import annotations

import csv
import io
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User

log = logging.getLogger("datasphere.csv_import")

router = APIRouter(
    prefix="/import",
    tags=["import"],
    dependencies=[Depends(get_current_user)],
)

MAX_ROWS = 2000  # Security limit


# ── Template downloads ────────────────────────────────────────────────────────

ORG_HEADERS  = ["name", "country", "sector", "website", "phone", "email", "description"]
ORG_EXAMPLE  = ["Ministère du Numérique GN", "GN", "Public", "https://numerique.gov.gn", "+224 xxx", "contact@numerique.gov.gn", "Ministère en charge de la transformation numérique"]

CONT_HEADERS = ["first_name", "last_name", "email", "phone", "job_title", "organization_name", "country"]
CONT_EXAMPLE = ["Mamadou", "Diallo", "m.diallo@example.com", "+224 621 000 000", "Directeur SI", "BCRG", "GN"]


@router.get("/template/organizations", response_class=PlainTextResponse)
def org_template():
    """Download CSV template for organizations import."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(ORG_HEADERS)
    w.writerow(ORG_EXAMPLE)
    return PlainTextResponse(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=\"organisations_template.csv\""},
    )


@router.get("/template/contacts", response_class=PlainTextResponse)
def contacts_template():
    """Download CSV template for contacts import."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CONT_HEADERS)
    w.writerow(CONT_EXAMPLE)
    return PlainTextResponse(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=\"contacts_template.csv\""},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_csv(content: bytes, expected_headers: list[str]) -> list[dict[str, str]]:
    """Parse CSV bytes, validate headers, return list of row dicts."""
    try:
        text = content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []

    # Check required headers
    missing = [h for h in expected_headers[:2] if h not in headers]  # first 2 are required
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Colonnes requises manquantes : {missing}. Colonnes trouvées : {list(headers)}",
        )

    rows = []
    for i, row in enumerate(reader):
        if i >= MAX_ROWS:
            break
        rows.append({k.strip(): (v or "").strip() for k, v in row.items()})

    return rows


# ── Org import ────────────────────────────────────────────────────────────────

@router.post("/organizations")
async def import_organizations(
    file: UploadFile = File(...),
    dry_run: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import organizations from a CSV file.

    Returns:
      - created: number of new organizations created
      - skipped: rows that were invalid or already exist
      - errors:  list of error messages (row number + reason)
    """
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 5 MB)")

    rows = _parse_csv(content, ORG_HEADERS)

    from app.crud.organization import create_organization, list_organizations
    from app.schemas.organization import OrganizationCreate

    # Build existing names set (case-insensitive, for duplicate detection)
    existing_names = {o.name.lower() for o in list_organizations(db, limit=10000)}

    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(rows, start=2):  # row 1 = header
        name = row.get("name", "").strip()
        if not name:
            errors.append({"row": i, "reason": "Nom manquant"})
            skipped += 1
            continue

        if name.lower() in existing_names:
            skipped += 1
            continue

        try:
            if not dry_run:
                org = create_organization(db, OrganizationCreate(
                    name=name,
                    country=row.get("country") or None,
                    sector=row.get("sector") or None,
                    website=row.get("website") or None,
                    phone=row.get("phone") or None,
                    email=row.get("email") or None,
                    description=row.get("description") or None,
                ))
                org.created_by_email = current_user.email
                db.commit()
                existing_names.add(name.lower())
            created += 1
        except Exception as e:
            errors.append({"row": i, "reason": str(e)[:200]})
            skipped += 1

    log.info(
        "CSV org import: user=%s created=%d skipped=%d errors=%d dry_run=%s",
        current_user.email, created, skipped, len(errors), dry_run,
    )

    return {
        "total_rows":    len(rows),
        "created":       created,
        "skipped":       skipped,
        "error_count":   len(errors),
        "errors":        errors[:20],  # max 20 errors returned
        "dry_run":       dry_run,
        "message": f"{'Simulation : ' if dry_run else ''}{created} organisation(s) {'seraient ' if dry_run else ''}créée(s)",
    }


# ── Contact import ────────────────────────────────────────────────────────────

@router.post("/contacts")
async def import_contacts(
    file: UploadFile = File(...),
    dry_run: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import contacts from a CSV file.
    Automatically links to existing organizations by name (case-insensitive).
    """
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 5 MB)")

    rows = _parse_csv(content, CONT_HEADERS)

    from app.crud.contact import create_contact, list_contacts
    from app.crud.organization import list_organizations
    from app.schemas.contact import ContactCreate

    # Build org name → id map
    org_map = {o.name.lower(): o.id for o in list_organizations(db, limit=10000)}

    # Existing emails for duplicate check
    existing_emails = {
        c.professional_email.lower()
        for c in list_contacts(db, limit=100000)
        if c.professional_email
    }

    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(rows, start=2):
        first_name = row.get("first_name", "").strip()
        last_name  = row.get("last_name", "").strip()
        email      = row.get("email", "").strip()

        if not first_name and not last_name:
            errors.append({"row": i, "reason": "Prénom et nom manquants"})
            skipped += 1
            continue

        if email and email.lower() in existing_emails:
            skipped += 1
            continue

        # Resolve organization
        org_name = row.get("organization_name", "").strip()
        org_id   = org_map.get(org_name.lower()) if org_name else None

        try:
            if not dry_run:
                contact = create_contact(db, ContactCreate(
                    first_name=first_name or None,
                    last_name=last_name or None,
                    professional_email=email or None,
                    phone=row.get("phone") or None,
                    job_title=row.get("job_title") or None,
                    organization_id=org_id,
                    country=row.get("country") or None,
                ))
                if email:
                    existing_emails.add(email.lower())
            created += 1
        except Exception as e:
            errors.append({"row": i, "reason": str(e)[:200]})
            skipped += 1

    return {
        "total_rows":   len(rows),
        "created":      created,
        "skipped":      skipped,
        "error_count":  len(errors),
        "errors":       errors[:20],
        "dry_run":      dry_run,
        "message": f"{'Simulation : ' if dry_run else ''}{created} contact(s) {'seraient ' if dry_run else ''}créé(s)",
    }
