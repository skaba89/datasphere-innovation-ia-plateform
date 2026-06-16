"""
RAG — Retrieval-Augmented Generation sur les livrables passés
Version 2.1 : embeddings gratuits (Gemini + GLM) + pgvector + TF-IDF fallback

Priorité des providers d'embeddings :
  1. Gemini text-embedding-004 (768 dims)  — GRATUIT, clé déjà en config
  2. GLM embedding-2 (1024 dims)           — GRATUIT, bigmodel.cn
  3. OpenAI text-embedding-3-small (1536)  — payant, meilleure qualité
  4. Mistral mistral-embed (1024 dims)     — payant, souveraineté EU
  5. TF-IDF in-memory                      — zéro config, fallback universel

Activation automatique :
  - GEMINI_API_KEY   → Gemini embeddings (recommandé, déjà configuré)
  - GLM_API_KEY      → GLM embeddings (si pas Gemini)
  - OPENAI_API_KEY   → OpenAI embeddings
  - MISTRAL_API_KEY  → Mistral embeddings
  - Aucune clé       → TF-IDF (comportement v1)

Note : la dimension du vecteur varie selon le provider.
  La colonne embedding_vector est TEXT (JSON) pour compatibilité multi-provider.
  La recherche vectorielle native pgvector nécessite une dimension fixe (768 pour Gemini).
"""

from __future__ import annotations
import logging
import math
import re
import json
import os
from collections import Counter

log = logging.getLogger("datasphere.rag")


# ── Embedding providers ────────────────────────────────────────────────────────

def _embed_gemini(text: str, api_key: str) -> list[float] | None:
    """
    Gemini text-embedding-004 — 768 dimensions, GRATUIT.
    Docs: https://ai.google.dev/api/embeddings
    """
    import urllib.request, json as _json, urllib.parse
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
        data = _json.dumps({
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text[:8000]}]},
        }).encode()
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = _json.load(resp)
        return result["embedding"]["values"]
    except Exception as e:
        log.warning("Gemini embedding error: %s", e)
        return None


