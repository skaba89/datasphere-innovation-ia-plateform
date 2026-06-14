"""
Mémoire Technique Endpoint

POST /tenders/{id}/memoire          → générer la mémoire technique complète
GET  /tenders/{id}/memoire          → récupérer la dernière mémoire générée
POST /tenders/{id}/memoire/export   → exporter en DOCX/PDF
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.tender import Tender
from app.models.consultant_experience import ConsultantExperience
from app.services.memoire_technique import generate_memoire_technique

router = APIRouter(prefix="/tenders", tags=["memoire-technique"])


@router.post("/{tender_id}/memoire")
def generate_tender_memoire(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Génère une mémoire technique complète pour un AO via LLM.
    Utilise les vraies expériences du consultant si disponibles.
    ~30-60 secondes avec GLM/Groq.
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Appel d'offres non trouvé")

    # Récupérer les vraies expériences du consultant
    real_exps = (
        db.query(ConsultantExperience)
        .filter(
            ConsultantExperience.owner_email == current_user.email,
            ConsultantExperience.is_highlight == True,
        )
        .order_by(ConsultantExperience.display_order)
        .all()
    )

    experiences = [
        {
            "company":      exp.company,
            "client_name":  exp.client_name,
            "role":         exp.role,
            "sector":       exp.sector,
            "start_date":   exp.start_date,
            "end_date":     exp.end_date,
            "is_current":   exp.is_current,
            "description":  exp.description,
            "achievements": exp.achievements,
            "technologies": exp.technologies,
        }
        for exp in real_exps
    ] or None

    result = generate_memoire_technique(
        tender_title=tender.title or "",
        buyer_name=tender.buyer_name or "",
        summary=tender.summary or getattr(tender, 'description', None),
        estimated_budget=str(getattr(tender, 'estimated_budget', '') or ""),
        submission_deadline=str(getattr(tender, 'submission_deadline', '') or ""),
        real_experiences=experiences,
    )

    result["tender_id"] = tender_id
    result["experiences_used"] = len(real_exps)
    return result


@router.post("/{tender_id}/memoire/export-docx")
def export_memoire_docx(
    tender_id: int,
    content: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exporte la mémoire technique en DOCX."""
    from app.services.docx_export import markdown_to_docx
    from fastapi.responses import Response

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="AO non trouvé")

    docx_bytes = markdown_to_docx(content, title=f"Mémoire Technique — {tender.title or 'AO'}")
    filename = f"memoire_technique_{tender_id}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
