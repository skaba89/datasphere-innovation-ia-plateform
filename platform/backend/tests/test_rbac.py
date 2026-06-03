"""
RBAC tests — verify role-based access control is enforced correctly.
Tests cover: admin-only routes, viewer can read, unauthenticated gets 401/403.
"""
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_user(client, admin_headers, email: str, role: str):
    """Create a team member and return login headers."""
    # Bootstrap the user (admin creates them)
    resp = client.post("/api/v1/team/invite", headers=admin_headers, json={
        "email": email,
        "password": "Test123456!",
        "first_name": "Test",
        "last_name": "User",
        "role": role,
        "is_active": True,
    })
    assert resp.status_code == 201, f"Failed to create {role}: {resp.json()}"
    
    # Login as this user
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Test123456!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


# ── Unauthenticated access ────────────────────────────────────────────────────

def test_unauthenticated_get_organizations(client):
    """GET /organizations without token returns 401."""
    resp = client.get("/api/v1/organizations")
    assert resp.status_code == 401


def test_unauthenticated_get_tenders(client):
    """GET /tenders without token returns 401."""
    resp = client.get("/api/v1/tenders")
    assert resp.status_code == 401


def test_unauthenticated_get_team(client):
    """GET /team without token returns 401."""
    resp = client.get("/api/v1/team")
    assert resp.status_code == 401


def test_unauthenticated_get_audit_logs(client):
    """GET /audit-logs without token returns 401."""
    resp = client.get("/api/v1/audit-logs")
    assert resp.status_code == 401


def test_unauthenticated_get_roles(client):
    """GET /team/roles without token returns 401 (now protected)."""
    resp = client.get("/api/v1/team/roles")
    assert resp.status_code == 401


def test_public_health_accessible(client):
    """GET /health is public."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200


def test_public_contact_accessible(client):
    """POST /contact is public."""
    resp = client.post("/api/v1/contact", json={
        "firstname": "Test",
        "lastname": "User",
        "email": "test@example.com",
        "need_type": "Autre",
    })
    assert resp.status_code == 200


# ── Admin-only routes ─────────────────────────────────────────────────────────

def test_non_admin_cannot_invite(client, auth_headers):
    """Create a viewer, then verify they cannot invite users."""
    viewer_headers = make_user(client, auth_headers, "viewer_rbac@test.com", "viewer")
    resp = client.post("/api/v1/team/invite", headers=viewer_headers, json={
        "email": "new_user@test.com",
        "password": "Test123456!",
        "first_name": "New",
        "last_name": "User",
        "role": "consultant",
        "is_active": True,
    })
    assert resp.status_code == 403


def test_non_admin_cannot_deactivate(client, auth_headers):
    """Manager cannot deactivate a user."""
    manager_headers = make_user(client, auth_headers, "manager_rbac@test.com", "manager")
    # Try to deactivate the manager themselves (also should fail — non-admin)
    me = client.get("/api/v1/auth/me", headers=manager_headers).json()
    resp = client.post(f"/api/v1/team/{me['id']}/deactivate", headers=manager_headers)
    assert resp.status_code == 403


def test_admin_can_invite(client, auth_headers):
    """Admin can invite users."""
    resp = client.post("/api/v1/team/invite", headers=auth_headers, json={
        "email": "invited_by_admin@test.com",
        "password": "Test123456!",
        "first_name": "Invited",
        "last_name": "User",
        "role": "consultant",
        "is_active": True,
    })
    assert resp.status_code == 201


def test_admin_cannot_demote_last_admin(client, auth_headers):
    """Admin cannot demote themselves if they're the last admin."""
    me = client.get("/api/v1/auth/me", headers=auth_headers).json()
    resp = client.patch(f"/api/v1/team/{me['id']}", headers=auth_headers, json={"role": "viewer"})
    assert resp.status_code == 400


# ── Authenticated read access ─────────────────────────────────────────────────

def test_viewer_can_read_organizations(client, auth_headers):
    """All authenticated users can read organizations."""
    viewer_headers = make_user(client, auth_headers, "viewer_read@test.com", "viewer")
    resp = client.get("/api/v1/organizations", headers=viewer_headers)
    assert resp.status_code == 200


def test_viewer_can_read_tenders(client, auth_headers):
    """All authenticated users can read tenders."""
    viewer_headers = make_user(client, auth_headers, "viewer_tender@test.com", "viewer")
    resp = client.get("/api/v1/tenders", headers=viewer_headers)
    assert resp.status_code == 200


def test_viewer_can_read_roles(client, auth_headers):
    """Authenticated users can read available roles."""
    viewer_headers = make_user(client, auth_headers, "viewer_roles@test.com", "viewer")
    resp = client.get("/api/v1/team/roles", headers=viewer_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "roles" in data
    role_keys = [r["key"] for r in data["roles"]]
    assert "admin" in role_keys
    assert "viewer" in role_keys