def _embed_glm(text: str, api_key: str) -> list[float] | None:
    """
    ZhipuAI GLM embedding-2 — 1024 dimensions, GRATUIT.
    Docs: https://open.bigmodel.cn/dev/api/vector/embedding-2
    """
    import urllib.request, json as _json
    try:
        data = _json.dumps({
            "model": "embedding-2",
            "input": text[:8000],
        }).encode()
        req = urllib.request.Request(
            "https://open.bigmodel.cn/api/paas/v4/embeddings",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = _json.load(resp)
        return result["data"][0]["embedding"]
    except Exception as e:
        log.warning("GLM embedding error: %s", e)
        return None


def _embed_openai(text: str, api_key: str) -> list[float] | None:
    """OpenAI text-embedding-3-small — 1536 dims, payant."""
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
    """Mistral mistral-embed — 1024 dims, payant, EU souverain."""
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


# Ordre de priorité : gratuits en premier
_EMBEDDING_PROVIDERS = [
    ("gemini", "gemini_api_key",  "text-embedding-004",       _embed_gemini),
    ("glm",    "glm_api_key",     "embedding-2",              _embed_glm),
    ("openai", "openai_api_key",  "text-embedding-3-small",   _embed_openai),
    ("mistral","mistral_api_key", "mistral-embed",            _embed_mistral),
]


def get_embedding(text: str) -> tuple[list[float] | None, str, str]:
    """
    Retourne (vecteur, provider, modèle) selon les clés disponibles.
    Priorité : Gemini (gratuit) > GLM (gratuit) > OpenAI > Mistral > None
    """
    try:
        from app.core.config import get_settings
        settings = get_settings()
    except Exception:
        settings = None

    for provider_name, config_key, model_name, embed_fn in _EMBEDDING_PROVIDERS:
        # Chercher la clé dans settings puis dans les env vars
        api_key = ""
        if settings and hasattr(settings, config_key):
            api_key = getattr(settings, config_key, "") or ""
        if not api_key:
            env_map = {
                "gemini_api_key":  "GEMINI_API_KEY",
                "glm_api_key":     "GLM_API_KEY",
                "openai_api_key":  "OPENAI_API_KEY",
                "mistral_api_key": "MISTRAL_API_KEY",
            }
            api_key = os.getenv(env_map.get(config_key, ""), "")

        if not api_key:
            continue

        vec = embed_fn(text, api_key)
        if vec:
            log.info("Embedding via %s (%d dims)", provider_name, len(vec))
            return vec, provider_name, model_name

    log.info("No embedding provider available — TF-IDF fallback active")
    return None, "none", "tfidf-fallback"


def get_embedding_info() -> dict:
    """
    Retourne les infos sur le provider d'embeddings actif.
    Utile pour le diagnostic (/api/v1/health ou Settings page).
    """
    try:
        from app.core.config import get_settings
        settings = get_settings()
    except Exception:
        settings = None

    available = []
    for provider_name, config_key, model_name, _ in _EMBEDDING_PROVIDERS:
        api_key = ""
        if settings and hasattr(settings, config_key):
            api_key = getattr(settings, config_key, "") or ""
        if not api_key:
            env_map = {
                "gemini_api_key":  "GEMINI_API_KEY",
                "glm_api_key":     "GLM_API_KEY",
                "openai_api_key":  "OPENAI_API_KEY",
                "mistral_api_key": "MISTRAL_API_KEY",
            }
            api_key = os.getenv(env_map.get(config_key, ""), "")

        if api_key:
            available.append({"provider": provider_name, "model": model_name})

    return {
        "active_provider": available[0]["provider"] if available else "tfidf-fallback",
        "active_model":    available[0]["model"]    if available else "N/A",
        "available":       available,
        "mode":            "vector" if available else "tfidf",
        "note": (
            "Gemini (GRATUIT) recommandé. Activez via GEMINI_API_KEY dans Render."
            if not available else None
        ),
    }


# ── pgvector store ─────────────────────────────────────────────────────────────

def _table_exists(db) -> bool:
    """Vérifie si deliverable_embeddings existe en DB."""
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1 FROM deliverable_embeddings LIMIT 1"))
        return True
    except Exception:
        return False


def store_embedding(db, deliverable_id: int, text_content: str, chunk_index: int = 0) -> bool:
    """
    Génère et stocke l'embedding d'un livrable.
    Retourne True si embedding vectoriel stocké, False si TF-IDF fallback.
    """
    if not _table_exists(db):
        log.info("deliverable_embeddings not available, skipping")
        return False

    vec, provider, model = get_embedding(text_content)

    try:
        from sqlalchemy import text as sql_text

        # Supprimer l'ancienne version
        db.execute(sql_text(
            "DELETE FROM deliverable_embeddings WHERE deliverable_id = :did AND chunk_index = :ci"
        ), {"did": deliverable_id, "ci": chunk_index})

        # Stocker — embedding JSON toujours, vector natif si pgvector dispo
        emb_json = json.dumps(vec) if vec else None
        db.execute(sql_text("""
            INSERT INTO deliverable_embeddings
                (deliverable_id, chunk_index, chunk_text, provider, model, embedding)
            VALUES (:did, :ci, :txt, :prov, :mod, :emb)
        """), {
            "did": deliverable_id, "ci": chunk_index,
            "txt": text_content[:4000],
            "prov": provider, "mod": model,
            "emb": emb_json,
        })

        # Tentative de mise à jour de la colonne vector native
        if vec:
            try:
                vec_str = f"[{','.join(str(round(x, 6)) for x in vec)}]"
                db.execute(sql_text("""
                    UPDATE deliverable_embeddings
                    SET embedding_vector = :vec::vector
                    WHERE deliverable_id = :did AND chunk_index = :ci
                """), {"vec": vec_str, "did": deliverable_id, "ci": chunk_index})
            except Exception:
                pass  # Colonne vector absente — JSON fallback actif

        db.commit()
        return bool(vec)

    except Exception as e:
        log.warning("store_embedding error: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return False


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Similarité cosinus pure Python — fallback si pgvector indisponible."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def vector_search(db, query: str, limit: int = 5) -> list[dict]:
    """
    Recherche vectorielle.
    Essaie pgvector natif (HNSW), puis calcul Python si échec.
    """
    vec, _, _ = get_embedding(query)
    if not vec:
        return []

    if not _table_exists(db):
        return []

    try:
        from sqlalchemy import text as sql_text
        vec_str = f"[{','.join(str(round(x, 6)) for x in vec)}]"

        # Tentative pgvector natif
        try:
            rows = db.execute(sql_text("""
                SELECT deliverable_id, chunk_text,
                       1 - (embedding_vector <=> :vec::vector) AS similarity
                FROM deliverable_embeddings
                WHERE embedding_vector IS NOT NULL
                ORDER BY embedding_vector <=> :vec::vector
                LIMIT :lim
            """), {"vec": vec_str, "lim": limit}).fetchall()

            if rows:
                return [{"deliverable_id": r[0], "chunk_text": r[1], "similarity": float(r[2])} for r in rows]
        except Exception:
            pass  # pgvector pas dispo — calcul Python

        # Fallback Python: charger tous les embeddings JSON et calculer
        rows = db.execute(sql_text("""
            SELECT deliverable_id, chunk_text, embedding
            FROM deliverable_embeddings
            WHERE embedding IS NOT NULL
            LIMIT 200
        """)).fetchall()

        scored = []
        for r in rows:
            try:
                stored_vec = json.loads(r[2])
                sim = _cosine_similarity(vec, stored_vec)
                scored.append({"deliverable_id": r[0], "chunk_text": r[1], "similarity": sim})
            except Exception:
                continue

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:limit]

    except Exception as e:
        log.debug("vector_search failed: %s", e)
        return []


# ── TF-IDF fallback ───────────────────────────────────────────────────────────

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


def _tfidf_score(query_tokens: list[str], doc_tokens: list[str],
                 corpus_df: Counter, n_docs: int) -> float:
    doc_tf = Counter(doc_tokens)
    score = 0.0
    for token in set(query_tokens):
        if token in doc_tf:
            tf = doc_tf[token] / max(len(doc_tokens), 1)
            idf = math.log((n_docs + 1) / (corpus_df.get(token, 0) + 1))
            score += tf * idf
    return score


def find_similar_deliverables_tfidf(db, query_title: str, query_content: str = "",
                                     deliverable_type: str | None = None,
                                     limit: int = 3) -> list[dict]:
    try:
        from app.models.deliverable import Deliverable
        q = db.query(Deliverable).filter(Deliverable.status == "approved")
        if deliverable_type:
            q = q.filter(Deliverable.deliverable_type == deliverable_type)
        candidates = q.order_by(Deliverable.created_at.desc()).limit(100).all()
    except Exception as e:
        log.warning("TF-IDF DB error: %s", e)
        return []

    if not candidates:
        return []

    query_tokens = _tokenize(f"{query_title} {query_content}")
    if not query_tokens:
        return []

    corpus_df: Counter = Counter()
    doc_token_lists = []
    for c in candidates:
        tokens = _tokenize(f"{c.title or ''} {c.content or ''}")
        doc_token_lists.append(tokens)
        corpus_df.update(set(tokens))

    n_docs = len(candidates)
    scored = [
        (_tfidf_score(query_tokens, doc_tokens, corpus_df, n_docs), cand)
        for cand, doc_tokens in zip(candidates, doc_token_lists)
    ]
    scored = [(s, c) for s, c in scored if s > 0]
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "id": c.id, "title": c.title, "type": c.deliverable_type,
            "score": round(s, 4), "content_preview": (c.content or "")[:400],
            "source": "tfidf",
        }
        for s, c in scored[:limit]
    ]


