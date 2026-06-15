"""Tests unitaires — RAG Service v2.1"""
import pytest
import math
from unittest.mock import patch, MagicMock


# ── TF-IDF ────────────────────────────────────────────────────────────────────

def test_tokenize():
    from app.services.rag_service import _tokenize
    tokens = _tokenize("Architecture Snowflake dbt Core pour la data")
    assert "snowflake" in tokens
    assert "dbt" in tokens
    assert "core" in tokens
    # Stop words exclus
    assert "pour" not in tokens
    assert "la" not in tokens


def test_tokenize_empty():
    from app.services.rag_service import _tokenize
    assert _tokenize("") == []
    assert _tokenize("le la les") == []


def test_tfidf_score_basic():
    from app.services.rag_service import _tfidf_score
    from collections import Counter
    query = ["snowflake", "dbt", "architecture"]
    doc   = ["snowflake", "dbt", "airflow", "python"]
    corpus_df = Counter({"snowflake": 2, "dbt": 3, "architecture": 1, "airflow": 5})
    score = _tfidf_score(query, doc, corpus_df, n_docs=10)
    assert score > 0


def test_tfidf_score_no_match():
    from app.services.rag_service import _tfidf_score
    from collections import Counter
    query = ["kubernetes", "helm"]
    doc   = ["snowflake", "dbt"]
    score = _tfidf_score(query, doc, Counter({"snowflake": 1}), n_docs=5)
    assert score == 0.0


def test_cosine_similarity_identical():
    from app.services.rag_service import _cosine_similarity
    vec = [1.0, 0.5, 0.3]
    assert abs(_cosine_similarity(vec, vec) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal():
    from app.services.rag_service import _cosine_similarity
    a = [1.0, 0.0]
    b = [0.0, 1.0]
    assert abs(_cosine_similarity(a, b)) < 1e-6


def test_cosine_similarity_dim_mismatch():
    from app.services.rag_service import _cosine_similarity
    assert _cosine_similarity([1.0, 2.0], [1.0]) == 0.0


# ── Embedding providers ───────────────────────────────────────────────────────

def test_get_embedding_no_keys():
    """Sans clé API, retourne (None, 'none', 'tfidf-fallback')."""
    with patch.dict("os.environ", {
        "GEMINI_API_KEY": "", "GLM_API_KEY": "",
        "OPENAI_API_KEY": "", "MISTRAL_API_KEY": ""
    }):
        with patch("app.services.rag_service.get_settings") as mock_settings:
            mock = MagicMock()
            mock.gemini_api_key = ""
            mock.glm_api_key = ""
            mock.openai_api_key = ""
            mock.mistral_api_key = ""
            mock_settings.return_value = mock
            from app.services.rag_service import get_embedding
            vec, provider, model = get_embedding("test text")
            assert vec is None
            assert provider == "none"
            assert model == "tfidf-fallback"


def test_get_embedding_info_no_keys():
    """Sans clés, mode tfidf-fallback."""
    with patch("app.services.rag_service.get_settings") as mock_settings:
        mock = MagicMock()
        mock.gemini_api_key = ""
        mock.glm_api_key = ""
        mock.openai_api_key = ""
        mock.mistral_api_key = ""
        mock_settings.return_value = mock
        with patch.dict("os.environ", {"GEMINI_API_KEY": "", "GLM_API_KEY": "", "OPENAI_API_KEY": "", "MISTRAL_API_KEY": ""}):
            from app.services.rag_service import get_embedding_info
            info = get_embedding_info()
            assert info["mode"] == "tfidf"
            assert info["active_provider"] == "tfidf-fallback"
            assert info["available"] == []


def test_get_embedding_info_with_gemini():
    """Avec GEMINI_API_KEY, mode vector avec Gemini."""
    with patch("app.services.rag_service.get_settings") as mock_settings:
        mock = MagicMock()
        mock.gemini_api_key = "fake-gemini-key"
        mock.glm_api_key = ""
        mock.openai_api_key = ""
        mock.mistral_api_key = ""
        mock_settings.return_value = mock
        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
            from app.services.rag_service import get_embedding_info
            info = get_embedding_info()
            assert info["mode"] == "vector"
            assert info["active_provider"] == "gemini"
            assert len(info["available"]) >= 1


# ── build_rag_context ─────────────────────────────────────────────────────────

def test_build_rag_context_empty():
    from app.services.rag_service import build_rag_context
    assert build_rag_context([]) == ""


def test_build_rag_context_with_results():
    from app.services.rag_service import build_rag_context
    similar = [
        {"id": 1, "title": "Mémoire SACEM", "type": "technical_proposal",
         "score": 0.87, "content_preview": "Architecture Snowflake...", "source": "vector"},
        {"id": 2, "title": "Propale Thales", "type": "commercial_proposal",
         "score": 0.72, "content_preview": "Expertise dbt Core...", "source": "tfidf"},
    ]
    ctx = build_rag_context(similar)
    assert "Mémoire SACEM" in ctx
    assert "Propale Thales" in ctx
    assert "87%" in ctx  # similarité vectorielle
    assert "Exemple 1" in ctx
    assert "Exemple 2" in ctx


# ── DB-dependent (mock) ───────────────────────────────────────────────────────

def test_find_similar_deliverables_tfidf_empty_db():
    from app.services.rag_service import find_similar_deliverables_tfidf
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = []
    mock_db.query.return_value = mock_query

    result = find_similar_deliverables_tfidf(mock_db, "Snowflake architecture")
    assert result == []


def test_find_similar_deliverables_tfidf_with_candidates():
    from app.services.rag_service import find_similar_deliverables_tfidf
    mock_db = MagicMock()

    cand1 = MagicMock()
    cand1.id = 1
    cand1.title = "Architecture Snowflake dbt"
    cand1.content = "Mise en place d'un data lake avec Snowflake et dbt Core pour l'analyse"
    cand1.deliverable_type = "technical_proposal"
    cand1.status = "approved"
    cand1.created_at = MagicMock()

    cand2 = MagicMock()
    cand2.id = 2
    cand2.title = "Migration PostgreSQL"
    cand2.content = "Migration de base de données PostgreSQL vers cloud AWS"
    cand2.deliverable_type = "technical_proposal"
    cand2.status = "approved"
    cand2.created_at = MagicMock()

    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [cand1, cand2]
    mock_db.query.return_value = mock_query

    results = find_similar_deliverables_tfidf(
        mock_db, "Snowflake dbt architecture data lake", limit=3
    )
    assert len(results) >= 1
    # cand1 doit scorer plus haut (plus de termes communs)
    assert results[0]["id"] == 1
    assert results[0]["source"] == "tfidf"
    assert results[0]["score"] > 0


def test_table_exists_false():
    """_table_exists retourne False si la table n'existe pas."""
    from app.services.rag_service import _table_exists
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("table does not exist")
    assert _table_exists(mock_db) is False


def test_vector_search_no_embedding_provider():
    """vector_search retourne [] si pas de provider d'embedding."""
    from app.services.rag_service import vector_search
    mock_db = MagicMock()
    with patch("app.services.rag_service.get_embedding", return_value=(None, "none", "tfidf-fallback")):
        result = vector_search(mock_db, "test query")
        assert result == []
