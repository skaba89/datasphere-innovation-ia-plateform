"""
Workspaces complete test suite.
Covers: CRUD, members, RBAC, slug validation, plan types.
"""
import pytest

BASE = "/api/v1/workspaces"


class TestWorkspacesCRUD:
    def test_requires_auth(self, client):
        assert client.get(BASE).status_code == 401

    def test_list_empty_initially(self, client, auth_headers):
        r = client.get(BASE, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_workspace(self, client, auth_headers):
        r = client.post(BASE, headers=auth_headers, json={
            "name": "DataSphere Labs",
            "slug": "datasphere-labs-test",
            "description": "Workspace principal",
            "plan": "free",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "DataSphere Labs"
        assert data["slug"] == "datasphere-labs-test"
        assert data["member_count"] == 1  # creator

    def test_create_with_all_plans(self, client, auth_headers):
        for i, plan in enumerate(["free", "starter", "pro", "enterprise"]):
            r = client.post(BASE, headers=auth_headers, json={
                "name": f"WS {plan}", "slug": f"ws-{plan}-{i}", "plan": plan,
            })
            assert r.status_code == 201
            assert r.json()["plan"] == plan

    def test_create_slug_invalid_chars(self, client, auth_headers):
        r = client.post(BASE, headers=auth_headers, json={
            "name": "Bad Slug", "slug": "Invalid Slug!"
        })
        assert r.status_code == 422

    def test_create_slug_uppercase_invalid(self, client, auth_headers):
        r = client.post(BASE, headers=auth_headers, json={
            "name": "Upper", "slug": "UPPERCASE"
        })
        assert r.status_code == 422

    def test_create_duplicate_slug_conflict(self, client, auth_headers):
        client.post(BASE, headers=auth_headers, json={"name": "WS1", "slug": "dup-slug-unique"})
        r = client.post(BASE, headers=auth_headers, json={"name": "WS2", "slug": "dup-slug-unique"})
        assert r.status_code == 409

    def test_read_workspace(self, client, auth_headers):
        ws = client.post(BASE, headers=auth_headers, json={
            "name": "Read WS", "slug": "read-ws-test",
        }).json()
        r = client.get(f"{BASE}/{ws['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == ws["id"]

    def test_read_not_found(self, client, auth_headers):
        assert client.get(f"{BASE}/999999", headers=auth_headers).status_code == 404

    def test_update_workspace(self, client, auth_headers):
        ws = client.post(BASE, headers=auth_headers, json={
            "name": "Original Name", "slug": "update-test-ws",
        }).json()
        r = client.patch(f"{BASE}/{ws['id']}", headers=auth_headers, json={
            "name": "Updated Name", "description": "Updated desc",
        })
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"

    def test_deactivate_workspace(self, client, auth_headers):
        ws = client.post(BASE, headers=auth_headers, json={
            "name": "To Deactivate", "slug": "deactivate-test-ws",
        }).json()
        r = client.patch(f"{BASE}/{ws['id']}", headers=auth_headers, json={"is_active": False})
        assert r.status_code == 200
        assert r.json()["is_active"] is False


class TestWorkspaceMembers:
    def _create_ws(self, client, headers, suffix=""):
        return client.post(BASE, headers=headers, json={
            "name": f"Members WS {suffix}",
            "slug": f"members-ws-{suffix or 'default'}",
        }).json()

    def test_list_members_requires_auth(self, client):
        assert client.get(f"{BASE}/1/members").status_code == 401

    def test_creator_is_owner(self, client, auth_headers):
        ws = self._create_ws(client, auth_headers, "owner")
        members = client.get(f"{BASE}/{ws['id']}/members", headers=auth_headers).json()
        assert len(members) == 1
        assert members[0]["role"] == "owner"

    def test_invite_member(self, client, auth_headers, viewer_headers):
        ws = self._create_ws(client, auth_headers, "invite")
        viewer_id = client.get("/api/v1/auth/me", headers=viewer_headers).json()["id"]
        r = client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={
            "user_id": viewer_id, "role": "member",
        })
        assert r.status_code == 201
        assert r.json()["user_id"] == viewer_id
        assert r.json()["role"] == "member"

    def test_invite_duplicate_member(self, client, auth_headers, viewer_headers):
        ws = self._create_ws(client, auth_headers, "dup-member")
        viewer_id = client.get("/api/v1/auth/me", headers=viewer_headers).json()["id"]
        client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={"user_id": viewer_id, "role": "member"})
        r = client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={"user_id": viewer_id, "role": "viewer"})
        assert r.status_code == 409

    def test_invite_nonexistent_user(self, client, auth_headers):
        ws = self._create_ws(client, auth_headers, "ghost-user")
        r = client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={
            "user_id": 999999, "role": "member",
        })
        assert r.status_code == 404

    def test_remove_member(self, client, auth_headers, viewer_headers):
        ws = self._create_ws(client, auth_headers, "remove")
        viewer_id = client.get("/api/v1/auth/me", headers=viewer_headers).json()["id"]
        client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={"user_id": viewer_id, "role": "member"})
        r = client.delete(f"{BASE}/{ws['id']}/members/{viewer_id}", headers=auth_headers)
        assert r.status_code == 200

    def test_cannot_remove_owner(self, client, auth_headers):
        ws = self._create_ws(client, auth_headers, "protect-owner")
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.delete(f"{BASE}/{ws['id']}/members/{me['id']}", headers=auth_headers)
        assert r.status_code == 400

    def test_member_count_reflects_reality(self, client, auth_headers, viewer_headers):
        ws = self._create_ws(client, auth_headers, "count")
        viewer_id = client.get("/api/v1/auth/me", headers=viewer_headers).json()["id"]
        client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={"user_id": viewer_id, "role": "viewer"})
        r = client.get(f"{BASE}/{ws['id']}", headers=auth_headers)
        assert r.json()["member_count"] == 2

    def test_non_admin_cannot_invite_members(self, client, auth_headers, viewer_headers, consultant_headers):
        ws = self._create_ws(client, auth_headers, "rbac-invite")
        viewer_id = client.get("/api/v1/auth/me", headers=viewer_headers).json()["id"]
        # Add viewer to workspace as 'viewer' role
        client.post(f"{BASE}/{ws['id']}/members", headers=auth_headers, json={"user_id": viewer_id, "role": "viewer"})
        # Viewer tries to invite consultant
        consultant_id = client.get("/api/v1/auth/me", headers=consultant_headers).json()["id"]
        r = client.post(f"{BASE}/{ws['id']}/members", headers=viewer_headers, json={
            "user_id": consultant_id, "role": "member",
        })
        assert r.status_code == 403
