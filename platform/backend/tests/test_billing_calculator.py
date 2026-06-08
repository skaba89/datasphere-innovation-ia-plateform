"""
Tests — Billing (Stripe) + Calculateur de rentabilité

Billing :
  GET  /billing/plans          — catalog public
  GET  /billing/subscription   — subscription pour workspace
  POST /billing/checkout       — checkout (mode mock si Stripe absent)
  POST /billing/mock-upgrade   — upgrade en mode dev
  GET  /billing/quota/*        — quotas par ressource

Calculator :
  GET  /calculator/presets     — public
  POST /calculator/simulate    — simulation complète
  POST /calculator/scenarios   — comparaison scénarios
"""
import pytest

BASE_BILLING = "/api/v1/billing"
BASE_CALC    = "/api/v1/calculator"


# ══════════════════════════════════════════════════════════════════════════════
# BILLING PLANS
# ══════════════════════════════════════════════════════════════════════════════

class TestBillingPlans:
    def test_plans_public(self, client):
        """Plans catalog is public — no auth needed."""
        r = client.get(f"{BASE_BILLING}/plans")
        assert r.status_code == 200

    def test_plans_structure(self, client):
        data = client.get(f"{BASE_BILLING}/plans").json()
        assert "plans" in data
        assert "stripe_enabled" in data
        assert isinstance(data["plans"], list)

    def test_plans_has_four_tiers(self, client):
        plans = client.get(f"{BASE_BILLING}/plans").json()["plans"]
        keys = [p["key"] for p in plans]
        assert "free" in keys
        assert "starter" in keys
        assert "pro" in keys
        assert "enterprise" in keys

    def test_plans_free_is_zero(self, client):
        plans = {p["key"]: p for p in client.get(f"{BASE_BILLING}/plans").json()["plans"]}
        assert plans["free"]["price_eur"] == 0

    def test_plans_starter_has_price(self, client):
        plans = {p["key"]: p for p in client.get(f"{BASE_BILLING}/plans").json()["plans"]}
        assert plans["starter"]["price_eur"] > 0
        assert plans["pro"]["price_eur"] > plans["starter"]["price_eur"]

    def test_plans_have_features(self, client):
        plans = client.get(f"{BASE_BILLING}/plans").json()["plans"]
        for p in plans:
            assert "features" in p
            assert isinstance(p["features"], list)
            assert len(p["features"]) >= 1

    def test_plans_have_limits(self, client):
        plans = client.get(f"{BASE_BILLING}/plans").json()["plans"]
        for p in plans:
            assert "limits" in p
            lim = p["limits"]
            assert "members" in lim
            assert "tenders" in lim
            assert "ai_actions" in lim

    def test_pro_has_unlimited_tenders(self, client):
        plans = {p["key"]: p for p in client.get(f"{BASE_BILLING}/plans").json()["plans"]}
        assert plans["pro"]["limits"]["tenders"] == -1  # -1 = unlimited


# ══════════════════════════════════════════════════════════════════════════════
# BILLING SUBSCRIPTION
# ══════════════════════════════════════════════════════════════════════════════

class TestBillingSubscription:
    def test_requires_auth(self, client):
        r = client.get(f"{BASE_BILLING}/subscription?workspace_id=1")
        assert r.status_code == 401

    def test_returns_subscription(self, client, auth_headers):
        # Create a workspace first
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Billing Test WS", "slug": f"billing-test-{__import__('time').time_ns()}"
        }).json()
        r = client.get(f"{BASE_BILLING}/subscription?workspace_id={ws['id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_subscription_structure(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Sub Test WS", "slug": f"sub-test-{__import__('time').time_ns()}"
        }).json()
        data = client.get(f"{BASE_BILLING}/subscription?workspace_id={ws['id']}", headers=auth_headers).json()
        assert "plan" in data
        assert "status" in data
        assert "ai_actions_used" in data
        assert "features" in data

    def test_new_workspace_defaults_free(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Free WS Default", "slug": f"free-ws-{__import__('time').time_ns()}"
        }).json()
        data = client.get(f"{BASE_BILLING}/subscription?workspace_id={ws['id']}", headers=auth_headers).json()
        assert data["plan"] == "free"
        assert data["status"] == "active"


# ══════════════════════════════════════════════════════════════════════════════
# MOCK UPGRADE
# ══════════════════════════════════════════════════════════════════════════════

