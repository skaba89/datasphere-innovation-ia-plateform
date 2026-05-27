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
