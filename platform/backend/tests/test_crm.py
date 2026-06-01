"""
Tests for CRM contacts and pipeline kanban board.
"""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _setup(client):
    client.post("/api/v1/auth/bootstrap-admin", json={
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
        "first_name": "Admin", "last_name": "DataSphere",
        "role": "admin", "is_active": True,
    })
    token = client.post("/api/v1/auth/login", json={
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _org(client, headers, name="Test Org"):
    return client.post("/api/v1/organizations", json={
        "name": name, "country": "Guinée", "sector": "Telecom"
    }, headers=headers).json()


def _opp(client, headers, org_id, title="Opportunité test", status="Besoin qualifié", value="50000"):
    return client.post("/api/v1/opportunities", json={
        "organization_id": org_id,
        "title": title,
        "priority": "Haute",
        "status": status,
        "probability": 70,
        "potential_value": value,
    }, headers=headers).json()


# ── Contacts ─────────────────────────────────────────────────────────────────

def test_contacts_requires_auth(client):
    assert client.get("/api/v1/contacts").status_code == 401


def test_contacts_create(client, auth_headers):
    org = _org(client, auth_headers)
    resp = client.post("/api/v1/contacts", json={
        "organization_id": org["id"],
        "first_name": "Mamadou",
        "last_name": "Diallo",
        "job_title": "Directeur IT",
        "professional_email": "m.diallo@arpt.gov.gn",
        "linkedin_url": "https://linkedin.com/in/mamadou-diallo",
        "source": "LinkedIn",
        "notes": "Contact clé pour la mission ARPT.",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["first_name"] == "Mamadou"
    assert data["last_name"] == "Diallo"
    assert data["organization_id"] == org["id"]


def test_contacts_create_invalid_org(client, auth_headers):
    resp = client.post("/api/v1/contacts", json={
        "organization_id": 99999,
        "first_name": "Test",
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_contacts_list(client, auth_headers):
    org = _org(client, auth_headers, "Contact List Org")
    for fn, ln in [("Alpha", "A"), ("Beta", "B"), ("Gamma", "C")]:
        client.post("/api/v1/contacts", json={
            "organization_id": org["id"],
            "first_name": fn, "last_name": ln,
            "job_title": "Manager",
        }, headers=auth_headers)

    resp = client.get("/api/v1/contacts", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 3


def test_contacts_filter_by_org(client, auth_headers):
    org1 = _org(client, auth_headers, "Org Filter 1")
    org2 = _org(client, auth_headers, "Org Filter 2")
    client.post("/api/v1/contacts", json={
        "organization_id": org1["id"], "first_name": "OrgOne",
    }, headers=auth_headers)
    client.post("/api/v1/contacts", json={
        "organization_id": org2["id"], "first_name": "OrgTwo",
    }, headers=auth_headers)

    resp = client.get(f"/api/v1/contacts?organization_id={org1['id']}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(c["organization_id"] == org1["id"] for c in data)
    assert any(c["first_name"] == "OrgOne" for c in data)


def test_contacts_search(client, auth_headers):
    org = _org(client, auth_headers, "Search Org")
    client.post("/api/v1/contacts", json={
        "organization_id": org["id"],
        "first_name": "Sekou",
        "last_name": "Camara",
        "professional_email": "sekou.camara@unique.gn",
    }, headers=auth_headers)

    resp = client.get("/api/v1/contacts?search=sekou", headers=auth_headers)
    assert resp.status_code == 200
    assert any("Sekou" in c["first_name"] for c in resp.json())

    resp2 = client.get("/api/v1/contacts?search=unique.gn", headers=auth_headers)
    assert resp2.status_code == 200
    assert any("unique.gn" in (c.get("professional_email") or "") for c in resp2.json())


def test_contacts_get_by_id(client, auth_headers):
    org = _org(client, auth_headers, "GetById Org")
    created = client.post("/api/v1/contacts", json={
        "organization_id": org["id"], "first_name": "Find", "last_name": "Me",
    }, headers=auth_headers).json()

    resp = client.get(f"/api/v1/contacts/{created['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Find"


def test_contacts_patch(client, auth_headers):
    org = _org(client, auth_headers, "Patch Org")
    contact = client.post("/api/v1/contacts", json={
        "organization_id": org["id"], "first_name": "Old",
    }, headers=auth_headers).json()

    resp = client.patch(f"/api/v1/contacts/{contact['id']}", json={
        "first_name": "Updated",
        "job_title": "CTO",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Updated"
    assert resp.json()["job_title"] == "CTO"


def test_contacts_delete(client, auth_headers):
    org = _org(client, auth_headers, "Delete Org")
    contact = client.post("/api/v1/contacts", json={
        "organization_id": org["id"], "first_name": "ToDelete",
    }, headers=auth_headers).json()

    del_resp = client.delete(f"/api/v1/contacts/{contact['id']}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/v1/contacts/{contact['id']}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_contacts_not_found(client, auth_headers):
    assert client.get("/api/v1/contacts/99999", headers=auth_headers).status_code == 404
    assert client.patch("/api/v1/contacts/99999", json={}, headers=auth_headers).status_code == 404
    assert client.delete("/api/v1/contacts/99999", headers=auth_headers).status_code == 404


# ── Pipeline board ────────────────────────────────────────────────────────────

def test_pipeline_board_requires_auth(client):
    assert client.get("/api/v1/opportunities/pipeline/board").status_code == 401


def test_pipeline_board_structure(client, auth_headers):
    resp = client.get("/api/v1/opportunities/pipeline/board", headers=auth_headers)
    assert resp.status_code == 200
    columns = resp.json()
    assert isinstance(columns, list)
    assert len(columns) >= 7

    for col in columns:
        assert "status" in col
        assert "items" in col
        assert "total_value" in col
        assert "pipeline_value" in col
        assert isinstance(col["items"], list)


def test_pipeline_board_with_opportunities(client, auth_headers):
    org = _org(client, auth_headers, "Pipeline Board Org")
    _opp(client, auth_headers, org["id"], "Opp Pipeline 1", status="Besoin qualifié")
    _opp(client, auth_headers, org["id"], "Opp Pipeline 2", status="Proposition envoyée")

    resp = client.get("/api/v1/opportunities/pipeline/board", headers=auth_headers)
    columns = {c["status"]: c for c in resp.json()}

    assert len(columns["Besoin qualifié"]["items"]) >= 1
    assert len(columns["Proposition envoyée"]["items"]) >= 1

    item = columns["Besoin qualifié"]["items"][0]
    assert "title" in item
    assert "org_name" in item
    assert "probability" in item
    assert "pipeline_value" in item


def test_pipeline_board_values(client, auth_headers):
    org = _org(client, auth_headers, "Value Board Org")
    _opp(client, auth_headers, org["id"], "Value Opp", status="Négociation", value="100000")

    resp = client.get("/api/v1/opportunities/pipeline/board", headers=auth_headers)
    columns = {c["status"]: c for c in resp.json()}

    nego = columns["Négociation"]
    assert nego["total_value"] >= 100000
    assert nego["pipeline_value"] >= 0  # probability weighted


# ── Opportunity status move ───────────────────────────────────────────────────

def test_status_move_requires_auth(client):
    assert client.patch("/api/v1/opportunities/1/status", json={"status": "Gagnée"}).status_code == 401


def test_status_move_valid(client, auth_headers):
    org = _org(client, auth_headers, "StatusMove Org")
    opp = _opp(client, auth_headers, org["id"], status="Besoin qualifié")

    resp = client.patch(f"/api/v1/opportunities/{opp['id']}/status", json={
        "status": "Proposition envoyée"
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "Proposition envoyée"


def test_status_move_invalid_status(client, auth_headers):
    org = _org(client, auth_headers, "BadStatus Org")
    opp = _opp(client, auth_headers, org["id"])

    resp = client.patch(f"/api/v1/opportunities/{opp['id']}/status", json={
        "status": "Status invalide"
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_status_move_not_found(client, auth_headers):
    resp = client.patch("/api/v1/opportunities/99999/status", json={
        "status": "Gagnée"
    }, headers=auth_headers)
    assert resp.status_code == 404


def test_status_move_full_cycle(client, auth_headers):
    """An opportunity can traverse the full pipeline."""
    org = _org(client, auth_headers, "FullCycle Org")
    opp = _opp(client, auth_headers, org["id"], status="Prospect identifié")

    pipeline = [
        "Besoin identifié",
        "Besoin qualifié",
        "Proposition envoyée",
        "Négociation",
        "Gagnée",
    ]
    for s in pipeline:
        resp = client.patch(f"/api/v1/opportunities/{opp['id']}/status", json={"status": s}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == s