class TestMockUpgrade:
    def test_requires_auth(self, client):
        r = client.post(f"{BASE_BILLING}/mock-upgrade", json={"workspace_id": 1, "plan": "pro"})
        assert r.status_code == 401

    def test_upgrade_to_starter(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Upgrade Test", "slug": f"upgrade-{__import__('time').time_ns()}"
        }).json()
        r = client.post(f"{BASE_BILLING}/mock-upgrade", headers=auth_headers, json={
            "workspace_id": ws["id"], "plan": "starter"
        })
        assert r.status_code == 200
        assert r.json()["plan"] == "starter"

    def test_upgrade_reflected_in_subscription(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Upgrade Check", "slug": f"upcheck-{__import__('time').time_ns()}"
        }).json()
        client.post(f"{BASE_BILLING}/mock-upgrade", headers=auth_headers, json={
            "workspace_id": ws["id"], "plan": "pro"
        })
        sub = client.get(f"{BASE_BILLING}/subscription?workspace_id={ws['id']}", headers=auth_headers).json()
        assert sub["plan"] == "pro"

    def test_invalid_plan_rejected(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Bad Plan", "slug": f"badplan-{__import__('time').time_ns()}"
        }).json()
        r = client.post(f"{BASE_BILLING}/mock-upgrade", headers=auth_headers, json={
            "workspace_id": ws["id"], "plan": "diamond"
        })
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# QUOTA
# ══════════════════════════════════════════════════════════════════════════════

class TestBillingQuota:
    def test_requires_auth(self, client):
        r = client.get(f"{BASE_BILLING}/quota/tenders?workspace_id=1")
        assert r.status_code == 401

    def test_quota_tenders(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Quota WS", "slug": f"quota-{__import__('time').time_ns()}"
        }).json()
        r = client.get(f"{BASE_BILLING}/quota/tenders?workspace_id={ws['id']}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "allowed" in data
        assert "limit" in data
        assert "plan" in data

    def test_quota_members(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Q Members", "slug": f"qmembers-{__import__('time').time_ns()}"
        }).json()
        r = client.get(f"{BASE_BILLING}/quota/members?workspace_id={ws['id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_quota_free_plan_limits(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Q Free", "slug": f"qfree-{__import__('time').time_ns()}"
        }).json()
        data = client.get(f"{BASE_BILLING}/quota/members?workspace_id={ws['id']}", headers=auth_headers).json()
        # Free plan: max 1 member
        assert data["limit"] == 1

    def test_quota_pro_plan_unlimited(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Q Pro", "slug": f"qpro-{__import__('time').time_ns()}"
        }).json()
        client.post(f"{BASE_BILLING}/mock-upgrade", headers=auth_headers, json={
            "workspace_id": ws["id"], "plan": "pro"
        })
        data = client.get(f"{BASE_BILLING}/quota/tenders?workspace_id={ws['id']}", headers=auth_headers).json()
        assert data["limit"] == -1
        assert data["unlimited"] is True

    def test_invalid_resource_rejected(self, client, auth_headers):
        r = client.get(f"{BASE_BILLING}/quota/invalid_resource?workspace_id=1", headers=auth_headers)
        assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# CALCULATOR
# ══════════════════════════════════════════════════════════════════════════════

class TestCalculatorPresets:
    def test_presets_public(self, client):
        r = client.get(f"{BASE_CALC}/presets")
        assert r.status_code == 200

    def test_presets_structure(self, client):
        data = client.get(f"{BASE_CALC}/presets").json()
        assert "roles" in data
        assert "portage" in data
        assert "context" in data

    def test_presets_has_data_profiles(self, client):
        roles = client.get(f"{BASE_CALC}/presets").json()["roles"]
        assert any("data_engineer" in k for k in roles)
        assert any("data_architect" in k for k in roles)

    def test_presets_roles_have_tjm_range(self, client):
        roles = client.get(f"{BASE_CALC}/presets").json()["roles"]
        for key, role in roles.items():
            assert role["tjm_min"] > 0
            assert role["tjm_max"] >= role["tjm_min"]


