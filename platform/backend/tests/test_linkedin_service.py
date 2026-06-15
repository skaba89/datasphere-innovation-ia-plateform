"""Tests unitaires — LinkedIn Agent + OAuth"""
import pytest
from unittest.mock import patch, MagicMock


def test_generate_post_simulation():
    """Génère un post en mode simulation."""
    from app.services.linkedin_agent import generate_post

    with patch("app.services.linkedin_agent.complete") as mock_complete:
        mock_complete.return_value = (
            "🚀 Data Engineering en 2025 : pourquoi dbt Core change tout...\n\n#DataEngineering #dbt",
            "simulation"
        )
        result = generate_post(topic_type="data_engineering")

    assert "content" in result
    assert len(result["content"]) > 20
    assert "provider" in result
    assert "hashtags" in result
    assert isinstance(result["hashtags"], list)


def test_generate_post_topic_types():
    """Tous les topic_types acceptés doivent fonctionner."""
    from app.services.linkedin_agent import generate_post, TOPIC_PROMPTS

    for topic_type in TOPIC_PROMPTS.keys():
        with patch("app.services.linkedin_agent.complete") as mock_complete:
            mock_complete.return_value = (f"Post sur {topic_type}", "simulation")
            result = generate_post(topic_type=topic_type)
            assert "content" in result


def test_generate_post_custom_topic():
    """Sujet personnalisé injecté dans le prompt."""
    from app.services.linkedin_agent import generate_post

    captured = []
    def mock_complete(prompt, system=None, action_type=None):
        captured.append(prompt)
        return ("Post généré", "simulation")

    with patch("app.services.linkedin_agent.complete", side_effect=mock_complete):
        generate_post(topic_type="data_engineering", topic="dbt vs SQL Mesh")

    assert len(captured) == 1
    assert "dbt vs SQL Mesh" in captured[0]


def test_hashtag_extraction():
    """Les hashtags sont extraits du contenu généré."""
    from app.services.linkedin_agent import generate_post

    content_with_hashtags = "Contenu du post\n\n#DataEngineering #Snowflake #dbt #Python"
    with patch("app.services.linkedin_agent.complete") as mock_complete:
        mock_complete.return_value = (content_with_hashtags, "simulation")
        result = generate_post(topic_type="data_engineering")

    assert "DataEngineering" in result["hashtags"] or "#DataEngineering" in result["hashtags"] or len(result["hashtags"]) >= 1


def test_generate_from_tender():
    """Génération depuis un AO."""
    from app.services.linkedin_agent import generate_from_tender

    with patch("app.services.linkedin_agent.generate_post") as mock_gen:
        mock_gen.return_value = {
            "content": "Post depuis AO", "provider": "simulation",
            "hashtags": ["#DataEngineering"], "topic": "ao_insight",
            "topic_type": "ao_insight", "word_count": 5, "char_count": 14,
            "generated_at": "2026-06-15T00:00:00"
        }
        result = generate_from_tender(
            tender_title="Mission Snowflake SACEM",
            tender_summary="Architecture data lake",
            workflow_result="Mémoire soumise",
        )

    assert result["content"] == "Post depuis AO"
    mock_gen.assert_called_once()
    call_kwargs = mock_gen.call_args
    assert call_kwargs.kwargs.get("topic_type") == "ao_insight" or \
           (call_kwargs.args and call_kwargs.args[0] == "ao_insight")


def test_oauth_status_no_token():
    """Status OAuth sans token stocké."""
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        resp = client.get("/api/v1/linkedin/oauth/status")
        assert resp.status_code in (401, 403)  # Requiert auth


def test_publish_endpoint_no_token_in_db():
    """Publish sans token DB → 401."""
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        resp = client.post("/api/v1/linkedin/publish", json={"content": "test"})
        assert resp.status_code in (401, 403)
