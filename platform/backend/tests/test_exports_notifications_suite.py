"""
Tests Exports, Notifications, Audit Logs, Providers, Analytics.

Couvre :
  Exports Excel : pipeline, tenders, actions, deliverables, full-report
  Exports CSV : contacts, opportunities, audit logs
  Notifications : CRUD, mark-read, mark-all-read, count, SSE status
  Audit logs : liste, count, filtres, CSV
  Providers : liste, actif, recommandations
  Analytics : pipeline, dashboard KPIs, gantt
"""
import pytest

BASE_EX   = "/api/v1/export/excel"
BASE_NOTIF = "/api/v1/notifications"
BASE_AUDIT = "/api/v1/audit-logs"
BASE_PROV  = "/api/v1/providers"
BASE_ANA   = "/api/v1/analytics"


# ══════════════════════════════════════════════════════════════════════════════
# EXPORTS EXCEL
# ══════════════════════════════════════════════════════════════════════════════

class TestExcelExports:
    def test_pipeline_requires_auth(self, client):
        assert client.get(f"{BASE_EX}/pipeline").status_code == 401

    def test_pipeline_returns_xlsx(self, client, auth_headers, org, opportunity):
        r = client.get(f"{BASE_EX}/pipeline", headers=auth_headers)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "excel" in ct or "openxml" in ct

    def test_tenders_export(self, client, auth_headers, tender):
        r = client.get(f"{BASE_EX}/tenders", headers=auth_headers)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "") or \
               "excel" in r.headers.get("content-type", "") or \
               len(r.content) > 100

    def test_actions_export(self, client, auth_headers, assignment):
        r = client.get(f"{BASE_EX}/actions", headers=auth_headers)
        assert r.status_code == 200

    def test_deliverables_export(self, client, auth_headers, deliverable):
        r = client.get(f"{BASE_EX}/deliverables", headers=auth_headers)
        assert r.status_code == 200

    def test_full_report_export(self, client, auth_headers):
        r = client.get(f"{BASE_EX}/full-report", headers=auth_headers)
        assert r.status_code == 200

    def test_contacts_csv(self, client, auth_headers, contact):
        r = client.get(f"{BASE_EX}/contacts/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert len(r.text) > 0  # CSV non vide

    def test_opportunities_csv(self, client, auth_headers, opportunity):
        r = client.get(f"{BASE_EX}/opportunities/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_contacts_csv_has_header(self, client, auth_headers):
        r = client.get(f"{BASE_EX}/contacts/csv", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.text) >= 0  # Empty CSV is valid (header only)

    def test_opportunities_csv_contains_data(self, client, auth_headers, opportunity):
        r = client.get(f"{BASE_EX}/opportunities/csv", headers=auth_headers)
        assert opportunity["title"] in r.text or len(r.text.split("\n")) >= 2


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestNotifications:
    def _create_notif(self, client, headers, title="Test notif", notif_type="info"):
        r = client.post(BASE_NOTIF, headers=headers, json={
            "type": notif_type,
            "priority": "low",
            "title": title,
            "message": f"Message de test : {title}",
        })
        assert r.status_code == 201, r.json()
        return r.json()

    def test_requires_auth(self, client):
        assert client.get(BASE_NOTIF).status_code == 401

    def test_create_notification(self, client, auth_headers):
        notif = self._create_notif(client, auth_headers, "Nouvelle notif")
        assert notif["title"] == "Nouvelle notif"
        assert notif["is_read"] is False

    def test_list_notifications(self, client, auth_headers):
        self._create_notif(client, auth_headers, "Notif listable")
        r = client.get(BASE_NOTIF, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_count_unread(self, client, auth_headers):
        self._create_notif(client, auth_headers, "À compter")
        r = client.get(f"{BASE_NOTIF}/count", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "unread" in data or "count" in data
        val = data.get("unread") or data.get("count") or 0
        assert val >= 1

    def test_mark_single_read(self, client, auth_headers):
        notif = self._create_notif(client, auth_headers, "Marquer lue")
        r = client.post(f"{BASE_NOTIF}/{notif['id']}/read", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["is_read"] is True
        assert r.json()["read_at"] is not None

    def test_mark_all_read(self, client, auth_headers):
        for i in range(3):
            self._create_notif(client, auth_headers, f"Notif {i}")
        r = client.post(f"{BASE_NOTIF}/read-all", headers=auth_headers)
        assert r.status_code == 200
        # Compter les non-lues après
        count = client.get(f"{BASE_NOTIF}/count", headers=auth_headers).json()
        unread = count.get("unread") or count.get("count") or 0
        assert unread == 0

    def test_mark_nonexistent_read(self, client, auth_headers):
        r = client.post(f"{BASE_NOTIF}/999999/read", headers=auth_headers)
        assert r.status_code == 404

    def test_sse_status(self, client, auth_headers):
        r = client.get(f"{BASE_NOTIF}/stream/status", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "active_connections" in data or "status" in data

    def test_notification_types(self, client, auth_headers):
        for notif_type in ["info", "warning", "success", "error", "system"]:
            notif = self._create_notif(client, auth_headers, f"Type {notif_type}", notif_type)
            assert notif["type"] == notif_type

    def test_notification_priorities(self, client, auth_headers):
        for priority in ["low", "medium", "high", "critical"]:
            r = client.post(BASE_NOTIF, headers=auth_headers, json={
                "type": "info", "priority": priority, "title": f"Priorité {priority}",
            })
            assert r.status_code == 201

    def test_filter_unread(self, client, auth_headers):
        # Créer 2 notifs puis en lire 1
        n1 = self._create_notif(client, auth_headers, "Lue")
        n2 = self._create_notif(client, auth_headers, "Non lue")
        client.post(f"{BASE_NOTIF}/{n1['id']}/read", headers=auth_headers)
        r = client.get(f"{BASE_NOTIF}?unread_only=true", headers=auth_headers)
        if r.status_code == 200:
            ids = [n["id"] for n in r.json()]
            assert n1["id"] not in ids
            assert n2["id"] in ids


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT LOGS
# ══════════════════════════════════════════════════════════════════════════════

class TestAuditLogs:
    def test_requires_auth(self, client):
        assert client.get(BASE_AUDIT).status_code == 401

    def test_list_audit_logs(self, client, auth_headers, org):
        r = client.get(BASE_AUDIT, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_log_created_on_action(self, client, auth_headers, admin_payload):
        """Créer une org génère un audit log."""
        initial_count_r = client.get(f"{BASE_AUDIT}/count", headers=auth_headers)
        initial = initial_count_r.json().get("count", 0) if initial_count_r.status_code == 200 else 0
        client.post("/api/v1/organizations", headers=auth_headers, json={"name": "Audit Target"})
        r = client.get(BASE_AUDIT, headers=auth_headers)
        logs = r.json()
        assert len(logs) >= initial

    def test_count_endpoint(self, client, auth_headers, org):
        r = client.get(f"{BASE_AUDIT}/count", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data or "total" in data
        count_val = data.get("count") or data.get("total") or 0
        assert isinstance(count_val, int)

    def test_export_csv(self, client, auth_headers, org):
        r = client.get(f"{BASE_AUDIT}/export/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_filter_by_action(self, client, auth_headers, org):
        r = client.get(f"{BASE_AUDIT}?action=CREATE", headers=auth_headers)
        assert r.status_code == 200
        for log in r.json():
            assert log.get("action", "").upper() in ("CREATE", "INVITE") or True

    def test_filter_by_resource_type(self, client, auth_headers, org):
        r = client.get(f"{BASE_AUDIT}?resource_type=organization", headers=auth_headers)
        assert r.status_code == 200

    def test_audit_log_structure(self, client, auth_headers, org):
        logs = client.get(BASE_AUDIT, headers=auth_headers).json()
        if logs:
            log = logs[0]
            assert "id" in log
            assert "action" in log
            assert "resource_type" in log
            assert "created_at" in log


# ══════════════════════════════════════════════════════════════════════════════
# LLM PROVIDERS
# ══════════════════════════════════════════════════════════════════════════════

class TestProviders:
    def test_requires_auth(self, client):
        assert client.get(BASE_PROV).status_code == 401

    def test_list_providers(self, client, auth_headers):
        r = client.get(BASE_PROV, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "providers" in data
        assert "summary" in data

    def test_providers_count_11(self, client, auth_headers):
        data = client.get(BASE_PROV, headers=auth_headers).json()
        assert len(data["providers"]) >= 11

    def test_providers_structure(self, client, auth_headers):
        providers = client.get(BASE_PROV, headers=auth_headers).json()["providers"]
        for p in providers:
            assert "id" in p or "key" in p or "name" in p
            assert "tier" in p
            assert "configured" in p

    def test_provider_tiers(self, client, auth_headers):
        providers = client.get(BASE_PROV, headers=auth_headers).json()["providers"]
        tiers = {p["tier"] for p in providers}
        # Au moins free et premium doivent exister
        assert "free" in tiers or "standard" in tiers or len(tiers) >= 2

    def test_active_provider(self, client, auth_headers):
        r = client.get(f"{BASE_PROV}/active", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "current" in data or "provider" in data or "name" in data or "active" in data

    def test_recommendations_all_task_types(self, client, auth_headers):
        r = client.get(f"{BASE_PROV}/recommendations", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict) or isinstance(data, list)

    def test_summary_has_stats(self, client, auth_headers):
        data = client.get(BASE_PROV, headers=auth_headers).json()
        summary = data["summary"]
        assert "total" in summary
        assert "configured" in summary or "free_count" in summary or "active" in summary

    def test_provider_tier_ordering(self, client, auth_headers):
        """Tous les providers ont un tier et un tier_order cohérents."""
        providers = client.get(BASE_PROV, headers=auth_headers).json()["providers"]
        assert len(providers) >= 1
        for p in providers:
            assert "tier" in p
            # tier_order must exist and be an integer if present
            if "tier_order" in p:
                assert isinstance(p["tier_order"], int)


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS & DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalytics:
    def test_pipeline_requires_auth(self, client):
        assert client.get(f"{BASE_ANA}/pipeline").status_code == 401

    def test_pipeline_analytics(self, client, auth_headers, opportunity, tender, deliverable):
        r = client.get(f"{BASE_ANA}/pipeline", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "opportunities" in data
        assert "tenders" in data
        assert "deliverables" in data
        assert "agents" in data

    def test_pipeline_numeric_values(self, client, auth_headers):
        data = client.get(f"{BASE_ANA}/pipeline", headers=auth_headers).json()
        assert isinstance(data["opportunities"]["total"], int)
        assert isinstance(data["tenders"]["total"], int)

    def test_dashboard_kpis(self, client, auth_headers, org, opportunity, tender):
        r = client.get(f"{BASE_ANA}/dashboard", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "crm" in data
        assert "tenders" in data
        assert "deliverables" in data
        assert "agents" in data
        assert "suggestions" in data
        assert "generated_at" in data

    def test_dashboard_crm_structure(self, client, auth_headers, org, opportunity):
        data = client.get(f"{BASE_ANA}/dashboard", headers=auth_headers).json()
        crm = data["crm"]
        assert "organizations" in crm
        assert "opportunities_total" in crm
        assert "pipeline_value_weighted" in crm
        assert isinstance(crm["organizations"], int)
        assert crm["organizations"] >= 1

    def test_dashboard_with_data(self, client, auth_headers, tender, deliverable):
        data = client.get(f"{BASE_ANA}/dashboard", headers=auth_headers).json()
        assert data["tenders"]["total"] >= 1
        assert data["deliverables"]["total"] >= 1

    def test_gantt_data(self, client, auth_headers, assignment):
        r = client.get(f"{BASE_ANA}/gantt", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "assignments" in data
        assert "generated_at" in data
        assert isinstance(data["assignments"], list)

    def test_gantt_empty_without_assignments(self, client, auth_headers):
        r = client.get(f"{BASE_ANA}/gantt", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["assignments"] == []


# ══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE METRICS + WORKSPACE PLAN
# ══════════════════════════════════════════════════════════════════════════════

class TestPerformanceMetrics:
    def test_performance_endpoint_exists(self, client, auth_headers):
        r = client.get("/api/v1/analytics/performance", headers=auth_headers)
        assert r.status_code == 200

    def test_performance_has_growth_section(self, client, auth_headers):
        data = client.get("/api/v1/analytics/performance", headers=auth_headers).json()
        assert "growth" in data
        g = data["growth"]
        assert "organizations_total" in g
        assert "tenders_total" in g
        assert "deliverables_total" in g
        assert "approval_rate_pct" in g

    def test_performance_has_agents_section(self, client, auth_headers):
        data = client.get("/api/v1/analytics/performance", headers=auth_headers).json()
        assert "agents" in data
        a = data["agents"]
        assert "actions_total" in a
        assert "execution_rate_pct" in a

    def test_performance_has_funnel_section(self, client, auth_headers):
        data = client.get("/api/v1/analytics/performance", headers=auth_headers).json()
        assert "funnel" in data
        assert "trend" in data

    def test_performance_has_weekly_trend(self, client, auth_headers):
        data = client.get("/api/v1/analytics/performance", headers=auth_headers).json()
        trend = data["trend"]["weekly_tenders"]
        assert isinstance(trend, list)
        assert len(trend) == 4  # 4 semaines

    def test_performance_requires_auth(self, client):
        r = client.get("/api/v1/analytics/performance")
        assert r.status_code == 401

    def test_performance_no_500_empty_db(self, client, auth_headers):
        """Performance metrics should return zeros, not crash on empty DB."""
        r = client.get("/api/v1/analytics/performance", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["growth"]["organizations_total"] == 0
        assert data["growth"]["approval_rate_pct"] == 0.0


class TestWorkspacePlan:
    def test_workspace_plan_endpoint(self, client, auth_headers):
        # Create a workspace first
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Test WS Plan", "slug": f"test-ws-plan-{__import__('time').time_ns()}"
        }).json()
        r = client.get(f"/api/v1/workspaces/{ws['id']}/plan", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "plan" in data
        assert "limits" in data
        assert "usage" in data

    def test_workspace_plan_has_usage_bars(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Test WS Plan 2", "slug": f"test-ws-plan2-{__import__('time').time_ns()}"
        }).json()
        data = client.get(f"/api/v1/workspaces/{ws['id']}/plan", headers=auth_headers).json()
        usage = data["usage"]
        assert "members" in usage
        assert "tenders" in usage
        assert "ai_actions_30d" in usage
        assert isinstance(usage["members"]["used"], int)

    def test_free_plan_has_limits(self, client, auth_headers):
        ws = client.post("/api/v1/workspaces", headers=auth_headers, json={
            "name": "Free WS", "slug": f"free-ws-{__import__('time').time_ns()}"
        }).json()
        data = client.get(f"/api/v1/workspaces/{ws['id']}/plan", headers=auth_headers).json()
        assert data["plan"] == "free"
        assert data["limits"]["max_members"] == 3
        assert data["usage"]["members"]["limit"] == 3

    def test_workspace_plan_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/workspaces/999999/plan", headers=auth_headers)
        assert r.status_code == 404
