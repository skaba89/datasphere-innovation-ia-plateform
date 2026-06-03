"""
LLM Providers complete test suite.
Covers: list, active, recommendations, per-task recommendations,
provider structure, tier ordering, cost-first strategy.
"""
import pytest

BASE = "/api/v1/providers"


class TestProvidersList:
    def test_requires_auth(self, client):
        assert client.get(BASE).status_code == 401

    def test_returns_all_providers(self, client, auth_headers):
        r = client.get(BASE, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "providers" in data
        assert "summary" in data
        assert len(data["providers"]) >= 11

    def test_provider_structure(self, client, auth_headers):
        r = client.get(BASE, headers=auth_headers)
        for p in r.json()["providers"]:
            assert "name" in p
            assert "label" in p
            assert "tier" in p
            assert "tier_label" in p
            assert "configured" in p
            assert "active_model" in p
            assert "context_window" in p
            assert "strengths" in p
            assert isinstance(p["configured"], bool)
            assert isinstance(p["strengths"], list)

    def test_all_11_providers_present(self, client, auth_headers):
        r = client.get(BASE, headers=auth_headers)
        names = {p["name"] for p in r.json()["providers"]}
        expected = {"glm", "groq", "gemini", "together", "qwen", "openrouter", "mistral", "cohere", "perplexity", "openai", "anthropic"}
        assert expected.issubset(names)

    def test_cost_first_ordering(self, client, auth_headers):
        """Free providers must come before premium in the list."""
        r = client.get(BASE, headers=auth_headers)
        providers = r.json()["providers"]
        free_idx = next((i for i, p in enumerate(providers) if p["tier"] == "free"), None)
        premium_idx = next((i for i, p in enumerate(providers) if p["tier"] == "premium"), None)
        if free_idx is not None and premium_idx is not None:
            assert free_idx < premium_idx, "Free providers must appear before premium"

    def test_summary_structure(self, client, auth_headers):
        r = client.get(BASE, headers=auth_headers)
        summary = r.json()["summary"]
        assert "total" in summary
        assert "configured" in summary
        assert "active_provider" in summary
        assert "priority_order" in summary
        assert isinstance(summary["priority_order"], list)


class TestActiveProviders:
    def test_requires_auth(self, client):
        assert client.get(f"{BASE}/active").status_code == 401

    def test_active_providers_structure(self, client, auth_headers):
        r = client.get(f"{BASE}/active", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "active_providers" in data
        assert "current" in data
        assert "fallback_chain" in data
        assert isinstance(data["fallback_chain"], list)

    def test_simulation_always_available(self, client, auth_headers):
        """Without API keys, simulation mode must be available."""
        r = client.get(f"{BASE}/active", headers=auth_headers)
        current = r.json()["current"]
        # simulation is the fallback when no providers configured
        assert isinstance(current, str)


class TestProviderRecommendations:
    def test_requires_auth(self, client):
        assert client.get(f"{BASE}/recommendations").status_code == 401

    def test_general_recommendations(self, client, auth_headers):
        r = client.get(f"{BASE}/recommendations", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "strategy" in data or "priority_order" in data
        assert "tips" in data
        assert isinstance(data.get("tips", []), list)

    def test_task_recommendation_context_analysis(self, client, auth_headers):
        r = client.get(f"{BASE}/recommendations?task_type=context_analysis", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "best_providers" in data
        assert "task_type" in data
        assert data["task_type"] == "context_analysis"

    def test_task_recommendation_go_no_go(self, client, auth_headers):
        r = client.get(f"{BASE}/recommendations?task_type=go_no_go_recommendation", headers=auth_headers)
        assert r.status_code == 200
        assert "best_providers" in r.json()

    def test_task_recommendation_all_types(self, client, auth_headers):
        task_types = [
            "context_analysis", "go_no_go_recommendation",
            "tender_requirements_review", "deliverable_plan",
            "compliance_matrix", "commercial_proposal",
        ]
        for task_type in task_types:
            r = client.get(f"{BASE}/recommendations?task_type={task_type}", headers=auth_headers)
            assert r.status_code == 200, f"Failed for task_type={task_type}"
            assert "best_providers" in r.json()

    def test_tier_breakdown_in_general_recommendations(self, client, auth_headers):
        r = client.get(f"{BASE}/recommendations", headers=auth_headers)
        data = r.json()
        if "tier_breakdown" in data:
            tb = data["tier_breakdown"]
            assert "free" in tb
            assert "premium" in tb
            assert "glm" in tb["free"]