# ── Interface publique ────────────────────────────────────────────────────────

def find_similar_deliverables(db, query_title: str, query_content: str = "",
                               deliverable_type: str | None = None,
                               limit: int = 3) -> list[dict]:
    """
    Point d'entrée principal du RAG.
    1. Recherche vectorielle (Gemini/GLM/OpenAI/Mistral embeddings + pgvector)
    2. Fallback calcul cosinus Python (si pgvector absent)
    3. Fallback TF-IDF (si aucune clé API d'embeddings)
    """
    vector_results = vector_search(db, f"{query_title} {query_content}", limit=limit)
    if vector_results:
        log.info("RAG: %d résultats vectoriels", len(vector_results))
        try:
            from app.models.deliverable import Deliverable
            ids = [r["deliverable_id"] for r in vector_results]
            delivs = {d.id: d for d in db.query(Deliverable).filter(Deliverable.id.in_(ids)).all()}
            return [
                {
                    "id": r["deliverable_id"],
                    "title": getattr(delivs.get(r["deliverable_id"]), "title", "?"),
                    "type": deliverable_type or "—",
                    "score": round(r["similarity"], 4),
                    "content_preview": r["chunk_text"][:400],
                    "source": "vector",
                }
                for r in vector_results
            ]
        except Exception:
            pass

    log.info("RAG: fallback TF-IDF")
    return find_similar_deliverables_tfidf(db, query_title, query_content, deliverable_type, limit)