class TestCalculatorSimulate:
    VALID_INPUT = {
        "tjm_ht": 650,
        "days_billed": 110,
        "portage_pct": 8.5,
        "overhead_monthly": 200,
        "non_billed_days": 30,
        "vat_regime": "normal",
        "include_cfe": True,
        "include_mutuelle": True,
    }

    def test_simulate_requires_auth(self, client):
        r = client.post(f"{BASE_CALC}/simulate", json=self.VALID_INPUT)
        assert r.status_code == 401

    def test_simulate_returns_200(self, client, auth_headers):
        r = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT)
        assert r.status_code == 200

    def test_simulate_structure(self, client, auth_headers):
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT).json()
        assert "revenue" in data
        assert "costs" in data
        assert "net" in data
        assert "metrics" in data
        assert "alerts" in data

    def test_simulate_math_coherence(self, client, auth_headers):
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT).json()
        # Gross = TJM × days
        assert data["revenue"]["gross_ht"] == pytest.approx(650 * 110, abs=1)
        # Net < Gross
        assert data["net"]["annual"] < data["revenue"]["gross_ht"]
        # Net > 0 for reasonable TJM
        assert data["net"]["annual"] > 0

    def test_simulate_monthly_is_annual_divided_12(self, client, auth_headers):
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT).json()
        assert data["net"]["monthly_avg"] == pytest.approx(data["net"]["annual"] / 12, abs=1)

    def test_simulate_breakeven_positive(self, client, auth_headers):
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT).json()
        assert data["metrics"]["breakeven_days"] > 0
        assert data["metrics"]["breakeven_days"] < 365

    def test_simulate_alerts_is_list(self, client, auth_headers):
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT).json()
        assert isinstance(data["alerts"], list)

    def test_simulate_low_tjm_triggers_alert(self, client, auth_headers):
        low_tjm = {**self.VALID_INPUT, "tjm_ht": 150, "days_billed": 50}
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=low_tjm).json()
        alert_levels = [a["level"] for a in data["alerts"]]
        assert "danger" in alert_levels or "warning" in alert_levels

    def test_simulate_high_tjm_success_alert(self, client, auth_headers):
        high_tjm = {**self.VALID_INPUT, "tjm_ht": 1200, "days_billed": 180}
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=high_tjm).json()
        alert_levels = [a["level"] for a in data["alerts"]]
        assert "success" in alert_levels

    def test_simulate_no_portage(self, client, auth_headers):
        no_port = {**self.VALID_INPUT, "portage_pct": 0}
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=no_port).json()
        assert data["costs"]["portage_fee"] == 0

    def test_simulate_franchise_vat(self, client, auth_headers):
        franchise = {**self.VALID_INPUT, "vat_regime": "franchise"}
        data = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=franchise).json()
        assert data["revenue"]["vat_collected"] == 0

    def test_simulate_missing_tjm_rejected(self, client, auth_headers):
        r = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json={
            "days_billed": 100, "portage_pct": 8.5,
        })
        assert r.status_code == 422

    def test_simulate_never_500(self, client, auth_headers):
        r = client.post(f"{BASE_CALC}/simulate", headers=auth_headers, json=self.VALID_INPUT)
        assert r.status_code != 500


class TestCalculatorScenarios:
    def test_scenarios_requires_auth(self, client):
        r = client.post(f"{BASE_CALC}/scenarios", json={"scenarios": []})
        assert r.status_code == 401

    def test_scenarios_returns_comparison(self, client, auth_headers):
        r = client.post(f"{BASE_CALC}/scenarios", headers=auth_headers, json={
            "scenarios": [
                {"label": "Mission A — 650€/j", "simulation": {
                    "tjm_ht": 650, "days_billed": 110, "portage_pct": 8.5,
                    "overhead_monthly": 200, "non_billed_days": 30,
                    "vat_regime": "normal", "include_cfe": True, "include_mutuelle": True,
                }},
                {"label": "Mission B — 800€/j", "simulation": {
                    "tjm_ht": 800, "days_billed": 90, "portage_pct": 0,
                    "overhead_monthly": 300, "non_billed_days": 45,
                    "vat_regime": "normal", "include_cfe": True, "include_mutuelle": True,
                }},
            ]
        })
        assert r.status_code == 200
        data = r.json()
        assert "scenarios" in data
        assert len(data["scenarios"]) == 2

    def test_scenarios_ranked_best_first(self, client, auth_headers):
        r = client.post(f"{BASE_CALC}/scenarios", headers=auth_headers, json={
            "scenarios": [
                {"label": "Low", "simulation": {
                    "tjm_ht": 300, "days_billed": 60, "portage_pct": 8.5,
                    "overhead_monthly": 200, "non_billed_days": 30,
                    "vat_regime": "normal", "include_cfe": True, "include_mutuelle": True,
                }},
                {"label": "High", "simulation": {
                    "tjm_ht": 900, "days_billed": 150, "portage_pct": 0,
                    "overhead_monthly": 200, "non_billed_days": 30,
                    "vat_regime": "normal", "include_cfe": True, "include_mutuelle": True,
                }},
            ]
        })
        scenarios = r.json()["scenarios"]
        assert scenarios[0]["rank"] == 1
        assert scenarios[0]["is_best"] is True
        # Best should have higher net
        assert scenarios[0]["net"]["annual"] > scenarios[1]["net"]["annual"]

    def test_scenarios_min_2_required(self, client, auth_headers):
        r = client.post(f"{BASE_CALC}/scenarios", headers=auth_headers, json={
            "scenarios": [{"label": "Only one", "simulation": {
                "tjm_ht": 650, "days_billed": 110, "portage_pct": 8.5,
                "overhead_monthly": 200, "non_billed_days": 30,
                "vat_regime": "normal", "include_cfe": True, "include_mutuelle": True,
            }}]
        })
        assert r.status_code == 422

    def test_scenarios_max_4(self, client, auth_headers):
        base_sim = {"tjm_ht": 650, "days_billed": 110, "portage_pct": 8.5,
                    "overhead_monthly": 200, "non_billed_days": 30,
                    "vat_regime": "normal", "include_cfe": True, "include_mutuelle": True}
        r = client.post(f"{BASE_CALC}/scenarios", headers=auth_headers, json={
            "scenarios": [{"label": f"S{i}", "simulation": base_sim} for i in range(5)]
        })
        assert r.status_code == 422
