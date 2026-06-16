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
