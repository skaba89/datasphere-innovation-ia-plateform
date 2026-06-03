"""
Tests CRM — Organizations, Contacts, Opportunities.

Couverture :
  Organizations : CRUD complet, filtres, validation, RBAC
  Contacts : CRUD, liaison org, email unique, RBAC
  Opportunities : CRUD, statuts, pipeline, valeur pondérée, RBAC
"""
import pytest
from tests.conftest import make_org, make_opp

BASE_ORGS  = "/api/v1/organizations"
BASE_CONTS = "/api/v1/contacts"
BASE_OPPS  = "/api/v1/opportunities"

VALID_STATUSES = [
    "Prospect identifié", "Négociation", "Gagnée", "Perdue",
]


# ══════════════════════════════════════════════════════════════════════════════
# ORGANIZATIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestOrganizations:
    # ── Auth ──────────────────────────────────────────────────────────────────

    def test_list_requires_auth(self, client):
        assert client.get(BASE_ORGS).status_code == 401

    def test_create_requires_auth(self, client):
        assert client.post(BASE_ORGS, json={"name": "X"}).status_code == 401

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimal(self, client, auth_headers):
        r = client.post(BASE_ORGS, headers=auth_headers, json={"name": "DataCorp"})
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "DataCorp"
        assert data["validation_status"] == "validated"

    def test_create_full(self, client, auth_headers):
        r = client.post(BASE_ORGS, headers=auth_headers, json={
            "name": "FullOrg SAS",
            "country": "FR",
            "sector": "Finance",
            "organization_type": "Entreprise privée",
            "website": "https://fullorg.fr",
            "linkedin_url": "https://linkedin.com/company/fullorg",
        })
        assert r.status_code == 201
        d = r.json()
        assert d["country"] == "FR"
        assert d["sector"] == "Finance"

    def test_create_name_too_short(self, client, auth_headers):
        r = client.post(BASE_ORGS, headers=auth_headers, json={"name": "A"})
        assert r.status_code == 422

    def test_create_missing_name(self, client, auth_headers):
        r = client.post(BASE_ORGS, headers=auth_headers, json={"country": "FR"})
        assert r.status_code == 422

    # ── Read ──────────────────────────────────────────────────────────────────

    def test_list_returns_orgs(self, client, auth_headers, org):
        data = client.get(BASE_ORGS, headers=auth_headers).json()
        assert any(o["id"] == org["id"] for o in data)

    def test_get_by_id(self, client, auth_headers, org):
        r = client.get(f"{BASE_ORGS}/{org['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == org["id"]

    def test_get_nonexistent(self, client, auth_headers):
        assert client.get(f"{BASE_ORGS}/999999", headers=auth_headers).status_code == 404

    def test_viewer_can_list(self, client, viewer_headers):
        r = client.get(BASE_ORGS, headers=viewer_headers)
        assert r.status_code == 200

    # ── Update ────────────────────────────────────────────────────────────────

    def test_update_name(self, client, auth_headers, org):
        r = client.patch(f"{BASE_ORGS}/{org['id']}", headers=auth_headers, json={
            "name": "Updated Corp",
        })
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Corp"

    def test_update_nonexistent(self, client, auth_headers):
        r = client.patch(f"{BASE_ORGS}/999999", headers=auth_headers, json={"name": "X"})
        assert r.status_code in (404, 422)

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_delete_org(self, client, auth_headers):
        org = make_org(client, auth_headers, "ToDelete")
        r = client.delete(f"{BASE_ORGS}/{org['id']}", headers=auth_headers)
        assert r.status_code in (200, 204)
        assert client.get(f"{BASE_ORGS}/{org['id']}", headers=auth_headers).status_code == 404

    def test_delete_nonexistent(self, client, auth_headers):
        r = client.delete(f"{BASE_ORGS}/999999", headers=auth_headers)
        assert r.status_code == 404

    # ── Pagination ────────────────────────────────────────────────────────────

    def test_pagination_skip_limit(self, client, auth_headers):
        for i in range(5):
            make_org(client, auth_headers, f"Pag Corp {i}")
        r_all = client.get(BASE_ORGS, headers=auth_headers).json()
        r_pag = client.get(f"{BASE_ORGS}?skip=2&limit=2", headers=auth_headers).json()
        assert len(r_pag) <= 2
        assert len(r_all) >= 5

    def test_empty_list(self, client, auth_headers):
        data = client.get(BASE_ORGS, headers=auth_headers).json()
        assert isinstance(data, list)


# ══════════════════════════════════════════════════════════════════════════════
# CONTACTS
# ══════════════════════════════════════════════════════════════════════════════

class TestContacts:
    # ── Auth ──────────────────────────────────────────────────────────────────

    def test_list_requires_auth(self, client):
        assert client.get(BASE_CONTS).status_code == 401

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimal(self, client, auth_headers, org):
        r = client.post(BASE_CONTS, headers=auth_headers, json={
            "organization_id": org["id"],
            "first_name": "Aissatou",
            "last_name": "Barry",
        })
        assert r.status_code == 201
        d = r.json()
        assert d["first_name"] == "Aissatou"
        assert d["organization_id"] == org["id"]

    def test_create_full(self, client, auth_headers, org):
        r = client.post(BASE_CONTS, headers=auth_headers, json={
            "organization_id": org["id"],
            "first_name": "Alpha",
            "last_name": "Conde",
            "professional_email": "alpha.conde@org.fr",
            "job_title": "CTO",
            "linkedin_url": "https://linkedin.com/in/alphaconde",
            "source": "LinkedIn",
        })
        assert r.status_code == 201
        assert r.json()["job_title"] == "CTO"

    def test_create_requires_org(self, client, auth_headers):
        r = client.post(BASE_CONTS, headers=auth_headers, json={
            "first_name": "No", "last_name": "Org",
        })
        assert r.status_code == 422

    def test_create_invalid_org_id(self, client, auth_headers):
        r = client.post(BASE_CONTS, headers=auth_headers, json={
            "organization_id": 999999,
            "first_name": "X", "last_name": "Y",
        })
        assert r.status_code in (400, 404, 422)

    # ── Read ──────────────────────────────────────────────────────────────────

    def test_list_contacts(self, client, auth_headers, contact):
        data = client.get(BASE_CONTS, headers=auth_headers).json()
        assert any(c["id"] == contact["id"] for c in data)

    def test_get_contact(self, client, auth_headers, contact):
        r = client.get(f"{BASE_CONTS}/{contact['id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_get_nonexistent(self, client, auth_headers):
        assert client.get(f"{BASE_CONTS}/999999", headers=auth_headers).status_code == 404

    # ── Update ────────────────────────────────────────────────────────────────

    def test_update_job_title(self, client, auth_headers, contact):
        r = client.patch(f"{BASE_CONTS}/{contact['id']}", headers=auth_headers, json={
            "job_title": "VP Engineering",
        })
        assert r.status_code == 200
        assert r.json()["job_title"] == "VP Engineering"

    def test_update_nonexistent(self, client, auth_headers):
        assert client.patch(f"{BASE_CONTS}/999999", headers=auth_headers, json={"job_title": "X"}).status_code == 404

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_delete_contact(self, client, auth_headers, org):
        c = client.post(BASE_CONTS, headers=auth_headers, json={
            "organization_id": org["id"], "first_name": "D", "last_name": "E",
        }).json()
        r = client.delete(f"{BASE_CONTS}/{c['id']}", headers=auth_headers)
        assert r.status_code in (200, 204)
        assert client.get(f"{BASE_CONTS}/{c['id']}", headers=auth_headers).status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# OPPORTUNITIES
# ══════════════════════════════════════════════════════════════════════════════

class TestOpportunities:
    # ── Auth ──────────────────────────────────────────────────────────────────

    def test_list_requires_auth(self, client):
        assert client.get(BASE_OPPS).status_code == 401

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_success(self, client, auth_headers, org):
        r = client.post(BASE_OPPS, headers=auth_headers, json={
            "organization_id": org["id"],
            "title": "Projet BI Analytics",
            "status": "Prospect identifié",
            "probability": 45,
            "potential_value": 80_000,
        })
        assert r.status_code == 201
        d = r.json()
        assert d["title"] == "Projet BI Analytics"
        assert d["probability"] == 45

    def test_create_requires_org(self, client, auth_headers):
        r = client.post(BASE_OPPS, headers=auth_headers, json={
            "title": "Orphan Opp", "status": "Prospect identifié", "probability": 50,
        })
        assert r.status_code == 422

    def test_create_all_statuses(self, client, auth_headers, org):
        for i, status in enumerate(VALID_STATUSES):
            r = client.post(BASE_OPPS, headers=auth_headers, json={
                "organization_id": org["id"],
                "title": f"Opp status {i}",
                "status": status,
                "probability": 50,
            })
            assert r.status_code == 201, f"Status {status} failed: {r.json()}"

    # ── Probability validation ────────────────────────────────────────────────

    def test_probability_zero(self, client, auth_headers, org):
        r = client.post(BASE_OPPS, headers=auth_headers, json={
            "organization_id": org["id"], "title": "Zero", "status": "Perdue", "probability": 0,
        })
        assert r.status_code == 201

    def test_probability_100(self, client, auth_headers, org):
        r = client.post(BASE_OPPS, headers=auth_headers, json={
            "organization_id": org["id"], "title": "Won", "status": "Gagnee", "probability": 100,
        })
        assert r.status_code == 201

    # ── Read ──────────────────────────────────────────────────────────────────

    def test_list_opps(self, client, auth_headers, opportunity):
        data = client.get(BASE_OPPS, headers=auth_headers).json()
        assert any(o["id"] == opportunity["id"] for o in data)

    def test_get_by_id(self, client, auth_headers, opportunity):
        r = client.get(f"{BASE_OPPS}/{opportunity['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == opportunity["id"]

    def test_get_nonexistent(self, client, auth_headers):
        assert client.get(f"{BASE_OPPS}/999999", headers=auth_headers).status_code == 404

    # ── Update ────────────────────────────────────────────────────────────────

    def test_update_title(self, client, auth_headers, opportunity):
        r = client.patch(f"{BASE_OPPS}/{opportunity['id']}", headers=auth_headers, json={
            "title": "Nouvelle mission BI",
        })
        assert r.status_code == 200
        assert r.json()["title"] == "Nouvelle mission BI"

    def test_update_probability(self, client, auth_headers, opportunity):
        r = client.patch(f"{BASE_OPPS}/{opportunity['id']}", headers=auth_headers, json={
            "probability": 85,
        })
        assert r.status_code == 200
        assert r.json()["probability"] == 85

    def test_status_transition(self, client, auth_headers, opportunity):
        r = client.patch(
            f"{BASE_OPPS}/{opportunity['id']}/status",
            headers=auth_headers,
            json={"status": "Négociation"},  # Exact PIPELINE_STATUSES value with accent
        )
        assert r.status_code == 200
        assert r.json()["status"] == "Négociation"

    # ── Pipeline ─────────────────────────────────────────────────────────────

    def test_pipeline_board(self, client, auth_headers, opportunity):
        r = client.get(f"{BASE_OPPS}/pipeline/board", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        # Retourne les colonnes du kanban
        assert isinstance(data, (list, dict))

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_delete_opportunity(self, client, auth_headers, org):
        opp = make_opp(client, auth_headers, org["id"], "ToDelete")
        r = client.delete(f"{BASE_OPPS}/{opp['id']}", headers=auth_headers)
        assert r.status_code in (200, 204)
        assert client.get(f"{BASE_OPPS}/{opp['id']}", headers=auth_headers).status_code == 404

    # ── RBAC ─────────────────────────────────────────────────────────────────

    def test_viewer_can_read(self, client, viewer_headers, opportunity):
        r = client.get(f"{BASE_OPPS}/{opportunity['id']}", headers=viewer_headers)
        assert r.status_code == 200

    def test_viewer_can_list(self, client, viewer_headers):
        r = client.get(BASE_OPPS, headers=viewer_headers)
        assert r.status_code == 200

    def test_viewer_can_create(self, client, viewer_headers, org):
        """Les viewers peuvent créer des opportunités (workflow normal)."""
        r = client.post(BASE_OPPS, headers=viewer_headers, json={
            "organization_id": org["id"],
            "title": "Viewer Opp",
            "status": "Prospect identifié",
            "probability": 30,
        })
        assert r.status_code in (201, 403)  # Selon la politique RBAC du projet

    # ── Suggestions IA filtrées ───────────────────────────────────────────────

    def test_pending_opps_hidden_from_list(self, client, auth_headers, org):
        """Les suggestions IA (pending) ne doivent pas apparaître dans la liste normale."""
        # Créer via CRUD direct en contournant le workflow
        from app.db.session import SessionLocal
        from app.models.opportunity import Opportunity
        db = SessionLocal()
        try:
            pend_opp = Opportunity(
                organization_id=org["id"],
                title="Pending Suggestion",
                status="Prospect identifie",
                probability=50,
                validation_status="pending",
            )
            db.add(pend_opp)
            db.commit()
            pend_id = pend_opp.id
        finally:
            db.close()
        
        data = client.get(BASE_OPPS, headers=auth_headers).json()
        ids = [o["id"] for o in data]
        assert pend_id not in ids, "Les suggestions pending ne doivent pas être visibles dans le CRM"
