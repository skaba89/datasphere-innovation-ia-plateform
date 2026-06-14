"""
Proposals API — Génération de propositions commerciales complètes

POST /proposals/generate/{tender_id}   → génère une proposition en 4 minutes
GET  /proposals/{tender_id}/latest     → récupère la dernière proposition
POST /proposals/{tender_id}/export/docx → exporte en Word
GET  /intelligence/dashboard           → KPIs intelligence + forecast
GET  /intelligence/recommendations     → Top 3 recommandations IA
GET  /intelligence/win-rate            → Analyse du taux de conversion
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter(tags=["proposals", "intelligence"])


# ── Proposals ──────────────────────────────────────────────────────────────────

@router.post("/proposals/generate/{tender_id}")
def generate_proposal_for_tender(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Génère une proposition commerciale complète pour un AO.
    Utilise GLM-4-Flash (gratuit) ou Groq selon disponibilité.
    Durée : 30-90 secondes.
    """
    from app.models.tender import Tender
    from app.services.proposal_service import generate_proposal

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="AO non trouvé")

    result = generate_proposal(
        tender_id=tender_id,
        tender_title=tender.title or "Mission Data",
        buyer_name=tender.buyer_name or "Client",
        description=tender.summary or tender.description,
        mission_context=getattr(tender, "requirements_text", None),
        budget_estimate=getattr(tender, "estimated_budget", None),
        submission_deadline=str(tender.submission_deadline) if getattr(tender, "submission_deadline", None) else None,
    )
    return result


@router.post("/proposals/generate/{tender_id}/export/md")
def export_proposal_markdown(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Génère la proposition ET l'exporte en Markdown."""
    from app.models.tender import Tender
    from app.services.proposal_service import generate_proposal, proposal_to_markdown

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="AO non trouvé")

    result = generate_proposal(
        tender_id=tender_id,
        tender_title=tender.title or "Mission",
        buyer_name=tender.buyer_name or "Client",
        description=tender.summary,
    )
    md = proposal_to_markdown(result)
    return {"markdown": md, "tender_id": tender_id, "word_count": len(md.split())}


# ── Intelligence Dashboard ─────────────────────────────────────────────────────

@router.get("/intelligence/dashboard")
def intelligence_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Dashboard intelligence complet : forecast, santé pipeline, KPIs."""
    from app.services.intelligence_engine import (
        forecast_revenue, pipeline_health, compute_win_rate
    )
    return {
        "forecast":      forecast_revenue(db),
        "pipeline":      pipeline_health(db),
        "win_rate":      compute_win_rate(db),
        "generated_at":  __import__("datetime").datetime.utcnow().isoformat(),
    }


@router.get("/intelligence/recommendations")
def get_strategic_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """Top 3 recommandations stratégiques générées par le LLM."""
    from app.services.intelligence_engine import strategic_recommendations
    return strategic_recommendations(db)


@router.get("/intelligence/win-rate")
def get_win_rate_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse détaillée du taux de conversion et funnel."""
    from app.services.intelligence_engine import compute_win_rate
    return compute_win_rate(db)


@router.get("/intelligence/forecast")
def get_revenue_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Prévision de revenus sur 6 mois."""
    from app.services.intelligence_engine import forecast_revenue
    return forecast_revenue(db)
