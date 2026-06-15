"""Tests unitaires — Mémoire Technique"""
import pytest
from unittest.mock import patch, MagicMock


def test_structure_prompt_has_all_sections():
    """Le prompt doit contenir les 8 sections obligatoires."""
    from app.services.memoire_technique import STRUCTURE_PROMPT
    required_sections = [
        "Compréhension du besoin",
        "approche méthodologique",
        "Équipe",
        "Planning",
        "Références",
        "valeur",
        "risques",
        "Budget",
    ]
    prompt_lower = STRUCTURE_PROMPT.lower()
    for section in required_sections:
        assert section.lower() in prompt_lower, f"Section manquante: {section}"


def test_company_context_has_key_info():
    from app.services.memoire_technique import COMPANY_CONTEXT
    assert "DataSphere" in COMPANY_CONTEXT
    assert "Snowflake" in COMPANY_CONTEXT
    assert "dbt" in COMPANY_CONTEXT


def test_generate_memoire_technique_simulation():
    """Test avec LLM simulation (pas de clé API)."""
    from app.services.memoire_technique import generate_memoire_technique

    with patch("app.services.memoire_technique.complete") as mock_complete:
        mock_complete.return_value = (
            "# Mémoire Technique — Test\n\n## 1. Compréhension du besoin\nContenu de test...",
            "simulation"
        )
        result = generate_memoire_technique(
            tender_title="Mission Data Engineering",
            buyer_name="Ministère des Finances",
            summary="Architecture data lake Snowflake",
            estimated_budget="200k€",
            submission_deadline="2026-07-31",
        )

    assert "content" in result
    assert "Mémoire Technique" in result["content"]
    assert result["provider"] == "simulation"
    assert result["word_count"] > 0
    assert result["tender_title"] == "Mission Data Engineering"


def test_generate_memoire_with_experiences():
    """Les expériences réelles doivent enrichir le prompt."""
    from app.services.memoire_technique import generate_memoire_technique

    experiences = [
        {
            "company": "SACEM",
            "client_name": "SACEM",
            "role": "Data Engineer Senior",
            "sector": "Droits d'auteur",
            "start_date": "2023-01",
            "end_date": "2024-06",
            "is_current": False,
            "description": "Architecture Snowflake + dbt Core",
            "achievements": "Réduction latence requêtes de 80%",
            "technologies": "Snowflake, dbt, Airflow, Python",
        }
    ]

    captured_prompt = []

    def mock_complete(prompt, system=None, action_type=None):
        captured_prompt.append(prompt)
        return ("# Mémoire\n\nContenu généré", "simulation")

    with patch("app.services.memoire_technique.complete", side_effect=mock_complete):
        generate_memoire_technique(
            tender_title="Test AO",
            buyer_name="DGFIP",
            summary="Data lake",
            estimated_budget="100k",
            submission_deadline="2026-08-01",
            real_experiences=experiences,
        )

    assert len(captured_prompt) == 1
    assert "SACEM" in captured_prompt[0]
    assert "Snowflake" in captured_prompt[0]


def test_generate_memoire_error_handling():
    """En cas d'erreur LLM, retourne un dict avec content d'erreur."""
    from app.services.memoire_technique import generate_memoire_technique

    with patch("app.services.memoire_technique.complete", side_effect=Exception("LLM timeout")):
        result = generate_memoire_technique(
            tender_title="Test", buyer_name="Test", summary=None,
            estimated_budget=None, submission_deadline=None,
        )

    assert "content" in result
    assert result["provider"] == "error"
    assert result["word_count"] == 0
    assert "Erreur" in result["content"]


def test_memoire_endpoint_get_no_cache():
    """GET /tenders/{id}/memoire retourne 404 si pas de mémoire générée."""
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        # Sans auth → 401 ou 403
        resp = client.get("/api/v1/tenders/99999/memoire")
        assert resp.status_code in (401, 403, 404)
