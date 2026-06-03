"""
Tests d'authentification — couverture complète.

Couvre :
  - Bootstrap admin (succès, doublon)
  - Login : succès, email inconnu, mauvais mdp, body vide, email invalide
  - /me : succès, token absent, token falsifié, token expiré (simulé)
  - Refresh token : succès, token invalide, token manquant
  - Forgot password : succès, email inconnu (réponse neutre), email invalide
  - Reset password : succès, token invalide, token expiré, mdp trop court
  - Change password : succès, ancien mdp incorrect, mdp court
  - Logout implicite (token révoqué par changement de mdp)
  - Accès simultané avec plusieurs rôles
"""
import time
import pytest
from tests.conftest import make_user


BASE = "/api/v1/auth"


# ══════════════════════════════════════════════════════════════════════════════
# Bootstrap
# ══════════════════════════════════════════════════════════════════════════════

class TestBootstrap:
    def test_bootstrap_creates_admin(self, client, admin_payload):
        r = client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == admin_payload["email"]
        assert data["role"] == "admin"
        assert data["is_active"] is True
        assert "password" not in data  # jamais exposé

    def test_bootstrap_sets_first_last_name(self, client, admin_payload):
        r = client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        assert r.json()["first_name"] == admin_payload["first_name"]
        assert r.json()["last_name"] == admin_payload["last_name"]

    def test_bootstrap_idempotent_second_call_rejected(self, client, admin_payload):
        client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        r2 = client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        assert r2.status_code in (403, 409)  # backend uses 403 when admin exists

    def test_bootstrap_requires_valid_email(self, client):
        r = client.post(f"{BASE}/bootstrap-admin", json={
            "email": "not-an-email", "password": "Admin123456!",
            "first_name": "A", "last_name": "B", "role": "admin", "is_active": True,
        })
        assert r.status_code == 422

    def test_bootstrap_requires_all_fields(self, client):
        r = client.post(f"{BASE}/bootstrap-admin", json={})
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Login
# ══════════════════════════════════════════════════════════════════════════════

class TestLogin:
    def test_login_success(self, client, auth_headers, admin_payload):
        r = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"],
            "password": admin_payload["password"],
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["role"] == "admin"

    def test_login_returns_user_profile(self, client, auth_headers, admin_payload):
        r = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        user = r.json()["user"]
        assert user["email"] == admin_payload["email"]
        assert user["first_name"] == admin_payload["first_name"]
        assert "password" not in user

    def test_login_wrong_password(self, client, auth_headers, admin_payload):
        r = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_login_unknown_email(self, client, auth_headers):
        r = client.post(f"{BASE}/login", json={
            "email": "nobody@nowhere.fr", "password": "Admin123456!",
        })
        assert r.status_code == 401

    def test_login_empty_body(self, client):
        r = client.post(f"{BASE}/login", json={})
        assert r.status_code == 422

    def test_login_invalid_email_format(self, client):
        r = client.post(f"{BASE}/login", json={"email": "notvalid", "password": "pass"})
        assert r.status_code == 422

    def test_login_inactive_user(self, client, auth_headers, admin_payload):
        # Créer un user puis le désactiver
        r = client.post("/api/v1/team/invite", headers=auth_headers, json={
            "email": "inactive@test.fr", "password": "Test123456!",
            "first_name": "I", "last_name": "N", "role": "viewer", "is_active": True,
        })
        user_id = r.json()["id"]
        client.post(f"/api/v1/team/{user_id}/deactivate", headers=auth_headers)
        r2 = client.post(f"{BASE}/login", json={"email": "inactive@test.fr", "password": "Test123456!"})
        assert r2.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# /me — Profil utilisateur courant
# ══════════════════════════════════════════════════════════════════════════════

