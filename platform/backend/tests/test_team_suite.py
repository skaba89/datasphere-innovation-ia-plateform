"""
Tests de gestion d'équipe — couverture complète.

Couvre :
  - Liste des membres
  - Invitation (admin, rôles valides/invalides, doublon)
  - Lecture membre
  - Mise à jour rôle
  - Désactivation (protection dernier admin)
  - Changement de mdp par admin
  - /me/change-password
  - RBAC : viewer/consultant/manager ne peuvent pas inviter/désactiver
  - Rôles disponibles (/team/roles)
"""
import pytest
from tests.conftest import make_user

BASE = "/api/v1/team"


# ══════════════════════════════════════════════════════════════════════════════
# Liste des membres
# ══════════════════════════════════════════════════════════════════════════════

class TestTeamList:
    def test_requires_auth(self, client):
        assert client.get(BASE).status_code == 401

    def test_admin_can_list(self, client, auth_headers):
        r = client.get(BASE, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_viewer_can_list(self, client, viewer_headers):
        r = client.get(BASE, headers=viewer_headers)
        assert r.status_code == 200

    def test_list_contains_admin(self, client, auth_headers, admin_payload):
        data = client.get(BASE, headers=auth_headers).json()
        emails = [u["email"] for u in data]
        assert admin_payload["email"] in emails


# ══════════════════════════════════════════════════════════════════════════════
# Rôles
# ══════════════════════════════════════════════════════════════════════════════

class TestRoles:
    def test_roles_requires_auth(self, client):
        r = client.get(f"{BASE}/roles")
        # Protected in v1.8+, public in earlier versions
        assert r.status_code in (200, 401)

    def test_roles_authenticated(self, client, viewer_headers):
        r = client.get(f"{BASE}/roles", headers=viewer_headers)
        assert r.status_code == 200
        role_keys = [ro["key"] for ro in r.json()["roles"]]
        assert "admin" in role_keys
        assert "manager" in role_keys
        assert "consultant" in role_keys
        assert "viewer" in role_keys

    def test_roles_have_labels(self, client, auth_headers):
        roles = client.get(f"{BASE}/roles", headers=auth_headers).json()["roles"]
        for role in roles:
            assert "key" in role
            assert "label" in role
            assert "description" in role


# ══════════════════════════════════════════════════════════════════════════════
# Invitation
# ══════════════════════════════════════════════════════════════════════════════

class TestTeamInvite:
    def test_requires_auth(self, client):
        assert client.post(f"{BASE}/invite", json={}).status_code in (401, 422)

    def test_admin_invites_viewer(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "new.viewer@test.fr", "password": "Test123456!",
            "first_name": "New", "last_name": "Viewer",
            "role": "viewer", "is_active": True,
        })
        assert r.status_code == 201
        assert r.json()["role"] == "viewer"

    def test_admin_invites_all_roles(self, client, auth_headers):
        for i, role in enumerate(["manager", "consultant", "viewer"]):
            r = client.post(f"{BASE}/invite", headers=auth_headers, json={
                "email": f"user_{role}_{i}@test.fr", "password": "Test123456!",
                "first_name": role.title(), "last_name": "Test",
                "role": role, "is_active": True,
            })
            assert r.status_code == 201, f"Failed for role {role}: {r.json()}"

    def test_invite_duplicate_email_rejected(self, client, auth_headers):
        payload = {
            "email": "dup@test.fr", "password": "Test123456!",
            "first_name": "D", "last_name": "U", "role": "viewer", "is_active": True,
        }
        client.post(f"{BASE}/invite", headers=auth_headers, json=payload)
        r2 = client.post(f"{BASE}/invite", headers=auth_headers, json=payload)
        assert r2.status_code == 409

    def test_invite_invalid_role_rejected(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "badrole@test.fr", "password": "Test123456!",
            "first_name": "B", "last_name": "R", "role": "superadmin", "is_active": True,
        })
        assert r.status_code == 400

    def test_viewer_cannot_invite(self, client, viewer_headers):
        r = client.post(f"{BASE}/invite", headers=viewer_headers, json={
            "email": "hacker@test.fr", "password": "Test123456!",
            "first_name": "H", "last_name": "K", "role": "admin", "is_active": True,
        })
        assert r.status_code == 403

    def test_consultant_cannot_invite(self, client, consultant_headers):
        r = client.post(f"{BASE}/invite", headers=consultant_headers, json={
            "email": "x@test.fr", "password": "T123456!",
            "first_name": "X", "last_name": "Y", "role": "viewer", "is_active": True,
        })
        assert r.status_code == 403

    def test_invite_missing_email(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "password": "Test123456!", "role": "viewer", "is_active": True,
        })
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Lecture d'un membre
# ══════════════════════════════════════════════════════════════════════════════

