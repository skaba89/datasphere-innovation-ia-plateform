"""
DataSphere Innovation IA Platform — Test Configuration

Fixtures disponibles :
  client              TestClient avec SQLite isolé par test
  auth_headers        Admin JWT
  viewer_headers      Viewer JWT
  consultant_headers  Consultant JWT
  manager_headers     Manager JWT
  org, contact, opportunity, tender, deliverable
  agent, assignment
  section             Section de livrable
  gonogo_criterion    Critère Go/No-Go
  compliance_item     Item de conformité

Helpers :
  make_user(client, admin_headers, email, role) → JWT headers
  make_org(client, headers, name) → org dict
  make_opp(client, headers, org_id) → opp dict
  make_tender(client, headers, opp_id, ref) → tender dict
  make_deliverable(client, headers, tender_id, opp_id) → deliverable dict
"""
import os

# ── Environnement de test ─────────────────────────────────────────────────────
os.environ["APP_ENV"]          = "test"
os.environ["APP_DEBUG"]        = "false"
os.environ["SECRET_KEY"]       = "test-secret-key-for-pytest-32chars!!"
os.environ["DATABASE_URL"]     = "sqlite:///./test.db"
os.environ["CORS_ORIGINS"]     = "http://localhost:5173"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["SMTP_HOST"]        = ""          # mode preview uniquement
os.environ["BOAMP_SCAN_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient

from app.db.session import Base, engine
import app.models  # noqa: F401 — enregistre tous les modèles SQLAlchemy
from app.main import app


# ── Cycle de vie de la base ────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_database():
    """Drop + recreate toutes les tables avant chaque test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """TestClient FastAPI synchrone — partagé dans le test, isolé de DB."""
    return TestClient(app)


# ── Helpers réutilisables (non-fixtures) ─────────────────────────────────────

def make_user(client, admin_headers, email: str, role: str,
              first_name: str = "Test", last_name: str = "User") -> dict:
    """Crée un utilisateur via l'API et retourne ses headers JWT."""
    password = "Test123456!"
    r = client.post("/api/v1/team/invite", headers=admin_headers, json={
        "email": email, "password": password,
        "first_name": first_name, "last_name": last_name,
        "role": role, "is_active": True,
    })
    assert r.status_code == 201, f"make_user failed ({role}): {r.json()}"
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def make_org(client, headers, name: str = "ACME Test Corp") -> dict:
    r = client.post("/api/v1/organizations", headers=headers, json={
        "name": name, "country": "FR", "sector": "IT / Data",
    })
    assert r.status_code == 201, r.json()
    return r.json()


def make_opp(client, headers, org_id: int, title: str = "Mission Data Platform") -> dict:
    r = client.post("/api/v1/opportunities", headers=headers, json={
        "organization_id": org_id, "title": title,
        "status": "Prospect identifie", "probability": 60,
        "potential_value": 100_000,
    })
    assert r.status_code == 201, r.json()
    return r.json()


def make_tender(client, headers, opp_id: int, ref: str = "AO-2026-001") -> dict:
    r = client.post("/api/v1/tenders", headers=headers, json={
        "opportunity_id": opp_id,
        "title": f"Appel d'offres {ref}",
        "reference": ref,
        "buyer_name": "Ministère du Numérique",
        "status": "draft",
    })
    assert r.status_code == 201, r.json()
    return r.json()


def make_deliverable(client, headers, tender_id: int, opp_id: int,
                     title: str = "Mémoire technique") -> dict:
    r = client.post("/api/v1/deliverables", headers=headers, json={
        "tender_id": tender_id, "opportunity_id": opp_id,
        "title": title, "deliverable_type": "memoire_technique", "status": "draft",
        "content_markdown": f"# {title}\n\nContenu initial du livrable.",
    })
    assert r.status_code == 201, r.json()
    return r.json()


# ── Fixtures utilisateurs ─────────────────────────────────────────────────────

@pytest.fixture
def admin_payload():
    return {
        "email": "admin@datasphere.fr", "password": "Admin123456!",
        "first_name": "Admin", "last_name": "DataSphere",
        "role": "admin", "is_active": True,
    }


@pytest.fixture
def auth_headers(client, admin_payload):
    """Bootstrap l'admin initial et retourne ses headers JWT."""
    r = client.post("/api/v1/auth/bootstrap-admin", json=admin_payload)
    assert r.status_code == 201, r.json()
    login = client.post("/api/v1/auth/login", json={
        "email": admin_payload["email"],
        "password": admin_payload["password"],
    })
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def viewer_headers(client, auth_headers):
    return make_user(client, auth_headers, "viewer@test.fr", "viewer")


@pytest.fixture
def consultant_headers(client, auth_headers):
    return make_user(client, auth_headers, "consultant@test.fr", "consultant")


@pytest.fixture
def manager_headers(client, auth_headers):
    return make_user(client, auth_headers, "manager@test.fr", "manager")


# ── Fixtures domaine CRM ──────────────────────────────────────────────────────

@pytest.fixture
def org(client, auth_headers):
    return make_org(client, auth_headers)


@pytest.fixture
def contact(client, auth_headers, org):
    r = client.post("/api/v1/contacts", headers=auth_headers, json={
        "organization_id": org["id"],
        "first_name": "Mamadou", "last_name": "Diallo",
        "professional_email": "mamadou.diallo@acme.fr",
        "job_title": "DSI",
    })
    assert r.status_code == 201, r.json()
    return r.json()


@pytest.fixture
def opportunity(client, auth_headers, org):
    return make_opp(client, auth_headers, org["id"])


@pytest.fixture
def tender(client, auth_headers, opportunity):
    return make_tender(client, auth_headers, opportunity["id"])


# ── Fixtures livrables ────────────────────────────────────────────────────────

@pytest.fixture
def deliverable(client, auth_headers, tender, opportunity):
    return make_deliverable(client, auth_headers, tender["id"], opportunity["id"])


@pytest.fixture
def section(client, auth_headers, deliverable):
    r = client.post(
        f"/api/v1/deliverables/{deliverable['id']}/sections",
        headers=auth_headers,
        json={
            "deliverable_id": deliverable["id"],
            "title": "Contexte et enjeux",
            "section_key": "contexte_enjeux",
            "position": 1,
            "content_markdown": "## Contexte et enjeux\n\nContenu initial de la section.",
        },
    )
    assert r.status_code == 201, r.json()
    return r.json()


# ── Fixtures agents ───────────────────────────────────────────────────────────

@pytest.fixture
def agent(client, auth_headers):
    """Installe les agents par défaut et retourne le premier."""
    client.post("/api/v1/agents/defaults/install", headers=auth_headers)
    r = client.get("/api/v1/agents", headers=auth_headers)
    agents = r.json()
    assert len(agents) > 0, "Aucun agent après install"
    return agents[0]


@pytest.fixture
def assignment(client, auth_headers, agent, tender):
    r = client.post("/api/v1/agents/assignments", headers=auth_headers, json={
        "agent_id": agent["id"],
        "tender_id": tender["id"],
        "objective": "Analyser l'AO et préparer la réponse",
        "priority": "high",
    })
    assert r.status_code == 201, r.json()
    return r.json()


# ── Fixtures gouvernance AO ───────────────────────────────────────────────────

@pytest.fixture
def gonogo_criterion(client, auth_headers, tender):
    r = client.post(
        f"/api/v1/tender-governance/tenders/{tender['id']}/go-no-go",
        headers=auth_headers,
        json={"name": "Budget suffisant", "tender_id": tender["id"], "weight": 1, "score": 4, "rationale": "OK"},
    )
    assert r.status_code == 201, r.json()
    return r.json()


@pytest.fixture
def compliance_item(client, auth_headers, tender):
    r = client.post(
        f"/api/v1/tender-governance/tenders/{tender['id']}/compliance",
        headers=auth_headers,
        json={"requirement_summary": "Certification ISO 27001", "tender_id": tender["id"],
              "compliance_status": "compliant", "comments": "Certifiée depuis 2023"},
    )
    assert r.status_code == 201, r.json()
    return r.json()
