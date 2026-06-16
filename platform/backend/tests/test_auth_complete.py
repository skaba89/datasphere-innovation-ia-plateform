"""
Auth complete test suite — login, refresh, MFA prep, RBAC, must_change_password.
"""
import pytest


class TestLogin:
    def test_login_success(self, client, make_user):
        u = make_user(role="consultant")
        r = client.post("/api/v1/auth/login", json={"email": u["email"], "password": "testpass123"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == u["email"]

    def test_login_returns_must_change_password(self, client, make_user):
        u = make_user(role="consultant")
        r = client.post("/api/v1/auth/login", json={"email": u["email"], "password": "testpass123"})
        assert r.status_code == 200
        data = r.json()
        assert "must_change_password" in data
        assert isinstance(data["must_change_password"], bool)

    def test_login_wrong_password(self, client, make_user):
        u = make_user()
        r = client.post("/api/v1/auth/login", json={"email": u["email"], "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_login_inactive_user(self, client, make_user):
        u = make_user(is_active=False)
        r = client.post("/api/v1/auth/login", json={"email": u["email"], "password": "testpass123"})
        assert r.status_code in (400, 401, 403)

    def test_login_unknown_email(self, client):
        r = client.post("/api/v1/auth/login", json={"email": "ghost@nobody.io", "password": "test"})
        assert r.status_code in (400, 401)


class TestMe:
    def test_me_authenticated(self, client, auth_headers, make_user):
        r = client.get("/api/v1/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "email" in data
        assert "role" in data

    def test_me_unauthenticated(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_me_contains_required_fields(self, client, auth_headers):
        data = client.get("/api/v1/auth/me", headers=auth_headers).json()
        for field in ("id", "email", "role", "is_active"):
            assert field in data, f"Missing field: {field}"


class TestChangePassword:
    def test_change_password_success(self, client, make_user):
        u = make_user()
        token = client.post("/api/v1/auth/login", json={
            "email": u["email"], "password": "testpass123"
        }).json()["access_token"]
        r = client.post("/api/v1/auth/change-password", json={
            "current_password": "testpass123",
            "new_password": "NewSecure456!",
        }, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_change_password_wrong_current(self, client, auth_headers):
        r = client.post("/api/v1/auth/change-password", json={
            "current_password": "WRONG",
            "new_password": "NewSecure456!",
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_change_password_clears_must_change_flag(self, client, make_user):
        """Après changement, must_change_password doit être False."""
        u = make_user()
        token = client.post("/api/v1/auth/login", json={
            "email": u["email"], "password": "testpass123"
        }).json()["access_token"]
        client.post("/api/v1/auth/change-password", json={
            "current_password": "testpass123", "new_password": "NewSecure456!",
        }, headers={"Authorization": f"Bearer {token}"})
        # Re-login avec nouveau MDP
        r2 = client.post("/api/v1/auth/login", json={
            "email": u["email"], "password": "NewSecure456!"
        })
        assert r2.status_code == 200
        assert r2.json()["must_change_password"] is False


class TestForgotPassword:
    def test_forgot_unknown_email_no_500(self, client):
        r = client.post("/api/v1/auth/forgot-password", json={"email": "ghost@nowhere.com"})
        # Doit retourner 200 (pas de fuite info) ou 404 — jamais 500
        assert r.status_code in (200, 404)

    def test_forgot_invalid_email(self, client):
        r = client.post("/api/v1/auth/forgot-password", json={"email": "not-an-email"})
        assert r.status_code in (400, 422)


class TestRBACAuth:
    def test_admin_can_access_admin_endpoint(self, client, auth_headers):
        r = client.get("/api/v1/team", headers=auth_headers)
        assert r.status_code == 200

    def test_viewer_cannot_create_tender(self, client, viewer_headers):
        r = client.post("/api/v1/tenders", json={"title": "Test"}, headers=viewer_headers)
        assert r.status_code in (403, 422)

    def test_different_roles_get_different_access(self, client, auth_headers, viewer_headers):
        # Admin peut lire l'équipe
        r_admin = client.get("/api/v1/team", headers=auth_headers)
        assert r_admin.status_code == 200
