"""
PDF AO Analysis endpoint

POST /pdf-ao/analyze          — Analyser un PDF AO directement (multipart upload)
POST /pdf-ao/analyze-and-create — Analyser + créer un tender avec les données extraites
GET  /pdf-ao/supported-formats — Formats supportés et capacités
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.pdf_extractor import extract_pdf, result_to_dict

log = logging.getLogger("datasphere.pdf_ao")

router = APIRouter(
    prefix="/pdf-ao",
    tags=["pdf-ao"],
    dependencies=[Depends(get_current_user)],
)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux ({len(content)//1024//1024} MB). Limite : 25 MB."
        )
    if not file.content_type or "pdf" not in file.content_type.lower():
        ext = (file.filename or "").lower().rsplit(".", 1)[-1]
        if ext != "pdf":
            raise HTTPException(
                status_code=415,
                detail="Format non supporté. Seuls les fichiers PDF sont acceptés."
            )
    return content


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_pdf(
    file: UploadFile = File(..., description="Fichier PDF de l'appel d'offres"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyser un PDF AO et extraire les informations clés.

    Retourne :
    - Texte extrait, nombre de pages
    - Sections détectées (objet, budget, délai, critères…)
    - Exigences techniques sous forme de liste
    - Mots-clés techniques identifiés
    - Score de confiance de l'extraction
    """
    content = await _read_upload(file)
    result = extract_pdf(content, filename=file.filename or "ao.pdf")
    response = result_to_dict(result)
    response["filename"] = file.filename
    response["file_size_kb"] = round(len(content) / 1024, 1)

    if not result.success and not result.total_chars:
        raise HTTPException(
            status_code=422,
            detail=response.get("error", "Extraction échouée")
        )

    return response


@router.post("/analyze-and-create")
async def analyze_and_create_tender(
    file: UploadFile = File(...),
    opportunity_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyser un PDF AO et créer automatiquement un Tender avec les données extraites.

    - Extrait titre, acheteur, résumé du PDF
    - Crée le tender en base (status=draft)
    - Ajoute les exigences détectées comme TenderRequirements
    - Retourne le tender créé + le rapport d'extraction
    """
    from app.crud.opportunity import get_opportunity
    from app.crud.tender import create_tender, create_tender_requirement
    from app.schemas.tender import TenderCreate, TenderRequirementCreate
    import time

    # Validate opportunity
    opp = get_opportunity(db, opportunity_id)
    if not opp:
        raise HTTPException(status_code=404, detail=f"Opportunité #{opportunity_id} introuvable")

    # Extract PDF
    content = await _read_upload(file)
    result = extract_pdf(content, filename=file.filename or "ao.pdf")

    if not result.success:
        raise HTTPException(
            status_code=422,
            detail=result.error or "Impossible d'extraire le texte du PDF"
        )

    # Build tender from extraction
    title = (
        result.objet[:200]
        if result.objet and len(result.objet) > 10
        else f"AO extrait — {(file.filename or 'ao.pdf').replace('.pdf', '')}"
    )

    reference = f"PDF-{int(time.time())}"
    buyer = result.organisme[:200] if result.organisme else "À identifier"

    # Summary: combine key fields
    summary_parts = []
    if result.objet:        summary_parts.append(f"Objet : {result.objet[:300]}")
    if result.budget_text:  summary_parts.append(f"Budget : {result.budget_text}")
    if result.delai_text:   summary_parts.append(f"Délai : {result.delai_text}")
    if result.procedure:    summary_parts.append(f"Procédure : {result.procedure}")
    summary = " | ".join(summary_parts)[:1000] if summary_parts else ""

    tender_data = TenderCreate(
        opportunity_id=opportunity_id,
        title=title,
        reference=reference,
        buyer_name=buyer,
        status="draft",
        summary=summary or None,
        source_url=None,
    )

    tender = create_tender(db, tender_data)

    # Create requirements from extraction
    created_reqs = 0
    for req_text in result.requirements[:20]:  # max 20 auto-requirements
        if len(req_text.strip()) < 15:
            continue
        try:
            req_payload = TenderRequirementCreate(
                tender_id=tender.id,
                description=req_text[:500],
                requirement_type="technique",
            )
            create_tender_requirement(db, req_payload)
            created_reqs += 1
        except Exception:
            pass

    log.info(
        "PDF AO created tender #%d from %s: %d pages, %d requirements",
        tender.id, file.filename, result.total_pages, created_reqs,
    )

    return {
        "tender": {
            "id":           tender.id,
            "title":        tender.title,
            "reference":    tender.reference,
            "buyer_name":   tender.buyer_name,
            "status":       tender.status,
            "opportunity_id": tender.opportunity_id,
        },
        "requirements_created": created_reqs,
        "extraction": {
            "pages":            result.total_pages,
            "chars":            result.total_chars,
            "confidence":       round(result.confidence, 2),
            "sections_found":   list(result.sections.keys()),
            "technical_keywords": result.technical_keywords,
            "lots":             result.detected_lots,
        },
    }


@router.get("/supported-formats")
def supported_formats():
    """Return supported file formats and extraction capabilities."""
    return {
        "supported": ["pdf"],
        "max_size_mb": 25,
        "capabilities": {
            "text_pdf":   {"supported": True,  "confidence": "high",   "note": "PDF avec couche texte — extraction directe"},
            "scanned_pdf":{"supported": False, "confidence": "none",   "note": "OCR non disponible. Exporter le PDF en version texte."},
            "password_protected": {"supported": False, "confidence": "none", "note": "PDF protégé non supporté"},
        },
        "extracted_fields": [
            "objet", "organisme", "budget", "délai", "deadline",
            "procédure", "exigences", "mots-clés techniques", "lots",
        ],
        "library": "PyMuPDF",
    }
