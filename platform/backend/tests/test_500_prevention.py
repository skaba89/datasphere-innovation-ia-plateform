"""
Tests de prévention 500 — tous les endpoints critiques retournent 4xx, jamais 500.

Principe : un 500 non contrôlé = bug de prod. Ce fichier garantit qu'aucune
requête mal formée ne fait planter le serveur.
"""
import pytest


class TestAuthPrevention:
    """POST /auth/login — cas limites."""

    def test_login_empty_body(self, client):
        r = client.post("/api/v1/auth/login", json={})
        assert r.status_code in (400, 422), r.text

    def test_login_invalid_email(self, client):
        r = client.post("/api/v1/auth/login", json={"email": "not-an-email", "password": "x"})
        assert r.status_code in (400, 422), r.text

    def test_login_wrong_password(self, client):
        r = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong"})
        assert r.status_code in (401, 404), r.text

    def test_login_sql_injection(self, client):
        r = client.post("/api/v1/auth/login", json={"email": "'; DROP TABLE users;--", "password": "x"})
        assert r.status_code in (400, 401, 422), r.text

    def test_refresh_invalid_token(self, client):
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": "garbage.token.here"})
        assert r.status_code in (400, 401, 422), r.text

    def test_protected_no_token(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401, r.text

    def test_protected_malformed_bearer(self, client):
        r = client.get("/api/v1/auth/me", headers={"Authorization": "NotBearer abc123"})
        assert r.status_code in (401, 403), r.text

    def test_change_password_wrong_current(self, client, auth_headers):
        r = client.post("/api/v1/auth/change-password", json={
            "current_password": "WRONG_PASSWORD_XYZ",
            "new_password": "NewPass123!",
        }, headers=auth_headers)
        assert r.status_code == 400, r.text


class TestTendersPrevention:
    """AOs — IDs inexistants et corps invalides."""

    def test_get_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/tenders/999999", headers=auth_headers)
        assert r.status_code == 404, r.text

    def test_create_empty_body(self, client, auth_headers):
        r = client.post("/api/v1/tenders", json={}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_create_no_title(self, client, auth_headers):
        r = client.post("/api/v1/tenders", json={"status": "draft"}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_score_out_of_range(self, client, auth_headers, make_tender):
        t = make_tender()
        r = client.patch(f"/api/v1/tenders/{t['id']}", json={"go_no_go_score": 9999}, headers=auth_headers)
        # Doit soit accepter et clamp, soit retourner 400 — jamais 500
        assert r.status_code in (200, 400, 422), r.text

    def test_delete_nonexistent(self, client, auth_headers):
        r = client.delete("/api/v1/tenders/999999", headers=auth_headers)
        assert r.status_code in (404, 405), r.text

    def test_generate_gonogo_nonexistent(self, client, auth_headers):
        r = client.post("/api/v1/tenders/999999/go-no-go", headers=auth_headers)
        assert r.status_code in (404, 405), r.text


class TestDeliverablesPrevention:
    """Livrables — cas limites."""

    def test_get_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/deliverables/999999", headers=auth_headers)
        assert r.status_code == 404, r.text

    def test_create_empty(self, client, auth_headers):
        r = client.post("/api/v1/deliverables", json={}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_approve_nonexistent(self, client, auth_headers):
        r = client.post("/api/v1/deliverables/999999/approve", headers=auth_headers)
        assert r.status_code in (404, 405), r.text

    def test_generate_content_nonexistent(self, client, auth_headers):
        r = client.post("/api/v1/deliverables/999999/generate", headers=auth_headers)
        assert r.status_code in (404, 405), r.text

    def test_generate_content_approved(self, client, auth_headers, make_deliverable):
        """Un livrable approuvé ne doit pas être regénéré → 400."""
        d = make_deliverable(status="approved")
        r = client.post(f"/api/v1/deliverables/{d['id']}/generate", headers=auth_headers)
        assert r.status_code in (200, 400), r.text  # 200 si autorisé, 400 sinon


class TestOrganizationsPrevention:
    """Organisations."""

    def test_get_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/organizations/999999", headers=auth_headers)
        assert r.status_code == 404, r.text

    def test_create_empty(self, client, auth_headers):
        r = client.post("/api/v1/organizations", json={}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_create_no_name(self, client, auth_headers):
        r = client.post("/api/v1/organizations", json={"email": "test@test.com"}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text


class TestOpportunitiesPrevention:
    """Opportunités."""

    def test_get_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/opportunities/999999", headers=auth_headers)
        assert r.status_code == 404, r.text

    def test_create_empty(self, client, auth_headers):
        r = client.post("/api/v1/opportunities", json={}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_invalid_status(self, client, auth_headers, make_org):
        org = make_org()
        r = client.post("/api/v1/opportunities", json={
            "title": "Test", "organization_id": org["id"], "status": "NOT_A_REAL_STATUS"
        }, headers=auth_headers)
        # Doit soit accepter (flexible) soit 422 — jamais 500
        assert r.status_code in (200, 201, 400, 422), r.text


class TestInvoicesPrevention:
    """Devis & Factures."""

    def test_get_quote_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/invoices/quotes/999999", headers=auth_headers)
        assert r.status_code == 404, r.text

    def test_get_invoice_nonexistent(self, client, auth_headers):
        r = client.get("/api/v1/invoices/invoices/999999", headers=auth_headers)
        assert r.status_code == 404, r.text

    def test_create_quote_no_title(self, client, auth_headers):
        r = client.post("/api/v1/invoices/quotes", json={"client_name": "X"}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_create_quote_no_client(self, client, auth_headers):
        r = client.post("/api/v1/invoices/quotes", json={"title": "Test"}, headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_invoice_invalid_status(self, client, auth_headers):
        r = client.patch("/api/v1/invoices/invoices/999999/status", json={"status": "FAKE"}, headers=auth_headers)
        assert r.status_code in (400, 404, 422), r.text

    def test_stats_always_returns(self, client, auth_headers):
        r = client.get("/api/v1/invoices/stats", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "quotes_total" in data


class TestLinkedInSchedulePrevention:
    """LinkedIn scheduling."""

    def test_past_date_rejected(self, client, auth_headers):
        r = client.post("/api/v1/linkedin/schedule", json={
            "topic_type": "data_engineering",
            "scheduled_at": "2020-01-01T10:00:00Z",
        }, headers=auth_headers)
        assert r.status_code == 400, r.text

    def test_invalid_date_format(self, client, auth_headers):
        r = client.post("/api/v1/linkedin/schedule", json={
            "topic_type": "data_engineering",
            "scheduled_at": "not-a-date",
        }, headers=auth_headers)
        assert r.status_code == 400, r.text

    def test_cancel_nonexistent(self, client, auth_headers):
        r = client.delete("/api/v1/linkedin/schedule/999999", headers=auth_headers)
        assert r.status_code in (404, 204), r.text

    def test_stats_always_200(self, client, auth_headers):
        r = client.get("/api/v1/linkedin/schedule/stats", headers=auth_headers)
        assert r.status_code == 200, r.text


class TestRAGPrevention:
    """Endpoints RAG."""

    def test_search_too_short(self, client, auth_headers):
        r = client.get("/api/v1/rag/search?q=a", headers=auth_headers)
        assert r.status_code in (400, 422), r.text

    def test_search_valid(self, client, auth_headers):
        r = client.get("/api/v1/rag/search?q=data+engineering", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "deliverables" in data
        assert "tenders" in data

    def test_info_returns(self, client, auth_headers):
        r = client.get("/api/v1/rag/info", headers=auth_headers)
        assert r.status_code == 200, r.text

    def test_index_nonexistent_tender(self, client, auth_headers):
        r = client.post("/api/v1/rag/index-tender/999999", headers=auth_headers)
        # 200 avec indexed=False, ou 404 — jamais 500
        assert r.status_code in (200, 404), r.text


class TestSearchPrevention:
    """Search global."""

    def test_empty_query(self, client, auth_headers):
        r = client.get("/api/v1/search?q=", headers=auth_headers)
        assert r.status_code in (200, 400, 422), r.text

    def test_normal_search(self, client, auth_headers):
        r = client.get("/api/v1/search?q=datasphere", headers=auth_headers)
        assert r.status_code == 200, r.text

    def test_sql_injection_search(self, client, auth_headers):
        r = client.get("/api/v1/search?q=' OR 1=1--", headers=auth_headers)
        assert r.status_code in (200, 400), r.text


class TestWorkflowPrevention:
    """Workflow — état incompatible."""

    def test_get_nonexistent_workflow(self, client, auth_headers):
        r = client.get("/api/v1/workflow/999999", headers=auth_headers)
        assert r.status_code in (404, 405), r.text

    def test_approve_nonexistent_step(self, client, auth_headers):
        r = client.post("/api/v1/workflow/steps/999999/approve", headers=auth_headers)
        assert r.status_code in (404, 405), r.text


class TestHealthAlwaysUp:
    """Le /health ne doit JAMAIS retourner 500."""

    def test_health_200(self, client):
        r = client.get("/api/v1/health")
        assert r.status_code == 200, r.text
        assert r.json().get("status") in ("ok", "degraded")

    def test_health_has_components(self, client):
        data = client.get("/api/v1/health").json()
        assert "components" in data or "version" in data
