"""
Tests — API Keys (Priorité 3)

GET    /api-keys/scopes  — catalogue des scopes
GET    /api-keys         — liste
POST   /api-keys         — création (secret retourné une fois)
PATCH  /api-keys/{id}    — renommer / activer/désactiver
DELETE /api-keys/{id}    — révoquer
POST   /api-keys/{id}/rotate — rotation du secret
"""

import pytest
import time

BASE = "/api/v1/api-keys"


class TestApiKeyScopes:
    def test_scopes_requires_auth(self, client):
        assert client.get(f"{BASE}/scopes").status_code == 401

    def test_scopes_returns_list(self, client, auth_headers):
        data = client.get(f"{BASE}/scopes", headers=auth_headers).json()
        assert "scopes" in data
        assert len(data["scopes"]) >= 5

    def test_scopes_have_keys_and_descriptions(self, client, auth_headers):
        for s in client.get(f"{BASE}/scopes", headers=auth_headers).json()["scopes"]:
            assert "key" in s
            assert "description" in s

    def test_read_all_scope_exists(self, client, auth_headers):
        keys = [s["key"] for s in client.get(f"{BASE}/scopes", headers=auth_headers).json()["scopes"]]
        assert "read:all" in keys
        assert "write:tenders" in keys


class TestApiKeyCreate:
    def test_requires_auth(self, client):
        assert client.post(f"{BASE}", json={"name": "test"}).status_code == 401

    def test_create_returns_201(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"test-key-{time.time_ns()}",
            "scopes": ["read:all"],
        })
        assert r.status_code == 201

    def test_create_returns_secret_once(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"secret-test-{time.time_ns()}",
            "scopes": ["read:all"],
        })
        data = r.json()
        assert "secret" in data
        assert data["secret"].startswith("ds_live_")
        # Secret should be long
        assert len(data["secret"]) > 30

    def test_create_includes_prefix(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"prefix-test-{time.time_ns()}",
            "scopes": ["read:all"],
        })
        assert r.json()["prefix"].startswith("ds_live_")

    def test_create_multiple_scopes(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"multi-scope-{time.time_ns()}",
            "scopes": ["read:all", "write:tenders"],
        })
        assert r.status_code == 201
        data = r.json()
        assert "read:all" in data["scopes"]
        assert "write:tenders" in data["scopes"]

    def test_invalid_scope_rejected(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": "bad-scope",
            "scopes": ["invalid:scope"],
        })
        assert r.status_code == 400

    def test_create_with_expiry(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"expiring-{time.time_ns()}",
            "scopes": ["read:all"],
            "expires_days": 30,
        })
        assert r.status_code == 201
        assert r.json()["expires_at"] is not None

    def test_create_without_expiry_has_null_expires(self, client, auth_headers):
        r = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"no-expiry-{time.time_ns()}",
            "scopes": ["read:all"],
        })
        assert r.json()["expires_at"] is None


class TestApiKeyList:
    def test_list_requires_auth(self, client):
        assert client.get(f"{BASE}").status_code == 401

    def test_list_returns_array(self, client, auth_headers):
        data = client.get(f"{BASE}", headers=auth_headers).json()
        assert isinstance(data, list)

    def test_created_key_appears_in_list(self, client, auth_headers):
        name = f"listable-{time.time_ns()}"
        client.post(f"{BASE}", headers=auth_headers, json={"name": name, "scopes": ["read:all"]})
        names = [k["name"] for k in client.get(f"{BASE}", headers=auth_headers).json()]
        assert name in names

    def test_list_items_have_no_secret(self, client, auth_headers):
        """Secret must NOT be returned in list — only at creation."""
        keys = client.get(f"{BASE}", headers=auth_headers).json()
        for k in keys:
            assert "secret" not in k

    def test_list_items_have_required_fields(self, client, auth_headers):
        client.post(f"{BASE}", headers=auth_headers, json={"name": f"fields-{time.time_ns()}", "scopes": ["read:all"]})
        for k in client.get(f"{BASE}", headers=auth_headers).json():
            for field in ("id", "name", "prefix", "scopes", "is_active", "created_at"):
                assert field in k


class TestApiKeyUpdate:
    def _create(self, client, auth_headers):
        return client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"to-update-{time.time_ns()}", "scopes": ["read:all"]
        }).json()

    def test_rename_key(self, client, auth_headers):
        k = self._create(client, auth_headers)
        r = client.patch(f"{BASE}/{k['id']}", headers=auth_headers, json={"name": "renamed-key"})
        assert r.status_code == 200
        assert r.json()["name"] == "renamed-key"

    def test_deactivate_key(self, client, auth_headers):
        k = self._create(client, auth_headers)
        r = client.patch(f"{BASE}/{k['id']}", headers=auth_headers, json={"is_active": False})
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_cannot_update_other_user_key(self, client, auth_headers):
        r = client.patch(f"{BASE}/999999", headers=auth_headers, json={"name": "hack"})
        assert r.status_code == 404


class TestApiKeyRevoke:
    def test_revoke_requires_auth(self, client):
        assert client.delete(f"{BASE}/1").status_code == 401

    def test_revoke_returns_204(self, client, auth_headers):
        k = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"to-revoke-{time.time_ns()}", "scopes": ["read:all"]
        }).json()
        r = client.delete(f"{BASE}/{k['id']}", headers=auth_headers)
        assert r.status_code == 204

    def test_revoked_key_gone_from_list(self, client, auth_headers):
        name = f"gone-{time.time_ns()}"
        k = client.post(f"{BASE}", headers=auth_headers, json={"name": name, "scopes": ["read:all"]}).json()
        client.delete(f"{BASE}/{k['id']}", headers=auth_headers)
        names = [key["name"] for key in client.get(f"{BASE}", headers=auth_headers).json()]
        assert name not in names

    def test_cannot_revoke_other_user_key(self, client, auth_headers):
        r = client.delete(f"{BASE}/999999", headers=auth_headers)
        assert r.status_code == 404


class TestApiKeyRotate:
    def test_rotate_generates_new_secret(self, client, auth_headers):
        k = client.post(f"{BASE}", headers=auth_headers, json={
            "name": f"to-rotate-{time.time_ns()}", "scopes": ["read:all"]
        }).json()
        old_prefix = k["prefix"]

        r = client.post(f"{BASE}/{k['id']}/rotate", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "secret" in data
        assert data["secret"].startswith("ds_live_")
        # New prefix should differ from old
        assert data["prefix"] != old_prefix

    def test_rotate_nonexistent_key(self, client, auth_headers):
        r = client.post(f"{BASE}/999999/rotate", headers=auth_headers)
        assert r.status_code == 404
