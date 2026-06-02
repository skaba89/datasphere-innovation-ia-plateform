def test_bootstrap_admin_then_login_and_me(client, admin_payload):
    bootstrap_response = client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
    assert bootstrap_response.status_code == 201
    assert bootstrap_response.json()["email"] == admin_payload["email"]
    assert bootstrap_response.json()["role"] == "admin"

    second_bootstrap_response = client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
    assert second_bootstrap_response.status_code == 403

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": admin_payload["email"], "password": admin_payload["password"]},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    assert token

    me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == admin_payload["email"]


def test_login_rejects_wrong_password(client, admin_payload):
    client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": admin_payload["email"], "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_me_rejects_invalid_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401


# ── Refresh token tests ────────────────────────────────────────────────────────

def test_login_returns_refresh_token(client, auth_headers):
    """Login should return both access and refresh tokens."""
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != ""


def test_refresh_token_returns_new_access(client, auth_headers):
    """A valid refresh token should yield a new access token."""
    login = client.post("/api/v1/auth/login", json={
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
    })
    refresh_token = login.json()["refresh_token"]

    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_refresh_invalid_token_rejected(client):
    """An invalid refresh token must be rejected with 401."""
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.valid.token"})
    assert resp.status_code == 401


def test_forgot_password_always_200(client):
    """Forgot password always returns 200 regardless of email existence."""
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "doesnotexist@example.com"})
    assert resp.status_code == 200
    assert "message" in resp.json()


def test_reset_password_invalid_token(client):
    """Reset with invalid token should return 400."""
    resp = client.post("/api/v1/auth/reset-password", json={
        "token": "invalid.token.here",
        "new_password": "NewPassword123!",
    })
    assert resp.status_code == 400


def test_change_password_wrong_current(client, auth_headers):
    """Change password with wrong current password must fail."""
    resp = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
        "current_password": "wrongpassword",
        "new_password": "NewPassword123!",
    })
    assert resp.status_code == 400


def test_change_password_too_short(client, auth_headers):
    """Change password with < 8 chars must fail with 4xx."""
    resp = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
        "current_password": "Admin123456!",
        "new_password": "short",
    })
    assert resp.status_code in (400, 422)