def build_rag_context(similar: list[dict]) -> str:
    """Formate les exemples similaires pour injection dans un prompt LLM."""
    if not similar:
        return ""
    lines = ["\n\n### Exemples de livrables similaires approuvés (RAG)\n"]
    for i, s in enumerate(similar, 1):
        src = s.get("source", "tfidf")
        score_label = f"similarité {s['score']:.0%}" if src == "vector" else f"score {s['score']:.3f}"
        lines.append(f"**Exemple {i}** — {s['title']} ({s.get('type','')}) — {score_label} [{src}]")
        lines.append(f"```\n{s['content_preview']}\n```\n")
    return "\n".join(lines)


def index_deliverable(db, deliverable_id: int) -> bool:
    """
    Indexe un livrable après approbation.
    Retourne True si vectorisé (Gemini/GLM/etc.), False si TF-IDF fallback.
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


# ══════════════════════════════════════════════════════════════════════════════
# RAG v2.2 — Extension AOs (CCTP) et recherche unifiée
# ══════════════════════════════════════════════════════════════════════════════

def index_tender(db, tender_id: int) -> bool:
    """
    Indexe le contenu d'un AO (titre + résumé + contexte) dans deliverable_embeddings.
    Utilise resource_type='tender' pour distinguer des livrables.
    """
    try:
        from app.models.tender import Tender
        t = db.query(Tender).filter(Tender.id == tender_id).first()
        if not t:
            return False
        text = " ".join(filter(None, [
            t.title or "",
            t.summary or "",
            getattr(t, "description", "") or "",
            getattr(t, "buyer_name", "") or "",
            getattr(t, "sector", "") or "",
        ]))
        if not text.strip():
            return False
        return _store_embedding_typed(db, tender_id, "tender", text[:6000])
    except Exception as e:
        log.warning("index_tender error: %s", e)
        return False


def _store_embedding_typed(db, resource_id: int, resource_type: str, text: str) -> bool:
    """Stocke l'embedding avec un resource_type ('deliverable' ou 'tender')."""
    vec, provider, model = get_embedding(text)
    if vec is None:
        log.info("No embedding for %s #%d — TF-IDF only", resource_type, resource_id)
        return False
    try:
        from sqlalchemy import text as sql_text
        vec_json = json.dumps(vec)
        existing = db.execute(sql_text(
            "SELECT id FROM deliverable_embeddings WHERE deliverable_id=:did LIMIT 1"
        ), {"did": resource_id}).fetchone()
        if existing:
            db.execute(sql_text(
                "UPDATE deliverable_embeddings SET embedding=:emb, model=:m WHERE deliverable_id=:did"
            ), {"emb": vec_json, "m": model, "did": resource_id})
        else:
            db.execute(sql_text("""
                INSERT INTO deliverable_embeddings (deliverable_id, chunk_index, chunk_text, model, embedding)
                VALUES (:did, 0, :txt, :model, :emb)
            """), {"did": resource_id, "txt": text[:500], "model": model, "emb": vec_json})
        db.commit()
        log.info("Indexed %s #%d via %s (%d dims)", resource_type, resource_id, provider, len(vec))
        return True
    except Exception as e:
        log.warning("_store_embedding_typed error: %s", e)
        db.rollback()
        return False


