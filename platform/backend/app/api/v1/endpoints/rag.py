from pydantic import BaseModel
"""
RAG Endpoints — Recherche sémantique unifiée (livrables + AOs)

GET  /rag/search              → recherche sémantique sur requête libre
POST /rag/index-tender/{id}   → indexer un AO spécifique
POST /rag/bulk-index-tenders  → indexer tous les AOs (admin)
GET  /rag/info                → état du système RAG (provider, mode)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/rag", tags=["rag"])


@router.get("/search")
def rag_search(
    q: str = Query(..., min_length=2, description="Requête de recherche"),
    limit: int = Query(5, ge=1, le=20),
    include_deliverables: bool = True,
    include_tenders: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recherche sémantique unifiée sur les livrables approuvés et les AOs.
    Utilise pgvector si disponible, TF-IDF sinon.
    """
    from app.services.rag_service import unified_search
    return unified_search(
        db, query=q, limit=limit,
        include_deliverables=include_deliverables,
        include_tenders=include_tenders,
    )


@router.post("/index-tender/{tender_id}")
def index_tender_endpoint(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Indexe (ou ré-indexe) un AO spécifique pour la recherche sémantique."""
    from app.services.rag_service import index_tender
    success = index_tender(db, tender_id)
    return {
        "tender_id": tender_id,
        "indexed": success,
        "message": "Indexé avec embeddings" if success else "Indexé (TF-IDF fallback)",
    }


@router.post("/bulk-index-tenders")
def bulk_index_tenders_endpoint(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Indexe en masse tous les AOs existants (admin recommandé)."""
    if current_user.role not in ("admin", "manager"):
        from fastapi import HTTPException
        raise HTTPException(403, "Admin ou manager requis")
    from app.services.rag_service import bulk_index_tenders
    return bulk_index_tenders(db, limit=limit)


@router.get("/info")
def rag_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne l'état du système RAG : provider embeddings, mode, stats index."""
    from app.services.rag_service import get_embedding_info
    from sqlalchemy import text
    info = get_embedding_info()
    try:
        n_indexed = db.execute(
            text("SELECT COUNT(DISTINCT deliverable_id) FROM deliverable_embeddings")
        ).scalar() or 0
        info["indexed_documents"] = n_indexed
    except Exception:
        info["indexed_documents"] = -1
    return info

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@router.post("/chat")
def ai_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assistant IA contextuel — questions en langage naturel sur les données."""
    import os
    from datetime import datetime, timedelta

    question = payload.message.lower()
    now = datetime.utcnow()

    try:
        # AOs avec deadline proche
        if any(w in question for w in ["deadline", "semaine", "urgent", "echeance"]):
            from app.models.tender import Tender
            week_end = now + timedelta(days=7)
            tenders = db.query(Tender).filter(
                Tender.submission_deadline >= now,
                Tender.submission_deadline <= week_end,
            ).order_by(Tender.submission_deadline).limit(5).all()
            if tenders:
                lines = ["AOs avec deadline dans 7 jours:"]
                for t in tenders:
                    days = (t.submission_deadline - now).days
                    lines.append(f"- {t.title[:60]} — dans {days}j")
                return {"response": chr(10).join(lines)}
            return {"response": "Aucun AO avec deadline dans les 7 prochains jours."}

        # Win rate
        if any(w in question for w in ["win rate", "taux", "succes", "gagnes"]):
            from app.models.tender import Tender
            from sqlalchemy import func
            total = db.query(func.count(Tender.id)).scalar() or 0
            won   = db.query(func.count(Tender.id)).filter(Tender.status == "won").scalar() or 0
            rate  = round(won / total * 100, 1) if total > 0 else 0
            avg_score = db.query(func.avg(Tender.go_no_go_score)).filter(
                Tender.go_no_go_score.isnot(None)).scalar() or 0
            return {"response": f"Win rate: {rate}% ({won}/{total} AOs). Score moyen: {round(float(avg_score),1)}/100."}

        # Pipeline
        if any(w in question for w in ["pipeline", "prevision", "forecast", "chiffre"]):
            from app.models.opportunity import Opportunity
            opps = db.query(Opportunity).filter(
                Opportunity.status.notin_(["Perdu", "Annule"])).all()
            total = sum(float(o.potential_value or 0) for o in opps)
            weighted = sum(float(o.potential_value or 0) * (o.probability or 20) / 100 for o in opps)
            return {"response": f"Pipeline: {len(opps)} opportunites actives. Brut: {total:,.0f}euro. Forecast pondere: {weighted:,.0f}euro."}

        # Livrables
        if any(w in question for w in ["livrable", "approbation", "attente", "revision"]):
            from app.models.deliverable import Deliverable
            pending = db.query(Deliverable).filter(
                Deliverable.status.in_(["review", "draft"])).limit(5).all()
            if pending:
                lines = [f"{len(pending)} livrable(s) en attente:"]
                for d in pending:
                    lines.append(f"- {d.title[:60]} ({d.status})")
                return {"response": chr(10).join(lines)}
            return {"response": "Aucun livrable en attente."}

        # Activite recente
        if any(w in question for w in ["recent", "activite", "bilan", "resume", "derniers"]):
            from app.models.tender import Tender
            from app.models.deliverable import Deliverable
            from app.models.opportunity import Opportunity
            week_ago = now - timedelta(days=7)
            nt = db.query(Tender).filter(Tender.created_at >= week_ago).count()
            nd = db.query(Deliverable).filter(Deliverable.created_at >= week_ago).count()
            no = db.query(Opportunity).filter(Opportunity.created_at >= week_ago).count()
            return {"response": f"Activite 7 derniers jours: {nt} AO(s), {nd} livrable(s), {no} opportunite(s) CRM."}

    except Exception:
        pass

    # Fallback RAG
    try:
        from app.services.rag_service import unified_search
        results = unified_search(db, query=payload.message, limit=3)
        if results:
            context = " | ".join(r.get("title", "") + ": " + r.get("content", "")[:100] for r in results[:2])
            return {"response": f"D apres vos donnees: {context}"}
    except Exception:
        pass

    return {"response": "Je n ai pas trouve de donnees pour cette question. Essayez: 'pipeline', 'deadline', 'win rate', 'livrables en attente'."}
