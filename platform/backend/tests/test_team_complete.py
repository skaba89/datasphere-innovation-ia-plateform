"""
Team / User management tests.
Covers: list, invite, read, update role, deactivate, change-password (admin),
RBAC enforcement, last-admin protection, duplicate email.
"""
import pytest


class TestTeamList:
    def test_list_requires_auth(self, client):
        assert client.get("/api/v1/team").status_code == 401

    def test_list_returns_users(self, client, auth_headers):
        r = client.get("/api/v1/team", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1  # at least the admin

    def test_list_viewer_can_read(self, client, viewer_headers):
        r = client.get("/api/v1/team", headers=viewer_headers)
        assert r.status_code == 200

    def test_roles_endpoint_requires_auth(self, client):
        assert client.get("/api/v1/team/roles").status_code == 401

    def test_roles_returns_all_roles(self, client, auth_headers):
        r = client.get("/api/v1/team/roles", headers=auth_headers)
        assert r.status_code == 200
        keys = [role["key"] for role in r.json()["roles"]]
        assert set(keys) == {"admin", "manager", "consultant", "viewer"}


class TestTeamInvite:
    def test_invite_requires_auth(self, client):
        assert client.post("/api/v1/team/invite", json={}).status_code == 401

    def test_invite_requires_admin(self, client, viewer_headers):
        r = client.post("/api/v1/team/invite", headers=viewer_headers, json={
            "email": "new@test.com", "password": "Pass123456!", "first_name": "New",
            "last_name": "User", "role": "viewer", "is_active": True,
        })
        assert r.status_code == 403

    def test_consultant_cannot_invite(self, client, consultant_headers):
        r = client.post("/api/v1/team/invite", headers=consultant_headers, json={
            "email": "new@test.com", "password": "Pass123456!", "first_name": "New",
            "last_name": "User", "role": "viewer", "is_active": True,
        })
        assert r.status_code == 403

    def test_admin_can_invite(self, client, auth_headers):
        r = client.post("/api/v1/team/invite", headers=auth_headers, json={
            "email": "new.user@test.com", "password": "Pass123456!",
            "first_name": "New", "last_name": "User", "role": "consultant", "is_active": True,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "new.user@test.com"
        assert data["role"] == "consultant"

    def test_invite_duplicate_email_409(self, client, auth_headers, admin_payload):
        r = client.post("/api/v1/team/invite", headers=auth_headers, json={
            "email": admin_payload["email"], "password": "Pass123456!",
            "first_name": "Dup", "last_name": "User", "role": "viewer", "is_active": True,
        })
        assert r.status_code == 409

    def test_invite_invalid_role_400(self, client, auth_headers):
        r = client.post("/api/v1/team/invite", headers=auth_headers, json={
            "email": "role.test@test.com", "password": "Pass123456!",
            "first_name": "Role", "last_name": "Test", "role": "superuser", "is_active": True,
        })
        assert r.status_code == 400

    def test_invite_missing_email_422(self, client, auth_headers):
        r = client.post("/api/v1/team/invite", headers=auth_headers, json={
            "password": "Pass123456!", "first_name": "No", "last_name": "Email",
            "role": "viewer", "is_active": True,
        })
        assert r.status_code == 422


class TestTeamRead:
    def test_get_member_by_id(self, client, auth_headers, viewer_headers):
        # Get list to find viewer's ID
        members = client.get("/api/v1/team", headers=auth_headers).json()
        viewer = next(m for m in members if m["role"] == "viewer")
        r = client.get(f"/api/v1/team/{viewer['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == viewer["id"]

    def test_get_nonexistent_member_404(self, client, auth_headers):
        r = client.get("/api/v1/team/999999", headers=auth_headers)
        assert r.status_code == 404

    def test_get_member_requires_auth(self, client):
        assert client.get("/api/v1/team/1").status_code == 401


class TestTeamUpdate:
    def test_update_role_requires_admin(self, client, viewer_headers):
        r = client.patch("/api/v1/team/1", headers=viewer_headers, json={"role": "admin"})
        assert r.status_code == 403

    def test_admin_can_update_role(self, client, auth_headers, viewer_headers):
        members = client.get("/api/v1/team", headers=auth_headers).json()
        viewer = next(m for m in members if m["role"] == "viewer")
        r = client.patch(f"/api/v1/team/{viewer['id']}", headers=auth_headers, json={"role": "consultant"})
        assert r.status_code == 200
        assert r.json()["role"] == "consultant"

    def test_cannot_demote_last_admin(self, client, auth_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.patch(f"/api/v1/team/{me['id']}", headers=auth_headers, json={"role": "viewer"})
        assert r.status_code == 400

    def test_cannot_set_invalid_role(self, client, auth_headers, viewer_headers):
        members = client.get("/api/v1/team", headers=auth_headers).json()
        viewer = next(m for m in members if m["role"] == "viewer")
        r = client.patch(f"/api/v1/team/{viewer['id']}", headers=auth_headers, json={"role": "god"})
        assert r.status_code == 400


class TestTeamDeactivate:
    def test_deactivate_requires_admin(self, client, viewer_headers):
        r = client.post("/api/v1/team/999/deactivate", headers=viewer_headers)
        assert r.status_code == 403

    def test_admin_can_deactivate_member(self, client, auth_headers, viewer_headers):
        members = client.get("/api/v1/team", headers=auth_headers).json()
        viewer = next(m for m in members if m["role"] == "viewer")
        r = client.post(f"/api/v1/team/{viewer['id']}/deactivate", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_cannot_deactivate_self(self, client, auth_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.post(f"/api/v1/team/{me['id']}/deactivate", headers=auth_headers)
        assert r.status_code == 400

    def test_deactivate_nonexistent_404(self, client, auth_headers):
        r = client.post("/api/v1/team/999999/deactivate", headers=auth_headers)
        assert r.status_code == 404

    def test_deactivated_user_cannot_login(self, client, auth_headers, viewer_headers):
        members = client.get("/api/v1/team", headers=auth_headers).json()
        viewer = next(m for m in members if m["role"] == "viewer")
        client.post(f"/api/v1/team/{viewer['id']}/deactivate", headers=auth_headers)
        login = client.post("/api/v1/auth/login", json={"email": "viewer@test.com", "password": "Viewer123456!"})
        assert login.status_code == 401


class TestAdminChangePassword:
    def test_admin_change_other_password(self, client, auth_headers, viewer_headers):
        members = client.get("/api/v1/team", headers=auth_headers).json()
        viewer = next(m for m in members if m["role"] == "viewer")
        r = client.post(f"/api/v1/team/{viewer['id']}/change-password", headers=auth_headers, json={
            "new_password": "NewViewer999!",
        })
        assert r.status_code == 200

    def test_non_admin_cannot_change_others_password(self, client, auth_headers, viewer_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.post(f"/api/v1/team/{me['id']}/change-password", headers=viewer_headers, json={
            "new_password": "HackPass999!",
        })
        assert r.status_code == 403
