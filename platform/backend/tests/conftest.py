import os

os.environ["APP_ENV"] = "test"
os.environ["APP_DEBUG"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

import pytest
from fastapi.testclient import TestClient

from app.db.session import Base, engine
import app.models  # noqa: F401
from app.main import app


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_payload():
    return {
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
        "first_name": "Admin",
        "last_name": "DataSphere",
        "role": "admin",
        "is_active": True,
    }


@pytest.fixture
def auth_headers(client, admin_payload):
    bootstrap_response = client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
    assert bootstrap_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": admin_payload["email"], "password": admin_payload["password"]},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
