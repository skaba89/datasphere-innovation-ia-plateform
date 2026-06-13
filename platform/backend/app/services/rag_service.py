"""
RAG — Retrieval-Augmented Generation sur les livrables passés

L'idée : quand l'IA génère un nouveau livrable, elle consulte d'abord
les meilleurs livrables passés du même type/secteur et s'en inspire.

Architecture (sans dépendance externe lourde) :
  - Similarité TF-IDF sur le titre + contenu des livrables approuvés
  - Enrichissement du prompt LLM avec les 2-3 meilleurs exemples
  - Score de similarité basé sur les termes communs (stack tech, secteur, type)

Évolution future :
  - Remplacer TF-IDF par pgvector + embeddings OpenAI/Mistral
  - Index vectoriel sur PostgreSQL (extension pgvector déjà dispo sur Render)
"""

from __future__ import annotations
import logging
import math
import re
from collections import Counter
from datetime import datetime

log = logging.getLogger("datasphere.rag")


# ── TF-IDF Similarity ─────────────────────────────────────────────────────────

_STOP_WORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "est",
    "en", "au", "aux", "par", "pour", "sur", "dans", "avec", "ce", "qui",
    "que", "il", "elle", "nous", "vous", "ils", "elles", "je", "tu",
    "the", "a", "an", "of", "in", "on", "at", "to", "for", "is", "are",
}

def _tokenize(text: str) -> list[str]:
    """Simple tokenizer: lowercase + remove stop words + short tokens."""
    tokens = re.findall(r'\b[a-zA-ZÀ-ÿ]{3,}\b', text.lower())
    return [t for t in tokens if t not in _STOP_WORDS]


def _tf_idf_similarity(text_a: str, text_b: str, corpus: list[str]) -> float:
    """Compute TF-IDF cosine similarity between two texts given a corpus."""
    if not text_a or not text_b:
        return 0.0

    tokens_a = _tokenize(text_a)
    tokens_b = _tokenize(text_b)

    if not tokens_a or not tokens_b:
        return 0.0

    # Vocabulary union
    vocab = set(tokens_a) | set(tokens_b)

    # TF for each doc
    tf_a = Counter(tokens_a)
    tf_b = Counter(tokens_b)

    # IDF from corpus
    N = len(corpus) + 2  # +2 for a and b
    all_tokens = [_tokenize(doc) for doc in corpus]
    idf: dict[str, float] = {}
    for term in vocab:
        df = sum(1 for doc_tokens in all_tokens if term in doc_tokens) + \
             (1 if term in tf_a else 0) + (1 if term in tf_b else 0)
        idf[term] = math.log((N + 1) / (df + 1)) + 1

    # TF-IDF vectors
    vec_a = {t: (tf_a.get(t, 0) / len(tokens_a)) * idf.get(t, 1) for t in vocab}
    vec_b = {t: (tf_b.get(t, 0) / len(tokens_b)) * idf.get(t, 1) for t in vocab}

    # Cosine similarity
    dot = sum(vec_a[t] * vec_b[t] for t in vocab)
    norm_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    norm_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))

    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Main RAG functions ────────────────────────────────────────────────────────

def find_similar_deliverables(
    db,
    query_title: str,
    query_content: str,
    deliverable_type: str | None = None,
    limit: int = 3,
    min_score: float = 0.15,
) -> list[dict]:
    """
    Find the most similar approved deliverables to use as RAG context.

    Returns list of dicts with: id, title, score, excerpt, type
    """
    from app.models.deliverable import Deliverable

    # Fetch approved deliverables (the best ones)
    query = db.query(Deliverable).filter(
        Deliverable.status == "approved",
        Deliverable.content_markdown != None,
        Deliverable.content_markdown != "",
    )

    if deliverable_type:
        query = query.filter(Deliverable.deliverable_type == deliverable_type)

    candidates = query.limit(100).all()  # cap at 100 for performance

    if not candidates:
        return []

    # Build corpus for IDF computation
    corpus = [f"{d.title} {d.content_markdown or ''}" for d in candidates]
    query_text = f"{query_title} {query_content}"

    # Score each candidate
    scored = []
    for d in candidates:
        text = f"{d.title} {d.content_markdown or ''}"
        score = _tf_idf_similarity(query_text, text, corpus)
        if score >= min_score:
            scored.append((d, score))

    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)

    results = []
    for deliverable, score in scored[:limit]:
        # Extract a relevant excerpt (first 600 chars of content)
        content = deliverable.content_markdown or ""
        excerpt = content[:600].strip()
        if len(content) > 600:
            excerpt += "…"

        results.append({
            "id":     deliverable.id,
            "title":  deliverable.title,
            "type":   deliverable.deliverable_type,
            "score":  round(score, 3),
            "excerpt": excerpt,
            "approved_at": deliverable.updated_at.isoformat() if deliverable.updated_at else None,
        })

    return results


def build_rag_context(similar: list[dict]) -> str:
    """
    Build the RAG context block to inject into LLM prompts.
    Returns a formatted string with the best past deliverables.
    """
    if not similar:
        return ""

    lines = [
        "\n\n---",
        "## Référence : Livrables similaires approuvés (à utiliser comme inspiration)",
        "Ces livrables ont été validés par des clients. Adapte le style, la structure et le niveau de détail.",
        "",
    ]

    for i, doc in enumerate(similar, 1):
        lines.append(f"### Exemple {i} — {doc['title']} (score similarité: {doc['score']})")
        lines.append(f"Type: {doc['type']}")
        lines.append("")
        lines.append(doc["excerpt"])
        lines.append("")

    lines.append("---")
    return "\n".join(lines)


def enhance_prompt_with_rag(
    db,
    base_prompt: str,
    title: str,
    content_hint: str = "",
    deliverable_type: str | None = None,
) -> tuple[str, list[dict]]:
    """
    Enhance a deliverable generation prompt with RAG context.
    Returns (enhanced_prompt, similar_deliverables_used)
    """
    try:
        similar = find_similar_deliverables(
            db,
            query_title=title,
            query_content=content_hint,
            deliverable_type=deliverable_type,
            limit=3,
        )
        if similar:
            rag_block = build_rag_context(similar)
            enhanced = base_prompt + rag_block
            log.info(f"RAG: {len(similar)} similar deliverables found for '{title[:50]}'")
            return enhanced, similar
    except Exception as e:
        log.warning(f"RAG failed, proceeding without context: {e}")

    return base_prompt, []
