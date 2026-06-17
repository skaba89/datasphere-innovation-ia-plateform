"""
CRM Import — Import CSV/Excel contacts et organisations

POST /crm/import/contacts      → CSV avec colonnes: nom, prénom, email, organisation, titre
POST /crm/import/organizations → CSV avec colonnes: nom, secteur, pays, type, site
GET  /crm/import/template      → Télécharger un template CSV vide
"""
from __future__ import annotations
import csv
import io
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/crm/import", tags=["crm-import"])
log = logging.getLogger("datasphere.crm_import")


def _decode_csv(data: bytes) -> list[dict]:
    """Décode un CSV en liste de dicts, gère UTF-8 et latin-1."""
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = data.decode(encoding)
            reader = csv.DictReader(io.StringIO(text), delimiter=None)  # type: ignore[arg-type]
            # Détecter le délimiteur
            sample = text[:2000]
            delim = ";" if sample.count(";") > sample.count(",") else ","
            reader = csv.DictReader(io.StringIO(text), delimiter=delim)
            # Normaliser les noms de colonnes (strip + lower)
            rows = []
            for row in reader:
                rows.append({k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items()})
            return rows
        except Exception:
            continue
    raise ValueError("Impossible de décoder le CSV (essayez UTF-8 ou Latin-1)")


def _normalize(row: dict, *keys: str) -> str:
    """Cherche une valeur dans un dict avec plusieurs clés alternatives."""
    for k in keys:
        v = row.get(k, "").strip()
        if v:
            return v
    return ""


@router.get("/template/contacts")
def download_contacts_template(current_user: User = Depends(get_current_user)):
    """Télécharger le template CSV pour l'import de contacts."""
    from fastapi.responses import Response
    csv_content = (
        "prenom;nom;email;titre;organisation;telephone;linkedin\n"
        "Cheickna;Kaba;cheickna@exemple.fr;DSI;Ministère du Numérique;+33 1 23 45 67 89;https://linkedin.com/in/cheickna\n"
        "Marie;Dupont;marie@exemple.fr;Directrice achats;Mairie de Paris;;https://linkedin.com/in/marie\n"
    )
    return Response(
        content=csv_content.encode("utf-8-sig"),  # BOM pour Excel
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="template_contacts_datasphere.csv"'},
    )


@router.get("/template/organizations")
def download_orgs_template(current_user: User = Depends(get_current_user)):
    """Télécharger le template CSV pour l'import d'organisations."""
    from fastapi.responses import Response
    csv_content = (
        "nom;secteur;type;pays;site_web;description\n"
        "Ministère du Numérique;Data / IA / Numérique;Ministère;France;https://numerique.gouv.fr;Direction du numérique de l'état\n"
        "DINUM;Data / IA / Numérique;Administration centrale;France;https://www.numerique.gouv.fr;\n"
    )
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="template_organisations_datasphere.csv"'},
    )


@router.post("/contacts")
async def import_contacts_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import CSV de contacts CRM.
    Colonnes reconnues: prenom/first_name, nom/last_name, email, titre/job_title,
    organisation/organization/company, telephone/phone, linkedin/linkedin_url
    """
    from app.crud.contact import create_contact, get_contact_by_email
    from app.crud.organization import get_organization_by_name, create_organization
    from app.schemas.contact import ContactCreate
    from app.schemas.organization import OrganizationCreate
    from app.services.crm_auto_extract import guess_sector, guess_org_type

    if not file.filename or not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(400, "Fichier CSV requis (.csv ou .txt)")

    data = await file.read()
    if len(data) > 5_000_000:
        raise HTTPException(400, "Fichier trop volumineux (max 5 Mo)")

    try:
        rows = _decode_csv(data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    created, updated, skipped, errors = 0, 0, 0, []

    for i, row in enumerate(rows[:500]):  # max 500 contacts par batch
        try:
            email = _normalize(row, "email", "e-mail", "mail", "courriel")
            first = _normalize(row, "prenom", "first_name", "prénom", "firstname")
            last  = _normalize(row, "nom", "last_name", "lastname", "name")
            title = _normalize(row, "titre", "job_title", "fonction", "poste", "role")
            org_n = _normalize(row, "organisation", "organization", "company", "entreprise", "societe", "société")
            phone = _normalize(row, "telephone", "phone", "tel", "téléphone")
            lkdn  = _normalize(row, "linkedin", "linkedin_url")

            if not email and not (first and last):
                skipped += 1
                continue

            # Créer/trouver l'organisation
            org_id = None
            if org_n:
                org = get_organization_by_name(db, org_n)
                if not org:
                    org = create_organization(db, OrganizationCreate(
                        name=org_n[:255],
                        sector=guess_sector(org_n),
                        organization_type=guess_org_type(org_n),
                        country="France",
                        source="csv_import",
                        confidence_score=0.7,
                    ))
                org_id = org.id

            if not org_id:
                skipped += 1
                errors.append(f"Ligne {i+2}: organisation manquante pour {email or f'{first} {last}'}")
                continue

            # Vérifier doublon email
            if email and get_contact_by_email(db, email):
                skipped += 1
                continue

            create_contact(db, ContactCreate(
                organization_id=org_id,
                first_name=first[:100] if first else None,
                last_name=last[:100] if last else None,
                professional_email=email[:255] if email else None,
                job_title=title[:150] if title else None,
                linkedin_url=lkdn[:500] if lkdn else None,
                source="csv_import",
                notes=f"Importé depuis CSV le {__import__('datetime').date.today()}",
            ))
            created += 1

        except Exception as e:
            errors.append(f"Ligne {i+2}: {str(e)[:80]}")

    log.info("CRM import contacts: %d créés, %d ignorés, %d erreurs", created, skipped, len(errors))
    return {
        "created": created,
        "skipped": skipped,
        "errors": len(errors),
        "error_details": errors[:10],
        "message": f"✅ {created} contact(s) importé(s){f', {skipped} ignoré(s)' if skipped else ''}",
    }


@router.post("/organizations")
async def import_organizations_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import CSV d'organisations CRM."""
    from app.crud.organization import get_organization_by_name, create_organization
    from app.schemas.organization import OrganizationCreate
    from app.services.crm_auto_extract import guess_sector, guess_org_type

    data = await file.read()
    try:
        rows = _decode_csv(data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    created, skipped = 0, 0

    for row in rows[:1000]:
        name = _normalize(row, "nom", "name", "organisation", "organization", "company")
        if not name or len(name) < 2:
            skipped += 1
            continue
        if get_organization_by_name(db, name):
            skipped += 1
            continue
        try:
            sector = _normalize(row, "secteur", "sector") or guess_sector(name)
            org_type = _normalize(row, "type") or guess_org_type(name)
            create_organization(db, OrganizationCreate(
                name=name[:255],
                sector=sector[:100] if sector else None,
                organization_type=org_type[:100] if org_type else None,
                country=_normalize(row, "pays", "country") or "France",
                website=_normalize(row, "site_web", "website", "site") or None,
                description=_normalize(row, "description") or None,
                source="csv_import",
                confidence_score=0.7,
            ))
            created += 1
        except Exception:
            skipped += 1

    return {
        "created": created,
        "skipped": skipped,
        "message": f"✅ {created} organisation(s) importée(s)",
    }
