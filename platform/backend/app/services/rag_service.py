"""
RAG — Retrieval-Augmented Generation sur les livrables passés
Version 2.0 : pgvector natif + fallback TF-IDF

Architecture :
  1. PRIMAIRE  : embeddings vectoriels (OpenAI/Mistral) stockés dans deliverable_embeddings
                 Recherche par similarité cosinus via pgvector (HNSW index)
  2. FALLBACK  : TF-IDF in-memory si pas de clé LLM d'embeddings ou pas de pgvector

Activation automatique :
  - Si OPENAI_API_KEY ou MISTRAL_API_KEY → embeddings réels
  - Sinon → TF-IDF (comportement v1)
"""

from __future__ import annotations
import logging
import math
import re
import json
from collections import Counter
from datetime import datetime
from typing import Optional

log = logging.getLogger("datasphere.rag")


# ── Embedding providers ────────────────────────────────────────────────────────

def _embed_openai(text: str, api_key: str) -> list[float] | None:
    """Appelle OpenAI text-embedding-3-small (1536 dimensions)."""
    import urllib.request, json as _json
    try:
        data = _json.dumps({
            "model": "text-embedding-3-small",
            "input": text[:8000],
        }).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/embeddings",
            data=data,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = _json.load(resp)
        return result["data"][0]["embedding"]
    except Exception as e:
        log.warning("OpenAI embedding error: %s", e)
        return None


def _embed_mistral(text: str, api_key: str) -> list[float] | None:
    """Appelle Mistral embed (1024 dimensions)."""
    import urllib.request, json as _json
    try:
        data = _json.dumps({
            "model": "mistral-embed",
            "input": [text[:8000]],
            "encoding_format": "float",
        }).encode()
        req = urllib.request.Request(
            "https://api.mistral.ai/v1/embeddings",
            data=data,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = _json.load(resp)
        return result["data"][0]["embedding"]
    except Exception as e:
        log.warning("Mistral embedding error: %s", e)
        return None


def get_embedding(text: str) -> tuple[list[float] | None, str, str]:
    """
    Retourne (vecteur, provider, modèle) selon les clés disponibles.
    Priorité : OpenAI > Mistral > None (TF-IDF fallback)
    """
    import os
    openai_key = os.getenv("OPENAI_API_KEY", "")
    mistral_key = os.getenv("MISTRAL_API_KEY", "")

    if openai_key:
        vec = _embed_openai(text, openai_key)
        if vec:
            return vec, "openai", "text-embedding-3-small"

    if mistral_key:
        vec = _embed_mistral(text, mistral_key)
        if vec:
            return vec, "mistral", "mistral-embed"

    return None, "none", "tfidf-fallback"


# ── pgvector store ─────────────────────────────────────────────────────────────

def store_embedding(db, deliverable_id: int, text: str, chunk_index: int = 0) -> bool:
    """
    Génère et stocke l'embedding d'un livrable.
    Retourne True si embedding vectoriel stocké, False si fallback TF-IDF.
    """
    vec, provider, model = get_embedding(text)
    try:
        from sqlalchemy import text as sql_text

        # Vérifier si table existe
        try:
            db.execute(sql_text("SELECT 1 FROM deliverable_embeddings LIMIT 1"))
        except Exception:
            log.info("deliverable_embeddings table not available, skipping vector storage")
            return False

        # Upsert
        db.execute(sql_text("""
            DELETE FROM deliverable_embeddings
            WHERE deliverable_id = :did AND chunk_index = :ci
        """), {"did": deliverable_id, "ci": chunk_index})

        if vec:
            db.execute(sql_text("""
                INSERT INTO deliverable_embeddings
                    (deliverable_id, chunk_index, chunk_text, provider, model, embedding, embedding_vector)
                VALUES
                    (:did, :ci, :text, :prov, :mod, :emb_json,
                     CASE WHEN :vec_str IS NOT NULL THEN :vec_str::vector ELSE NULL END)
            """), {
                "did": deliverable_id, "ci": chunk_index, "text": text[:4000],
                "prov": provider, "mod": model,
                "emb_json": json.dumps(vec),
                "vec_str": f"[{','.join(str(round(x,6)) for x in vec)}]",
            })
        else:
            db.execute(sql_text("""
                INSERT INTO deliverable_embeddings
                    (deliverable_id, chunk_index, chunk_text, provider, model, embedding)
                VALUES (:did, :ci, :text, :prov, :mod, NULL)
            """), {
                "did": deliverable_id, "ci": chunk_index, "text": text[:4000],
                "prov": provider, "mod": model,
            })

        db.commit()
        return bool(vec)
    except Exception as e:
        log.warning("store_embedding error: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return False


def vector_search(db, query: str, limit: int = 5) -> list[dict]:
    """
    Recherche vectorielle par similarité cosinus.
    Retourne les chunks les plus proches du query.
    """
    vec, _, _ = get_embedding(query)
    if not vec:
        return []

    try:
        from sqlalchemy import text as sql_text
        vec_str = f"[{','.join(str(round(x,6)) for x in vec)}]"
        rows = db.execute(sql_text("""
            SELECT
                de.deliverable_id,
                de.chunk_text,
                de.provider,
                1 - (de.embedding_vector <=> :vec::vector) AS similarity
            FROM deliverable_embeddings de
            WHERE de.embedding_vector IS NOT NULL
            ORDER BY de.embedding_vector <=> :vec::vector
            LIMIT :lim
        """), {"vec": vec_str, "lim": limit}).fetchall()

        return [
            {"deliverable_id": r[0], "chunk_text": r[1], "similarity": float(r[3])}
            for r in rows
        ]
    except Exception as e:
        log.debug("vector_search failed (pgvector not available?): %s", e)
        return []


# ── TF-IDF fallback (v1 — toujours actif si pas de pgvector) ──────────────────

_STOP_WORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "est",
    "en", "au", "aux", "sur", "par", "pour", "dans", "avec", "ce", "qui",
    "que", "à", "il", "elle", "nous", "vous", "ils", "je", "tu", "son",
    "sa", "ses", "mon", "ton", "notre", "votre", "leur", "leurs",
}


def _tokenize(text: str) -> list[str]:
    return [
        w.lower() for w in re.findall(r"\b[a-zA-ZÀ-ÿ]{3,}\b", text)
        if w.lower() not in _STOP_WORDS
    ]


def _tfidf_score(query_tokens: list[str], doc_tokens: list[str], corpus_df: Counter, n_docs: int) -> float:
    doc_tf = Counter(doc_tokens)
    score = 0.0
    for token in set(query_tokens):
        if token in doc_tf:
            tf = doc_tf[token] / max(len(doc_tokens), 1)
            idf = math.log((n_docs + 1) / (corpus_df.get(token, 0) + 1))
            score += tf * idf
    return score


def find_similar_deliverables_tfidf(
    db,
    query_title: str,
    query_content: str = "",
    deliverable_type: str | None = None,
    limit: int = 3,
) -> list[dict]:
    """TF-IDF similarity search sur les livrables approuvés."""
    try:
        from app.models.deliverable import Deliverable
        candidates = db.query(Deliverable).filter(
            Deliverable.status == "approved"
        )
        if deliverable_type:
            candidates = candidates.filter(
                Deliverable.deliverable_type == deliverable_type
            )
        candidates = candidates.order_by(Deliverable.created_at.desc()).limit(100).all()
    except Exception as e:
        log.warning("RAG DB error: %s", e)
        return []

    if not candidates:
        return []

    query_text = f"{query_title} {query_content}"
    query_tokens = _tokenize(query_text)
    if not query_tokens:
        return []

    # Corpus DF
    corpus_df: Counter = Counter()
    doc_token_lists = []
    for c in candidates:
        doc_text = f"{c.title or ''} {c.content or ''}"
        tokens = _tokenize(doc_text)
        doc_token_lists.append(tokens)
        corpus_df.update(set(tokens))

    n_docs = len(candidates)
    scored = []
    for i, (cand, doc_tokens) in enumerate(zip(candidates, doc_token_lists)):
        score = _tfidf_score(query_tokens, doc_tokens, corpus_df, n_docs)
        if score > 0:
            scored.append((score, cand))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "id":    c.id,
            "title": c.title,
            "type":  c.deliverable_type,
            "score": round(s, 4),
            "content_preview": (c.content or "")[:400],
            "source": "tfidf",
        }
        for s, c in scored[:limit]
    ]


