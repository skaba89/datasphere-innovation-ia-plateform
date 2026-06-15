"""
Mémoire Technique Endpoint — DataSphere Innovation

POST /tenders/{id}/memoire            → générer la mémoire technique complète (LLM)
GET  /tenders/{id}/memoire            → récupérer la dernière mémoire générée (cache DB)
POST /tenders/{id}/memoire/export-docx → exporter en DOCX
POST /tenders/{id}/memoire/export-pdf  → exporter en PDF
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.tender import Tender
from app.models.consultant_experience import ConsultantExperience
from app.services.memoire_technique import generate_memoire_technique

router = APIRouter(prefix="/tenders", tags=["memoire-technique"])

# Cache simple en mémoire (par tender_id)
_MEMOIRE_CACHE: dict[int, dict] = {}


class MemoireExportRequest(BaseModel):
    content: str
    tender_title: str = ""


@router.post("/{tender_id}/memoire")
def generate_tender_memoire(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Génère une mémoire technique complète pour un AO via LLM.
    Utilise les vraies expériences du consultant si disponibles.
    Durée : ~30-90s selon provider (GLM gratuit / Groq rapide).
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Appel d'offres non trouvé")

    # Expériences consultant (highlights en priorité)
    real_exps = (
        db.query(ConsultantExperience)
        .filter(
            ConsultantExperience.owner_email == current_user.email,
        )
        .order_by(
            ConsultantExperience.is_highlight.desc(),
            ConsultantExperience.display_order,
        )
        .limit(6)
        .all()
    )

    experiences = [
        {
            "company":      exp.company,
            "client_name":  exp.client_name,
            "role":         exp.role,
            "sector":       exp.sector,
            "start_date":   str(exp.start_date or ""),
            "end_date":     str(exp.end_date or ""),
            "is_current":   exp.is_current,
            "description":  exp.description or "",
            "achievements": exp.achievements or "",
            "technologies": exp.technologies or "",
        }
        for exp in real_exps
    ] or None

    result = generate_memoire_technique(
        tender_title=tender.title or "",
        buyer_name=tender.buyer_name or "",
        summary=tender.summary or getattr(tender, "description", None),
        estimated_budget=str(getattr(tender, "estimated_budget", "") or ""),
        submission_deadline=str(getattr(tender, "submission_deadline", "") or ""),
        real_experiences=experiences,
    )

    result["tender_id"] = tender_id
    result["experiences_used"] = len(real_exps)

    # Mise en cache
    _MEMOIRE_CACHE[tender_id] = result

    # Persist dans le champ memoire_content du tender si disponible
    try:
        if hasattr(tender, "memoire_content"):
            tender.memoire_content = result["content"]
            db.commit()
    except Exception:
        pass

    return result


@router.get("/{tender_id}/memoire")
def get_tender_memoire(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Récupère la dernière mémoire technique générée pour cet AO.
    Priorité : cache DB → cache mémoire → 404
    """
    # 1. Cache DB
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Appel d'offres non trouvé")

    if hasattr(tender, "memoire_content") and tender.memoire_content:
        return {
            "content": tender.memoire_content,
            "tender_id": tender_id,
            "tender_title": tender.title or "",
            "buyer_name": tender.buyer_name or "",
            "source": "db",
        }

    # 2. Cache mémoire
    if tender_id in _MEMOIRE_CACHE:
        return {**_MEMOIRE_CACHE[tender_id], "source": "memory_cache"}

    raise HTTPException(
        status_code=404,
        detail="Aucune mémoire technique générée pour cet AO. Utilisez POST /tenders/{id}/memoire pour générer.",
    )


@router.post("/{tender_id}/memoire/export-docx")
def export_memoire_docx(
    tender_id: int,
    payload: MemoireExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exporte la mémoire technique en DOCX (Microsoft Word)."""
    from app.services.docx_export import markdown_to_docx
    from fastapi.responses import Response

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="AO non trouvé")

    title = payload.tender_title or tender.title or f"AO-{tender_id}"

    try:
        docx_bytes = markdown_to_docx(payload.content, title=f"Mémoire Technique — {title}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur export DOCX : {e}")

    filename = f"memoire_technique_{tender_id}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{tender_id}/memoire/export-pdf")
def export_memoire_pdf(
    tender_id: int,
    payload: MemoireExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exporte la mémoire technique en PDF via WeasyPrint."""
    from app.services.pdf_export import markdown_to_pdf
    from fastapi.responses import Response

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="AO non trouvé")

    title = payload.tender_title or tender.title or f"AO-{tender_id}"

    try:
        pdf_bytes = markdown_to_pdf(
            content=payload.content,
            title=f"Mémoire Technique — {title}",
            subtitle=tender.buyer_name or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur export PDF : {e}")

    filename = f"memoire_technique_{tender_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