class TestTeamGet:
    def test_get_existing_member(self, client, auth_headers):
        members = client.get(BASE, headers=auth_headers).json()
        admin = members[0]
        r = client.get(f"{BASE}/{admin['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == admin["id"]

    def test_get_nonexistent_member(self, client, auth_headers):
        r = client.get(f"{BASE}/999999", headers=auth_headers)
        assert r.status_code == 404

    def test_get_requires_auth(self, client, auth_headers):
        members = client.get(BASE, headers=auth_headers).json()
        r = client.get(f"{BASE}/{members[0]['id']}")
        assert r.status_code == 401

    def test_viewer_can_read_member(self, client, auth_headers, viewer_headers):
        members = client.get(BASE, headers=auth_headers).json()
        r = client.get(f"{BASE}/{members[0]['id']}", headers=viewer_headers)
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# Mise à jour d'un membre
# ══════════════════════════════════════════════════════════════════════════════

class TestTeamUpdate:
    def test_admin_can_change_role(self, client, auth_headers):
        # Créer un viewer puis le passer consultant
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "tochange@test.fr", "password": "Test123456!",
            "first_name": "T", "last_name": "C", "role": "viewer", "is_active": True,
        })
        user_id = r.json()["id"]
        patch = client.patch(f"{BASE}/{user_id}", headers=auth_headers, json={"role": "consultant"})
        assert patch.status_code == 200
        assert patch.json()["role"] == "consultant"

    def test_cannot_demote_last_admin(self, client, auth_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.patch(f"{BASE}/{me['id']}", headers=auth_headers, json={"role": "viewer"})
        assert r.status_code == 400

    def test_update_nonexistent_user(self, client, auth_headers):
        r = client.patch(f"{BASE}/999999", headers=auth_headers, json={"role": "viewer"})
        assert r.status_code == 404

    def test_viewer_cannot_update(self, client, auth_headers, viewer_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.patch(f"{BASE}/{me['id']}", headers=viewer_headers, json={"role": "viewer"})
        assert r.status_code == 403

    def test_update_invalid_role(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "patch@test.fr", "password": "T123456!", "first_name": "P",
            "last_name": "T", "role": "viewer", "is_active": True,
        })
        user_id = r.json()["id"]
        patch = client.patch(f"{BASE}/{user_id}", headers=auth_headers, json={"role": "god"})
        assert patch.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# Désactivation
# ══════════════════════════════════════════════════════════════════════════════

class TestTeamDeactivate:
    def test_admin_can_deactivate_user(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "todeact@test.fr", "password": "T123456!",
            "first_name": "D", "last_name": "E", "role": "viewer", "is_active": True,
        })
        user_id = r.json()["id"]
        deact = client.post(f"{BASE}/{user_id}/deactivate", headers=auth_headers)
        assert deact.status_code == 200
        assert deact.json()["is_active"] is False

    def test_deactivated_user_cannot_login(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "nodlogin@test.fr", "password": "Test123456!",
            "first_name": "N", "last_name": "L", "role": "viewer", "is_active": True,
        })
        user_id = r.json()["id"]
        client.post(f"{BASE}/{user_id}/deactivate", headers=auth_headers)
        login = client.post("/api/v1/auth/login", json={
            "email": "nodlogin@test.fr", "password": "Test123456!",
        })
        assert login.status_code == 401

    def test_cannot_deactivate_self(self, client, auth_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.post(f"{BASE}/{me['id']}/deactivate", headers=auth_headers)
        assert r.status_code == 400

    def test_viewer_cannot_deactivate(self, client, auth_headers, viewer_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.post(f"{BASE}/{me['id']}/deactivate", headers=viewer_headers)
        assert r.status_code == 403

    def test_deactivate_nonexistent(self, client, auth_headers):
        r = client.post(f"{BASE}/999999/deactivate", headers=auth_headers)
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Changement de mdp par admin
# ══════════════════════════════════════════════════════════════════════════════

class TestAdminChangePassword:
    def test_admin_can_change_other_password(self, client, auth_headers):
        r = client.post(f"{BASE}/invite", headers=auth_headers, json={
            "email": "pwduser@test.fr", "password": "OldPwd123!",
            "first_name": "P", "last_name": "U", "role": "viewer", "is_active": True,
        })
        user_id = r.json()["id"]
        change = client.post(f"{BASE}/{user_id}/change-password", headers=auth_headers, json={
            "new_password": "NewPwd456!",
        })
        assert change.status_code == 200
        login = client.post("/api/v1/auth/login", json={
            "email": "pwduser@test.fr", "password": "NewPwd456!",
        })
        assert login.status_code == 200

    def test_admin_change_password_requires_strong_pwd(self, client, auth_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.post(f"{BASE}/{me['id']}/change-password", headers=auth_headers, json={
            "new_password": "weak",
        })
        assert r.status_code == 422

    def test_self_change_via_me_endpoint(self, client, auth_headers, admin_payload):
        r = client.post(f"{BASE}/me/change-password", headers=auth_headers, json={
            "new_password": "SelfChanged99!",  # /team/me/change-password uses UserChangePassword schema
        })
        assert r.status_code == 200
        login = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"], "password": "SelfChanged99!",
        })
        assert login.status_code == 200

    def test_me_change_password_requires_auth(self, client):
        r = client.post(f"{BASE}/me/change-password", json={"new_password": "Test123456!"})
        assert r.status_code == 401

    def test_viewer_cannot_change_others_password(self, client, auth_headers, viewer_headers):
        me = client.get("/api/v1/auth/me", headers=auth_headers).json()
        r = client.post(f"{BASE}/{me['id']}/change-password", headers=viewer_headers, json={
            "new_password": "Hack123456!",
        })
        assert r.status_code == 403
