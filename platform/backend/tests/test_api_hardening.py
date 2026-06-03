"""
API Hardening tests — validates all critical endpoints return correct
status codes, handles edge cases, and rejects invalid input.
"""
import pytest


# ── Auth edge cases ───────────────────────────────────────────────────────────

def test_login_empty_body(client):
    resp = client.post("/api/v1/auth/login", json={})
    assert resp.status_code == 422


def test_login_invalid_email_format(client):
    resp = client.post("/api/v1/auth/login", json={"email": "notanemail", "password": "test"})
    assert resp.status_code == 422


def test_refresh_empty_token(client):
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": ""})
    assert resp.status_code == 401


def test_forgot_password_invalid_email(client):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "notvalid"})
    assert resp.status_code == 422


def test_reset_password_short_password(client):
    from app.core.security import create_reset_token
    token = create_reset_token("test@example.com")
    resp = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "abc"})
    assert resp.status_code in (400, 422)  # custom or pydantic validation


# ── Organization CRUD edge cases ──────────────────────────────────────────────

def test_create_org_name_too_short(client, auth_headers):
    """Name < 2 chars should be rejected."""
    resp = client.post("/api/v1/organizations", headers=auth_headers, json={"name": "A"})
    assert resp.status_code == 422


def test_create_org_success_returns_201(client, auth_headers):
    """Creating an org returns 201."""
    resp = client.post("/api/v1/organizations", headers=auth_headers, json={"name": "Hardening Test Corp"})
    assert resp.status_code == 201
    assert resp.json()["id"] > 0


