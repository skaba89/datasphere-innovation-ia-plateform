"""
Complete authentication test suite.
Covers: login, JWT, refresh token, forgot/reset password, change password,
RBAC on /me, edge cases, token expiry simulation.
"""
import pytest
from app.core.security import create_access_token, create_refresh_token, create_reset_token
from datetime import timedelta


# ── Bootstrap ─────────────────────────────────────────────────────────────────

class TestBootstrap:
    def test_bootstrap_creates_admin(self, client, admin_payload):
        r = client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == admin_payload["email"]
        assert data["role"] == "admin"
        assert "password" not in data

    def test_bootstrap_second_call_forbidden(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        r = client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        assert r.status_code == 403

    def test_bootstrap_requires_valid_payload(self, client):
        r = client.post("/api/v1/auth/bootstrap-admin", json={"email": "bad"})
        assert r.status_code == 422


# ── Login ──────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        r = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": admin_payload["password"],
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == admin_payload["email"]
        assert data["user"]["role"] == "admin"

    def test_login_wrong_password(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        r = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": "WrongPassword!",
        })
        assert r.status_code == 401

    def test_login_unknown_email(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        r = client.post("/api/v1/auth/login", json={
            "email": "unknown@nobody.com",
            "password": "whatever",
        })
        assert r.status_code == 401

    def test_login_empty_body(self, client):
        r = client.post("/api/v1/auth/login", json={})
        assert r.status_code == 422

    def test_login_invalid_email_format(self, client):
        r = client.post("/api/v1/auth/login", json={"email": "notanemail", "password": "test"})
        assert r.status_code == 422

    def test_login_missing_password(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        r = client.post("/api/v1/auth/login", json={"email": admin_payload["email"]})
        assert r.status_code == 422

    def test_login_returns_user_without_password(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        r = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": admin_payload["password"],
        })
        user = r.json()["user"]
        assert "password" not in user
        assert "hashed_password" not in user
        assert "password_hash" not in user


# ── /auth/me ───────────────────────────────────────────────────────────────────

class TestMe:
    def test_me_returns_current_user(self, client, auth_headers, admin_payload):
        r = client.get("/api/v1/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == admin_payload["email"]
        assert r.json()["role"] == "admin"

    def test_me_without_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_me_with_expired_token_returns_401(self, client):
        expired = create_access_token("999", expires_delta=timedelta(seconds=-1))
        r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
        assert r.status_code == 401

    def test_me_with_garbage_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert r.status_code == 401

    def test_me_with_missing_bearer_prefix(self, client, auth_headers):
        token = auth_headers["Authorization"].replace("Bearer ", "")
        r = client.get("/api/v1/auth/me", headers={"Authorization": token})
        assert r.status_code in (401, 403)


# ── Refresh token ──────────────────────────────────────────────────────────────

class TestRefreshToken:
    def _get_refresh(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        login = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": admin_payload["password"],
        })
        return login.json()["refresh_token"]

    def test_refresh_returns_new_access_token(self, client, admin_payload):
        rt = self._get_refresh(client, admin_payload)
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["token_type"] == "bearer"

    def test_refresh_new_token_is_usable(self, client, admin_payload):
        rt = self._get_refresh(client, admin_payload)
        new_token = client.post("/api/v1/auth/refresh", json={"refresh_token": rt}).json()["access_token"]
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me.status_code == 200

    def test_refresh_with_access_token_rejected(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        login = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": admin_payload["password"],
        })
        access_token = login.json()["access_token"]
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
        assert r.status_code == 401

    def test_refresh_with_invalid_token_rejected(self, client):
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": "notavalidtoken"})
        assert r.status_code == 401

    def test_refresh_with_empty_token_rejected(self, client):
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": ""})
        assert r.status_code == 401

    def test_refresh_missing_body_field(self, client):
        r = client.post("/api/v1/auth/refresh", json={})
        assert r.status_code == 422


# ── Forgot / Reset password ───────────────────────────────────────────────────

class TestForgotResetPassword:
    def test_forgot_unknown_email_still_200(self, client):
        r = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@nowhere.com"})
        assert r.status_code == 200
        assert "message" in r.json()

    def test_forgot_invalid_email_422(self, client):
        r = client.post("/api/v1/auth/forgot-password", json={"email": "notanemail"})
        assert r.status_code == 422

    def test_forgot_missing_body(self, client):
        r = client.post("/api/v1/auth/forgot-password", json={})
        assert r.status_code == 422

    def test_reset_with_valid_token(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        token = create_reset_token(admin_payload["email"])
        r = client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "NewSecurePass123!",
        })
        assert r.status_code == 200
        # Verify login with new password works
        login = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": "NewSecurePass123!",
        })
        assert login.status_code == 200

    def test_reset_old_password_no_longer_works(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        token = create_reset_token(admin_payload["email"])
        client.post("/api/v1/auth/reset-password", json={
            "token": token, "new_password": "NewSecurePass123!",
        })
        old_login = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"],
            "password": admin_payload["password"],
        })
        assert old_login.status_code == 401

    def test_reset_invalid_token(self, client):
        r = client.post("/api/v1/auth/reset-password", json={
            "token": "totallyinvalid", "new_password": "NewSecurePass123!",
        })
        assert r.status_code == 400

    def test_reset_short_password(self, client, admin_payload):
        client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
        token = create_reset_token(admin_payload["email"])
        r = client.post("/api/v1/auth/reset-password", json={
            "token": token, "new_password": "short",
        })
        assert r.status_code in (400, 422)

    def test_reset_missing_fields(self, client):
        r = client.post("/api/v1/auth/reset-password", json={"token": "abc"})
        assert r.status_code == 422

    def test_reset_unknown_user_email(self, client):
        token = create_reset_token("ghost@nobody.com")
        r = client.post("/api/v1/auth/reset-password", json={
            "token": token, "new_password": "NewSecurePass123!",
        })
        assert r.status_code == 400


# ── Change password ───────────────────────────────────────────────────────────

class TestChangePassword:
    def test_change_password_success(self, client, auth_headers, admin_payload):
        r = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
            "current_password": admin_payload["password"],
            "new_password": "NewAdmin999!",
        })
        assert r.status_code == 200
        # Verify new password works
        login = client.post("/api/v1/auth/login", json={
            "email": admin_payload["email"], "password": "NewAdmin999!",
        })
        assert login.status_code == 200

    def test_change_password_wrong_current(self, client, auth_headers):
        r = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
            "current_password": "WrongCurrent!", "new_password": "NewAdmin999!",
        })
        assert r.status_code == 400

    def test_change_password_too_short(self, client, auth_headers, admin_payload):
        r = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
            "current_password": admin_payload["password"], "new_password": "abc",
        })
        assert r.status_code in (400, 422)

    def test_change_password_requires_auth(self, client):
        r = client.post("/api/v1/auth/change-password", json={
            "current_password": "old", "new_password": "newpassword123",
        })
        assert r.status_code == 401
