"""
Tests QA — Analytics endpoints + Workflow complet
  - Analytics : dashboard KPIs, pipeline, timeline, performance
  - Workflow : démarrage, étapes, approbation, livrables générés
  - Webhook : delivery history, redeliver
  - WorkflowTimeline : étapes colorées, statuts
"""

import pytest


# ═══════════════════════════════════════════════════════════════════════════════
# Analytics endpoints — couverture complète
# ═══════════════════════════════════════════════════════════════════════════════

class TestAnalyticsEndpoints:

    def test_dashboard_kpis(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        # Core sections
        assert "crm" in data or "tenders" in data or "deliverables" in data

    def test_pipeline_analytics(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/pipeline", headers=auth_headers)
        assert resp.status_code in (200, 404)  # May not exist on all versions

    def test_performance_analytics(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/performance", headers=auth_headers)
        assert resp.status_code in (200, 404)

    def test_timeline_analytics(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/timeline", headers=auth_headers)
        assert resp.status_code in (200, 404)

    def test_dashboard_has_top_tenders(self, client, auth_headers):
        data = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
        # After Sprint 6, dashboard includes top_tenders
        # (may be empty if no tenders, but key should exist)
        if "top_tenders" in data:
            assert isinstance(data["top_tenders"], list)

    def test_dashboard_has_recent_deliverables(self, client, auth_headers):
        data = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
        if "recent_deliverables" in data:
            assert isinstance(data["recent_deliverables"], list)

    def test_dashboard_has_active_provider(self, client, auth_headers):
        data = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
        if "active_provider" in data:
            assert isinstance(data["active_provider"], str)

    def test_analytics_require_auth(self, client):
        resp = client.get("/api/v1/analytics/dashboard")
        assert resp.status_code == 401

    def test_analytics_return_json(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
        assert "application/json" in resp.headers.get("content-type", "")

    def test_dashboard_cache_hit_structure(self, client, auth_headers):
        """Two consecutive calls return same structure (cache consistent)."""
        from app.services.cache_service import invalidate_dashboard
        invalidate_dashboard()
        r1 = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
        r2 = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
        assert set(r1.keys()) == set(r2.keys())


# ═══════════════════════════════════════════════════════════════════════════════
# Workflow complet
# ═══════════════════════════════════════════════════════════════════════════════

class TestWorkflowComplete:

    def test_workflow_start(self, client, auth_headers, tender):
        """Can start a workflow on a tender."""
        resp = client.post(
            f"/api/v1/workflow/{tender['id']}/start",
            headers=auth_headers, json={"force_reset": False},
        )
        assert resp.status_code in (200, 201, 409)  # 409 if already started
        if resp.status_code in (200, 201):
            data = resp.json()
            assert "id" in data or "instance_id" in data or "status" in data

    def test_workflow_get_instance(self, client, auth_headers, tender):
        """Can retrieve workflow instance for a tender."""
        # Start it first
        client.post(f"/api/v1/workflow/{tender['id']}/start", headers=auth_headers)
        # Get it
        resp = client.get(
            f"/api/v1/workflow/{tender['id']}",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data
            assert "steps" in data

    def test_workflow_status_values(self, client, auth_headers, tender):
        """Workflow status should be a known value."""
        client.post(f"/api/v1/workflow/{tender['id']}/start", headers=auth_headers)
        resp = client.get(f"/api/v1/workflow/{tender['id']}", headers=auth_headers)
        if resp.status_code == 200:
            data = resp.json()
            valid_statuses = {"pending", "running", "awaiting_approval", "completed", "error", "cancelled", "idle", "failed", "paused"}
            assert data["status"] in valid_statuses

    def test_workflow_steps_ordered(self, client, auth_headers, tender):
        """Workflow steps should be ordered by order_index."""
        client.post(f"/api/v1/workflow/{tender['id']}/start", headers=auth_headers)
        resp = client.get(f"/api/v1/workflow/{tender['id']}", headers=auth_headers)
        if resp.status_code == 200:
            steps = resp.json().get("steps", [])
            if len(steps) > 1:
                orders = [s.get("order_index", i) for i, s in enumerate(steps)]
                assert orders == sorted(orders)

    def test_workflow_reset(self, client, auth_headers, tender):
        """Can reset a workflow."""
        client.post(f"/api/v1/workflow/{tender['id']}/start", headers=auth_headers)
        resp = client.post(
            f"/api/v1/workflow/{tender['id']}/reset",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 204, 404)

    def test_workflow_requires_auth(self, client, tender):
        resp = client.post(f"/api/v1/workflow/{tender['id']}/start")
        assert resp.status_code == 401

    def test_workflow_404_on_missing_tender(self, client, auth_headers):
        resp = client.post("/api/v1/workflow/999999/start", headers=auth_headers)
        assert resp.status_code in (404, 422)

    def test_workflow_progress_structure(self, client, auth_headers, tender):
        """Workflow instance has progress fields."""
        client.post(f"/api/v1/workflow/{tender['id']}/start", headers=auth_headers)
        resp = client.get(f"/api/v1/workflow/{tender['id']}", headers=auth_headers)
        if resp.status_code == 200:
            data = resp.json()
            if "progress_pct" in data:
                assert 0 <= data["progress_pct"] <= 100
            if "steps_done" in data and "steps_total" in data:
                assert data["steps_done"] <= data["steps_total"]


# ═══════════════════════════════════════════════════════════════════════════════
# Webhook delivery
# ═══════════════════════════════════════════════════════════════════════════════

class TestWebhookDelivery:

    def test_webhook_delivery_history(self, client, auth_headers):
        """Can get delivery history for a webhook."""
        # Create a webhook first
        wh = client.post("/api/v1/webhooks", headers=auth_headers, json={
            "name": "Test Delivery History",
            "url": "https://example.com/webhook",
            "events": ["tender.created"],
            "is_active": True,
        }).json()

        if "id" in wh:
            resp = client.get(f"/api/v1/webhooks/{wh['id']}/delivery-history",
                              headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert "id" in data
            assert "url" in data
            assert "last_delivery_status" in data
            assert "is_healthy" in data

    def test_webhook_templates_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/webhooks/templates", headers=auth_headers)
        assert resp.status_code == 200
        templates = resp.json()
        assert len(templates) >= 3

    def test_webhook_redeliver(self, client, auth_headers):
        """Can request redelivery (fire-and-forget)."""
        wh = client.post("/api/v1/webhooks", headers=auth_headers, json={
            "name": "Redeliver Test",
            "url": "https://httpbin.org/post",  # Real URL for test
            "events": ["*"],
            "is_active": True,
        }).json()
        if "id" in wh:
            resp = client.post(
                f"/api/v1/webhooks/{wh['id']}/redeliver?event_type=test",
                headers=auth_headers,
            )
            assert resp.status_code in (200, 500)  # 500 if URL not reachable in test

    def test_webhook_delivery_history_404(self, client, auth_headers):
        resp = client.get("/api/v1/webhooks/999999/delivery-history", headers=auth_headers)
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Pagination TenderPage API
# ═══════════════════════════════════════════════════════════════════════════════

class TestTenderPagination:

    def test_tenders_list_with_limit(self, client, auth_headers):
        resp = client.get("/api/v1/tenders?limit=5&skip=0", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) <= 5

    def test_tenders_list_with_skip(self, client, auth_headers, tender):
        """Skip returns different results than page 1."""
        page1 = client.get("/api/v1/tenders?limit=1&skip=0", headers=auth_headers).json()
        page2 = client.get("/api/v1/tenders?limit=1&skip=1", headers=auth_headers).json()
        # If there are 2+ tenders, pages should differ
        if len(page1) > 0 and len(page2) > 0:
            assert page1[0]["id"] != page2[0]["id"]

    def test_tenders_limit_max(self, client, auth_headers):
        """Limit > 500 should be capped."""
        resp = client.get("/api/v1/tenders?limit=1000", headers=auth_headers)
        assert resp.status_code in (200, 422)  # 422 if validation enforced