def search_tenders_by_semantic(db, query: str, limit: int = 5) -> list[dict]:
    """
    Recherche sémantique sur les AOs indexés.
    Retourne les AOs les plus similaires à la requête.
    """
    try:
        from app.models.tender import Tender
        from sqlalchemy import text as sql_text

        # Essayer vectoriel d'abord
        vec_results = vector_search(db, query, limit=limit * 2)
        if vec_results:
            ids = [r["deliverable_id"] for r in vec_results]
            # Filtrer ceux qui sont des tenders
            tenders = {t.id: t for t in db.query(Tender).filter(Tender.id.in_(ids)).all()}
            results = []
            for r in vec_results:
                t = tenders.get(r["deliverable_id"])
                if t:
                    results.append({
                        "id": t.id, "title": t.title, "buyer": getattr(t, "buyer_name", ""),
                        "score": round(r["similarity"], 4), "source": "vector",
                        "status": getattr(t, "status", ""),
                        "go_score": getattr(t, "go_no_go_score", 0) or 0,
                    })
            if results:
                return results[:limit]
    except Exception as e:
        log.warning("vector tender search error: %s", e)

    # Fallback TF-IDF sur tenders
    return _search_tenders_tfidf(db, query, limit)


def _search_tenders_tfidf(db, query: str, limit: int = 5) -> list[dict]:
    """Recherche TF-IDF sur les AOs."""
    try:
        from app.models.tender import Tender
        candidates = db.query(Tender).order_by(Tender.created_at.desc()).limit(100).all()
    except Exception as e:
        log.warning("TF-IDF tender DB error: %s", e)
        return []

    if not candidates:
        return []

    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    corpus_df: Counter = Counter()
    doc_tokens_list = []
    for t in candidates:
        tokens = _tokenize(f"{t.title or ''} {getattr(t,'summary','') or ''}")
        doc_tokens_list.append(tokens)
        corpus_df.update(set(tokens))

    n = len(candidates)
    scored = [
        (_tfidf_score(query_tokens, tok, corpus_df, n), t)
        for t, tok in zip(candidates, doc_tokens_list)
    ]
    scored = [(s, t) for s, t in scored if s > 0]
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "id": t.id, "title": t.title,
            "buyer": getattr(t, "buyer_name", "") or "",
            "score": round(s, 4), "source": "tfidf",
            "status": getattr(t, "status", ""),
            "go_score": getattr(t, "go_no_go_score", 0) or 0,
        }
        for s, t in scored[:limit]
    ]


def unified_search(db, query: str, limit: int = 5,
                   include_deliverables: bool = True,
                   include_tenders: bool = True) -> dict:
    """
    Point d'entrée RAG unifié — cherche dans livrables ET AOs.
    Retourne {'deliverables': [...], 'tenders': [...], 'rag_context': str}
    """
    results: dict = {"deliverables": [], "tenders": [], "rag_context": ""}

    if include_deliverables:
        results["deliverables"] = find_similar_deliverables(db, query, limit=limit)

    if include_tenders:
        results["tenders"] = search_tenders_by_semantic(db, query, limit=limit)

    # Construire contexte RAG unifié
    ctx_parts = []
    if results["deliverables"]:
        ctx_parts.append(build_rag_context(results["deliverables"]))
    if results["tenders"]:
        lines = ["\n\n### AOs similaires détectés (RAG)\n"]
        for t in results["tenders"]:
            lines.append(
                f"- **{t['title']}** (acheteur: {t.get('buyer','—')}) "
                f"— score Go/No-Go: {t.get('go_score', 0)}/100 [{t['source']}]"
            )
        ctx_parts.append("\n".join(lines))

    results["rag_context"] = "\n".join(ctx_parts)
    return results