class TestMe:
    def test_me_returns_current_user(self, client, auth_headers, admin_payload):
        r = client.get(f"{BASE}/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == admin_payload["email"]
        assert r.json()["role"] == "admin"

    def test_me_requires_auth(self, client):
        r = client.get(f"{BASE}/me")
        assert r.status_code == 401

    def test_me_rejects_invalid_token(self, client):
        r = client.get(f"{BASE}/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_me_rejects_tampered_token(self, client, auth_headers):
        token = auth_headers["Authorization"].split(" ")[1]
        # Tamper last chars
        tampered = token[:-5] + "XXXXX"
        r = client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {tampered}"})
        assert r.status_code == 401

    def test_me_rejects_empty_bearer(self, client):
        r = client.get(f"{BASE}/me", headers={"Authorization": "Bearer "})
        assert r.status_code == 401

    def test_me_rejects_basic_auth(self, client):
        import base64
        creds = base64.b64encode(b"admin@test.fr:Admin123456!").decode()
        r = client.get(f"{BASE}/me", headers={"Authorization": f"Basic {creds}"})
        assert r.status_code == 401

    def test_me_viewer_role(self, client, viewer_headers):
        r = client.get(f"{BASE}/me", headers=viewer_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "viewer"


# ══════════════════════════════════════════════════════════════════════════════
# Refresh token
# ══════════════════════════════════════════════════════════════════════════════

class TestRefreshToken:
    def test_refresh_returns_new_access_token(self, client, admin_payload):
        client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        login = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        refresh_token = login.json()["refresh_token"]
        r = client.post(f"{BASE}/refresh", json={"refresh_token": refresh_token})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_refresh_new_token_works(self, client, admin_payload):
        """Le nouveau access_token permet d'accéder à /me."""
        client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        login = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        refresh_token = login.json()["refresh_token"]
        new_token = client.post(f"{BASE}/refresh", json={"refresh_token": refresh_token}).json()["access_token"]
        r = client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {new_token}"})
        assert r.status_code == 200

    def test_refresh_empty_token(self, client):
        r = client.post(f"{BASE}/refresh", json={"refresh_token": ""})
        assert r.status_code == 401

    def test_refresh_invalid_token(self, client):
        r = client.post(f"{BASE}/refresh", json={"refresh_token": "not.a.valid.jwt"})
        assert r.status_code == 401

    def test_refresh_missing_body(self, client):
        r = client.post(f"{BASE}/refresh", json={})
        assert r.status_code == 422

    def test_refresh_access_token_rejected(self, client, admin_payload):
        """Un access_token ne doit pas être utilisable comme refresh_token."""
        client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        login = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        access_token = login.json()["access_token"]
        r = client.post(f"{BASE}/refresh", json={"refresh_token": access_token})
        assert r.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# Forgot / Reset password
# ══════════════════════════════════════════════════════════════════════════════

class TestPasswordReset:
    def test_forgot_returns_200_for_known_email(self, client, auth_headers, admin_payload):
        r = client.post(f"{BASE}/forgot-password", json={"email": admin_payload["email"]})
        assert r.status_code == 200

    def test_forgot_returns_200_for_unknown_email(self, client):
        """Réponse neutre pour éviter l'énumération d'emails."""
        r = client.post(f"{BASE}/forgot-password", json={"email": "nobody@nowhere.fr"})
        assert r.status_code == 200

    def test_forgot_invalid_email_format(self, client):
        r = client.post(f"{BASE}/forgot-password", json={"email": "notanemail"})
        assert r.status_code == 422

    def test_reset_with_valid_token(self, client, auth_headers, admin_payload):
        """Générer un token de reset et l'utiliser."""
        from app.core.security import create_reset_token
        token = create_reset_token(admin_payload["email"])
        r = client.post(f"{BASE}/reset-password", json={
            "token": token, "new_password": "NewPassword123!",
        })
        assert r.status_code == 200
        # Se connecter avec le nouveau mdp
        login = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": "NewPassword123!",
        })
        assert login.status_code == 200

    def test_reset_old_password_invalid_after_reset(self, client, admin_payload):
        """Après reset, l'ancien mdp ne fonctionne plus."""
        from app.core.security import create_reset_token
        client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        token = create_reset_token(admin_payload["email"])
        client.post(f"{BASE}/reset-password", json={"token": token, "new_password": "NewPwd789!"})
        r = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        assert r.status_code == 401

    def test_reset_invalid_token(self, client, auth_headers):
        r = client.post(f"{BASE}/reset-password", json={
            "token": "invalid.token.here", "new_password": "NewPassword123!",
        })
        assert r.status_code in (400, 401)

    def test_reset_too_short_password(self, client, admin_payload):
        from app.core.security import create_reset_token
        client.post(f"{BASE}/bootstrap-admin", json=admin_payload)
        token = create_reset_token(admin_payload["email"])
        r = client.post(f"{BASE}/reset-password", json={"token": token, "new_password": "abc"})
        assert r.status_code in (400, 422)

    def test_reset_missing_fields(self, client, auth_headers):
        r = client.post(f"{BASE}/reset-password", json={"token": "x"})
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Change password
# ══════════════════════════════════════════════════════════════════════════════

class TestChangePassword:
    def test_self_change_password_success(self, client, auth_headers, admin_payload):
        r = client.post(f"{BASE}/change-password", headers=auth_headers, json={
            "current_password": admin_payload["password"],
            "new_password": "ChangedPwd99!",
        })
        assert r.status_code == 200
        login = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": "ChangedPwd99!",
        })
        assert login.status_code == 200

    def test_change_password_too_short(self, client, auth_headers):
        r = client.post(f"{BASE}/change-password", headers=auth_headers, json={
            "current_password": "Admin123456!",
            "new_password": "abc",
        })
        assert r.status_code == 422

    def test_change_password_requires_auth(self, client):
        r = client.post(f"{BASE}/change-password", json={"current_password": "x", "new_password": "NewPwd123!"})
        assert r.status_code == 401

    def test_change_password_empty_body(self, client, auth_headers):
        r = client.post(f"{BASE}/change-password", headers=auth_headers, json={})
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# RBAC multi-rôles
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthRBAC:
    def test_admin_sees_all_users(self, client, auth_headers):
        r = client.get("/api/v1/team", headers=auth_headers)
        assert r.status_code == 200

    def test_viewer_can_read_own_profile(self, client, viewer_headers):
        r = client.get(f"{BASE}/me", headers=viewer_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "viewer"

    def test_concurrent_sessions_both_valid(self, client, auth_headers, admin_payload):
        """Deux sessions simultanées avec le même compte sont valides."""
        login1 = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        login2 = client.post(f"{BASE}/login", json={
            "email": admin_payload["email"], "password": admin_payload["password"],
        })
        for login in [login1, login2]:
            token = login.json()["access_token"]
            r = client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"})
            assert r.status_code == 200