# ── Interface publique unifiée ─────────────────────────────────────────────────

def find_similar_deliverables(
    db,
    query_title: str,
    query_content: str = "",
    deliverable_type: str | None = None,
    limit: int = 3,
) -> list[dict]:
    """
    Point d'entrée principal.
    1. Essaie la recherche vectorielle (pgvector)
    2. Fallback TF-IDF
    """
    query_text = f"{query_title} {query_content}"

    # Tentative vectorielle
    vector_results = vector_search(db, query_text, limit=limit)
    if vector_results:
        log.info("RAG: %d résultats vectoriels", len(vector_results))
        # Enrichir avec les titres
        try:
            from app.models.deliverable import Deliverable
            ids = [r["deliverable_id"] for r in vector_results]
            delivs = {d.id: d for d in db.query(Deliverable).filter(Deliverable.id.in_(ids)).all()}
            return [
                {
                    "id":    r["deliverable_id"],
                    "title": delivs.get(r["deliverable_id"], type("D", (), {"title": "?"})()).title,
                    "type":  deliverable_type or "—",
                    "score": r["similarity"],
                    "content_preview": r["chunk_text"][:400],
                    "source": "pgvector",
                }
                for r in vector_results
            ]
        except Exception:
            pass

    # Fallback TF-IDF
    log.info("RAG: fallback TF-IDF")
    return find_similar_deliverables_tfidf(db, query_title, query_content, deliverable_type, limit)


def build_rag_context(similar: list[dict]) -> str:
    """Formate les exemples similaires pour l'injection dans un prompt LLM."""
    if not similar:
        return ""
    lines = ["\n\n### Exemples de livrables similaires approuvés (RAG)\n"]
    for i, s in enumerate(similar, 1):
        src = s.get("source", "tfidf")
        score_label = f"similarité {s['score']:.0%}" if src == "pgvector" else f"score TF-IDF {s['score']:.3f}"
        lines.append(f"**Exemple {i}** — {s['title']} ({s.get('type','')}) — {score_label}")
        lines.append(f"```\n{s['content_preview']}\n```\n")
    return "\n".join(lines)


def index_deliverable(db, deliverable_id: int) -> bool:
    """
    Index un livrable dans pgvector (appelé après approbation).
    Retourne True si vectorisé, False si TF-IDF fallback.
    """
    try:
        from app.models.deliverable import Deliverable
        d = db.query(Deliverable).filter(Deliverable.id == deliverable_id).first()
        if not d:
            return False
        text = f"{d.title or ''}\n{d.content or ''}"
        return store_embedding(db, deliverable_id, text[:6000])
    except Exception as e:
        log.warning("index_deliverable error: %s", e)
        return False