def bulk_index_tenders(db, limit: int = 200) -> dict:
    """
    Indexe en masse tous les AOs non encore vectorisés.
    À appeler une fois au démarrage ou via un endpoint admin.
    """
    try:
        from app.models.tender import Tender
        from sqlalchemy import text as sql_text
        already = set(
            r[0] for r in db.execute(sql_text(
                "SELECT deliverable_id FROM deliverable_embeddings"
            )).fetchall()
        )
        tenders = db.query(Tender).limit(limit).all()
        indexed = 0
        for t in tenders:
            if t.id not in already:
                if index_tender(db, t.id):
                    indexed += 1
        log.info("bulk_index_tenders: %d/%d indexed", indexed, len(tenders))
        return {"indexed": indexed, "total": len(tenders), "skipped": len(tenders) - indexed}
    except Exception as e:
        log.warning("bulk_index_tenders error: %s", e)
        return {"indexed": 0, "error": str(e)}

# ══════════════════════════════════════════════════════════════════════════════
# enhance_prompt_with_rag — enrichissement du prompt avec contexte RAG
# ══════════════════════════════════════════════════════════════════════════════

def enhance_prompt_with_rag(
    db,
    base_prompt: str,
    title: str = "",
    content_hint: str = "",
    deliverable_type: str = "technical_proposal",
    max_similar: int = 3,
) -> tuple[str, list[dict]]:
    """
    Enrichit un prompt LLM avec le contexte des livrables similaires approuvés
    et des AOs similaires trouvés via RAG (vectoriel ou TF-IDF).

    Retourne : (enhanced_prompt: str, rag_sources: list[dict])

    Le prompt enrichi inclut une section "Exemples de livrables similaires approuvés"
    qui guide le LLM pour produire un contenu de meilleure qualité.
    """
    rag_sources: list[dict] = []
    rag_context = ""

    try:
        # 1. Chercher des livrables similaires approuvés
        query = f"{title} {content_hint}".strip() or "mémoire technique data engineering"
        similar = find_similar_deliverables(
            db,
            query_title=title or "mémoire technique",
            query_content=content_hint,
            deliverable_type=deliverable_type,
            limit=max_similar,
        )

        if similar:
            rag_sources.extend(similar)
            rag_context += build_rag_context(similar)
            log.info(
                "enhance_prompt_with_rag: %d livrables similaires trouvés (source: %s)",
                len(similar),
                similar[0].get("source", "?"),
            )

        # 2. Chercher des AOs similaires
        tender_results = search_tenders_by_semantic(db, query=query, limit=2)
        if tender_results:
            rag_sources.extend(tender_results)
            ao_ctx = "\n\n### AOs similaires référencés\n"
            for t in tender_results:
                ao_ctx += f"- **{t.get('title', '?')}** (acheteur: {t.get('buyer', '—')}, score: {t.get('go_score', 0)}/100)\n"
            rag_context += ao_ctx

    except Exception as e:
        log.warning("enhance_prompt_with_rag: RAG lookup failed — %s", e)
        # Continuer sans contexte RAG — le prompt de base reste intact

    if not rag_context.strip():
        # Aucun contexte disponible — retourner le prompt de base tel quel
        return base_prompt, []

    enhanced_prompt = f"""{base_prompt}

---

{rag_context}

---

**Important** : Utilise les exemples ci-dessus comme référence de qualité et de style, 
mais produis un contenu 100% original adapté à cet AO spécifique. 
Ne copie pas le contenu des exemples — inspire-toi de leur structure et niveau de détail.
"""

    return enhanced_prompt, rag_sources
