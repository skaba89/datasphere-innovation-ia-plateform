"""
Tender Sources API — Sources multiples + extraction CRM automatique

GET  /tender-sources                    → liste toutes les sources disponibles
GET  /tender-sources/search             → cherche sur plusieurs sources
POST /tender-sources/import             → importe des AOs depuis les résultats
POST /tender-sources/crm-extract/{id}  → extrait CRM depuis un AO existant
POST /tender-sources/crm-bulk-extract  → extraction CRM en masse
GET  /tender-sources/crm-preview/{id}  → aperçu de l'extraction avant confirmation
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/tender-sources", tags=["tender-sources"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ImportTenderPayload(BaseModel):
    tenders: list[dict]
    auto_extract_crm: bool = True


class BulkExtractPayload(BaseModel):
    source_filter: str | None = None
    limit: int = 50


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_sources(current_user: User = Depends(get_current_user)):
    """Liste toutes les sources AO disponibles avec leur statut."""
    from app.services.tender_sources import get_all_sources
    return get_all_sources()


@router.get("/search")
def search_tenders(
    q: str = Query(..., min_length=2, description="Mots-clés de recherche"),
    sources: str = Query("boamp,ted,ai_web", description="Sources séparées par virgule"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recherche multi-sources en parallèle.
    Retourne les résultats groupés par source.
    """
    from app.services.tender_sources import search_all_sources
    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    results = search_all_sources(q, sources=source_list, limit_per_source=limit)
    total = sum(len(v) for v in results.values())
    return {
        "query": q,
        "sources_searched": source_list,
        "total": total,
        "results": results,
    }


@router.post("/import")
def import_tenders(
    payload: ImportTenderPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importe des AOs depuis les résultats de recherche multi-sources.
    Crée automatiquement les entités CRM si auto_extract_crm=True.
    """
    from app.crud.tender import create_tender
    from app.crud.opportunity import create_opportunity
    from app.crud.organization import get_organization_by_name, create_organization
    from app.schemas.tender import TenderCreate
    from app.schemas.opportunity import OpportunityCreate
    from app.schemas.organization import OrganizationCreate
    from app.services.crm_auto_extract import auto_extract_crm_from_tender, normalize_org_name

    imported = []
    errors = []

    for raw in payload.tenders[:50]:  # max 50 par batch
        try:
            # 1. Créer ou récupérer l'organisation pour avoir opportunity_id
            buyer = normalize_org_name(raw.get("buyer_name", "") or "")
            if not buyer:
                buyer = "Acheteur inconnu"

            org = get_organization_by_name(db, buyer)
            if not org:
                from app.services.crm_auto_extract import guess_sector, guess_org_type
                org = create_organization(db, OrganizationCreate(
                    name=buyer,
                    sector=guess_sector(raw.get("title", "")),
                    organization_type=guess_org_type(buyer),
                    country="France",
                    source=raw.get("source", "import"),
                    source_url=raw.get("source_url"),
                    confidence_score=0.8,
                ))

            # 2. Créer une opportunité de base pour l'AO
            opp = create_opportunity(db, OpportunityCreate(
                organization_id=org.id,
                title=(raw.get("title") or "Appel d'offres")[:200],
                status="Prospect identifie",
                source=raw.get("source", "import"),
                source_url=raw.get("source_url"),
            ))

            # 3. Créer l'AO
            from datetime import datetime
            deadline = raw.get("submission_deadline")
            pub_date = raw.get("publication_date")

            tender = create_tender(db, TenderCreate(
                opportunity_id=opp.id,
                title=(raw.get("title") or "AO importé")[:255],
                buyer_name=buyer,
                reference=raw.get("source_id", ""),
                source=raw.get("source", "import"),
                source_url=raw.get("source_url", ""),
                summary=raw.get("summary", ""),
                status="draft",
                publication_date=deadline if isinstance(deadline, datetime) else None,
                submission_deadline=deadline if isinstance(deadline, datetime) else None,
                created_by_email=current_user.email,
            ))

            crm_result = {}
            if payload.auto_extract_crm:
                crm_result = auto_extract_crm_from_tender(
                    db, tender, current_user.email
                )

            imported.append({
                "tender_id": tender.id,
                "title": tender.title,
                "buyer": buyer,
                "source": raw.get("source"),
                "crm": crm_result.get("message", ""),
            })

        except Exception as e:
            errors.append({"raw": raw.get("title", "?")[:60], "error": str(e)[:100]})

    return {
        "imported": len(imported),
        "errors": len(errors),
        "items": imported,
        "error_details": errors[:5],
    }


@router.post("/crm-extract/{tender_id}")
def extract_crm_from_tender(
    tender_id: int,
    force: bool = Query(False, description="Forcer la re-création même si déjà existant"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extrait et crée les entités CRM depuis un AO existant."""
    from app.models.tender import Tender
    from app.services.crm_auto_extract import auto_extract_crm_from_tender

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(404, "AO non trouvé")

    result = auto_extract_crm_from_tender(db, tender, current_user.email, force=force)
    return result


@router.get("/crm-preview/{tender_id}")
def preview_crm_extraction(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aperçu de ce que l'extraction CRM va créer, sans rien créer."""
    from app.models.tender import Tender
    from app.services.crm_auto_extract import (
        normalize_org_name, guess_org_type, guess_sector,
        extract_contact_from_text,
    )
    from app.crud.organization import get_organization_by_name

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(404, "AO non trouvé")

    buyer = normalize_org_name(tender.buyer_name or "")
    sector = guess_sector(tender.title or "", tender.summary or "")
    org_type = guess_org_type(buyer, sector)
    existing_org = get_organization_by_name(db, buyer) if buyer else None
    contact_data = extract_contact_from_text(
        f"{tender.summary or ''} {tender.ai_notes or ''}"
    )

    return {
        "tender": {"id": tender.id, "title": tender.title, "buyer": tender.buyer_name},
        "organization": {
            "name": buyer,
            "sector": sector,
            "type": org_type,
            "country": "France",
            "already_exists": existing_org is not None,
            "existing_id": existing_org.id if existing_org else None,
        },
        "contact": contact_data,
        "opportunity": {
            "title": f"{(tender.title or '')[:100]} — AO #{tender.id}",
            "type": "Appel d'offres public",
            "priority": "Haute" if (tender.go_no_go_score or 0) >= 70 else "Moyenne",
            "probability": max(10, min(80, tender.go_no_go_score or 50)),
        },
    }


@router.post("/crm-bulk-extract")
def bulk_extract_crm(
    payload: BulkExtractPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extraction CRM en masse sur tous les AOs sans entités CRM liées."""
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin ou manager requis")

    from app.services.crm_auto_extract import bulk_extract_crm_from_tenders
    return bulk_extract_crm_from_tenders(
        db, limit=payload.limit,
        source_filter=payload.source_filter,
        current_user_email=current_user.email,
    )