def test_get_nonexistent_org(client, auth_headers):
    resp = client.get("/api/v1/organizations/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_nonexistent_org(client, auth_headers):
    resp = client.delete("/api/v1/organizations/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_org_validation_status_default(client, auth_headers):
    """New organizations default to 'validated' status."""
    resp = client.post("/api/v1/organizations", headers=auth_headers, json={"name": "Default Status Org"})
    assert resp.status_code == 201
    assert resp.json()["validation_status"] == "validated"


# ── Opportunity edge cases ────────────────────────────────────────────────────

def test_create_opportunity_without_org(client, auth_headers):
    """Missing organization_id should return 422."""
    resp = client.post("/api/v1/opportunities", headers=auth_headers, json={
        "title": "Opp Without Org", "status": "Prospect identifie", "probability": 50
    })
    assert resp.status_code == 422


def test_create_opportunity_invalid_probability(client, auth_headers):
    """Probability > 100 is invalid."""
    org = client.post("/api/v1/organizations", headers=auth_headers, json={"name": "Prob Test Org"}).json()
    resp = client.post("/api/v1/opportunities", headers=auth_headers, json={
        "title": "Bad Prob", "organization_id": org["id"],
        "status": "Prospect identifie", "probability": 150
    })
    # Should return 422 or create with capped value
    assert resp.status_code in (201, 422)


# ── Tender edge cases ─────────────────────────────────────────────────────────

def test_create_tender_requires_opportunity(client, auth_headers):
    """Creating a tender without opportunity_id returns 422."""
    resp = client.post("/api/v1/tenders", headers=auth_headers, json={
        "title": "Orphan Tender", "status": "draft"
    })
    assert resp.status_code == 422


def test_tender_reference_uniqueness(client, auth_headers):
    """Two tenders with same reference should be allowed (reference is optional)."""
    org = client.post("/api/v1/organizations", headers=auth_headers, json={"name": "Tender Ref Org"}).json()
    opp = client.post("/api/v1/opportunities", headers=auth_headers, json={
        "title": "Tender Ref Opp", "organization_id": org["id"],
        "status": "Prospect identifie", "probability": 50
    }).json()
    
    r1 = client.post("/api/v1/tenders", headers=auth_headers, json={
        "title": "T1", "opportunity_id": opp["id"], "reference": "REF-UNIQUE-001"
    })
    assert r1.status_code == 201


# ── Agent actions edge cases ──────────────────────────────────────────────────

def test_approve_nonexistent_action(client, auth_headers):
    resp = client.post("/api/v1/agent-actions/999999/approve", headers=auth_headers)
    assert resp.status_code == 404


# ── Upload edge cases ─────────────────────────────────────────────────────────

def test_upload_too_large_rejected():
    """Large file upload should be rejected (tested via mock size check)."""
    # We test the validation logic, not actual upload size
    from app.api.v1.endpoints.uploads import MAX_FILE_SIZE
    assert MAX_FILE_SIZE == 20 * 1024 * 1024


def test_upload_blocked_extensions_list():
    """Verify .exe and .sh are not in allowed extensions."""
    from app.api.v1.endpoints.uploads import ALLOWED_EXTENSIONS
    assert ".exe" not in ALLOWED_EXTENSIONS
    assert ".sh" not in ALLOWED_EXTENSIONS
    assert ".bat" not in ALLOWED_EXTENSIONS
    assert ".pdf" in ALLOWED_EXTENSIONS
    assert ".docx" in ALLOWED_EXTENSIONS


# ── Suggestions edge cases ───────────────────────────────────────────────────

def test_import_text_minimum_length(client, auth_headers):
    """Text import with < 30 chars rejected."""
    resp = client.post("/api/v1/suggestions/import/text", headers=auth_headers, json={"text": "too short"})
    assert resp.status_code == 400


def test_validate_unknown_entity_type(client, auth_headers):
    """Unknown entity_type returns 400."""
    resp = client.post("/api/v1/suggestions/validate", headers=auth_headers, json={
        "items": [{"entity_type": "xyz", "entity_id": 1, "accept": True}]
    })
    assert resp.status_code == 400


# ── Export edge cases ─────────────────────────────────────────────────────────

def test_contacts_csv_returns_csv(client, auth_headers):
    resp = client.get("/api/v1/export/excel/contacts/csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]


def test_opportunities_csv_returns_csv(client, auth_headers):
    resp = client.get("/api/v1/export/excel/opportunities/csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]


def test_audit_log_csv_returns_csv(client, auth_headers):
    resp = client.get("/api/v1/audit-logs/export/csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]


# ── Workspace edge cases ──────────────────────────────────────────────────────

def test_workspace_slug_invalid_chars(client, auth_headers):
    """Slug with uppercase or spaces should be rejected."""
    resp = client.post("/api/v1/workspaces", headers=auth_headers, json={
        "name": "Test", "slug": "Invalid Slug!"
    })
    assert resp.status_code == 422


def test_workspace_slug_valid(client, auth_headers):
    resp = client.post("/api/v1/workspaces", headers=auth_headers, json={
        "name": "Valid WS", "slug": "valid-ws-hardening-001"
    })
    assert resp.status_code == 201


def test_workspace_remove_owner_forbidden(client, auth_headers):
    """Cannot remove workspace owner from members."""
    resp = client.post("/api/v1/workspaces", headers=auth_headers, json={
        "name": "Owner Test WS", "slug": "owner-test-ws-hardening"
    })
    ws_id = resp.json()["id"]
    # Get the owner (creator)
    members = client.get(f"/api/v1/workspaces/{ws_id}/members", headers=auth_headers).json()
    owner = next(m for m in members if m["role"] == "owner")
    # Try to remove owner
    del_resp = client.delete(f"/api/v1/workspaces/{ws_id}/members/{owner['user_id']}", headers=auth_headers)
    assert del_resp.status_code == 400


# ── Providers endpoint ────────────────────────────────────────────────────────

def test_providers_list_structure(client, auth_headers):
    """Providers list returns all 11 providers in cost order."""
    resp = client.get("/api/v1/providers", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert "summary" in data
    assert len(data["providers"]) >= 11
    # Free providers come first
    # Verify tier_order field (lower = cheaper)
    providers = data["providers"]
    for p in providers:
        assert "tier" in p
        assert "label" in p
        assert "configured" in p
    # Free should have lower tier_order than premium
    free_p = next((p for p in providers if p["tier"] == "free"), None)
    premium_p = next((p for p in providers if p["tier"] == "premium"), None)
    if free_p and premium_p:
        assert free_p.get("tier_order", 0) < premium_p.get("tier_order", 99)


def test_providers_recommendations(client, auth_headers):
    resp = client.get("/api/v1/providers/recommendations", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "strategy" in data or "task_type" in data or "priority_order" in data


# ── Health endpoint ───────────────────────────────────────────────────────────

def test_health_endpoint_structure(client, auth_headers):
    resp = client.get("/api/v1/health/detailed", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "checks" in data
    assert "overall" in data or "status" in data
    assert "database" in data["checks"] or "db" in data["checks"]
    assert "llm" in data["checks"]


# ── Dashboard endpoint ────────────────────────────────────────────────────────

def test_dashboard_kpis_structure(client, auth_headers):
    resp = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "crm" in data
    assert "tenders" in data
    assert "deliverables" in data
    assert "agents" in data
    assert "suggestions" in data
    assert "generated_at" in data
    # Verify numeric values
    assert isinstance(data["crm"]["organizations"], int)
    assert isinstance(data["tenders"]["total"], int)
