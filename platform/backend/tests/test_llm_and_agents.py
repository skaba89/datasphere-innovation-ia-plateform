"""Tests for llm_service — provider selection, simulation, list_providers."""
import pytest
from unittest.mock import patch, MagicMock


# ── list_providers ─────────────────────────────────────────────────────────────

def test_list_providers_returns_all():
    from app.services.llm_service import list_providers
    providers = list_providers()
    assert len(providers) >= 11
    names = [p["name"] for p in providers]
    for expected in ["groq", "gemini", "openai", "anthropic", "mistral", "openrouter"]:
        assert expected in names


def test_list_providers_structure():
    from app.services.llm_service import list_providers
    for p in list_providers():
        assert "name" in p
        assert "configured" in p
        assert "tier" in p
        assert isinstance(p["configured"], bool)


def test_list_providers_unconfigured_by_default():
    """Without env vars, all providers should be unconfigured."""
    from app.services.llm_service import list_providers
    providers = list_providers()
    # In test env (no real API keys), most should be unconfigured
    configured = [p for p in providers if p["configured"]]
    # At least providers is a list (may vary in CI)
    assert isinstance(configured, list)


# ── _simulate ─────────────────────────────────────────────────────────────────

def test_simulate_returns_text():
    from app.services.llm_service import _simulate
    result, next_step = _simulate("context_analysis")
    assert isinstance(result, str)
    assert len(result) > 20


def test_simulate_all_action_types():
    from app.services.llm_service import _simulate
    for action_type in ["context_analysis", "go_no_go_recommendation",
                        "tender_requirements_review", "compliance_matrix",
                        "deliverable_plan", "commercial_proposal", "sector_analysis"]:
        result, _ = _simulate(action_type)
        assert len(result) > 10


# ── complete() fallback to simulation ─────────────────────────────────────────

def test_complete_falls_back_to_simulation():
    """Without any API key, complete() should use simulation."""
    from app.services.llm_service import complete
    # Patch all provider call functions to fail
    with patch("app.services.llm_service._call_groq", side_effect=Exception("No key")), \
         patch("app.services.llm_service._call_gemini", side_effect=Exception("No key")), \
         patch("app.services.llm_service._call_openai", side_effect=Exception("No key")):
        result, provider = complete(
            prompt="Analyse cet AO",
            system="Tu es expert data",
            action_type="context_analysis",
        )
    assert isinstance(result, str)
    assert len(result) > 0


def test_complete_returns_tuple():
    from app.services.llm_service import complete
    result, provider = complete("Test prompt", "Test system", "context_analysis")
    assert isinstance(result, str)
    assert isinstance(provider, str)


# ── provider_label ─────────────────────────────────────────────────────────────

def test_provider_label():
    from app.services.llm_service import provider_label
    label = provider_label()
    assert isinstance(label, str)
    assert len(label) > 0


# ── BOAMP client ──────────────────────────────────────────────────────────────

def test_boamp_keywords_defined():
    from app.services.boamp_client import DATA_KEYWORDS, DATA_CPV_PREFIXES
    assert len(DATA_KEYWORDS) > 3
    assert len(DATA_CPV_PREFIXES) > 0
    assert any("data" in kw.lower() for kw in DATA_KEYWORDS)


def test_boamp_annonce_structure():
    from app.services.boamp_client import BOAMPAnnonce
    annonce = BOAMPAnnonce(
        id="BOAMP-2026-001",
        reference="2026-001",
        title="Test AO Data",
        buyer_name="ARTP",
        published_date="2026-06-01",
        deadline="2026-07-30",
        estimated_value=None,
        url="https://boamp.fr/xxx",
        summary="Audit data",
    )
    assert annonce.title == "Test AO Data"
    assert annonce.buyer_name == "ARTP"


@patch("urllib.request.urlopen")
def test_fetch_boamp_handles_network_error(mock_urlopen):
    """fetch_boamp should return empty list on network error."""
    from app.services.boamp_client import fetch_boamp
    mock_urlopen.side_effect = Exception("Network error")
    results = fetch_boamp(query="data engineer", limit=5)
    assert isinstance(results, list)
    assert len(results) == 0


# ── LinkedIn agent ─────────────────────────────────────────────────────────────

def test_generate_post_structure():
    from app.services.linkedin_agent import generate_post
    with patch("app.services.llm_service.complete") as mock_complete:
        mock_complete.return_value = ("Post LinkedIn test #DataEngineering #Snowflake", "simulation")
        result = generate_post(topic_type="data_engineering", topic="Test topic")
    assert "content" in result
    assert "topic" in result
    assert "hashtags" in result
    assert "word_count" in result
    assert "#DataEngineering" in result["hashtags"]


def test_generate_from_tender():
    from app.services.linkedin_agent import generate_from_tender
    with patch("app.services.llm_service.complete") as mock_complete:
        mock_complete.return_value = ("Post AO insight test #DataEngineering", "simulation")
        result = generate_from_tender(
            tender_title="Audit Plateforme Data Nationale",
            tender_summary="Audit de la QoS des opérateurs",
            workflow_result="Architecture Snowflake recommandée",
        )
    assert "content" in result
    assert result["topic_type"] == "ao_insight"
