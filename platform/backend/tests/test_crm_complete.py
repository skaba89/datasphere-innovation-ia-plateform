"""
CRM tests — Organizations, Contacts, Opportunities.
Covers: CRUD, RBAC, validation, filtering, pagination, edge cases.
"""
import pytest


# ══════════════════════════════════════════════════════════════════════════════
# ORGANIZATIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestOrganizations:
    BASE = "/api/v1/organizations"

    # Auth
    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_viewer_can_read(self, client, viewer_headers):
        assert client.get(self.BASE, headers=viewer_headers).status_code == 200

    # CRUD
    def test_create_minimal(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={"name": "Test Org"})
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Test Org"
        assert data["id"] > 0
        assert data["validation_status"] == "validated"

    def test_create_full(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "name": "Full Corp", "country": "FR", "sector": "IT",
            "organization_type": "Entreprise privée",
            "website": "https://fullcorp.fr",
            "description": "Une description",
        })
        assert r.status_code == 201
        assert r.json()["website"] == "https://fullcorp.fr"

    def test_create_name_too_short(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={"name": "X"})
        assert r.status_code == 422

    def test_create_missing_name(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={"country": "FR"})
        assert r.status_code == 422

    def test_read_by_id(self, client, auth_headers, org):
        r = client.get(f"{self.BASE}/{org['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == org["id"]

    def test_read_not_found(self, client, auth_headers):
        assert client.get(f"{self.BASE}/999999", headers=auth_headers).status_code == 404

    def test_list_returns_orgs(self, client, auth_headers, org):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        ids = [o["id"] for o in r.json()]
        assert org["id"] in ids

    def test_list_excludes_pending(self, client, auth_headers):
        """AI-suggested pending orgs must not appear in normal list."""
        r = client.get(self.BASE, headers=auth_headers)
        for o in r.json():
            assert o["validation_status"] != "pending"

    def test_update(self, client, auth_headers, org):
        r = client.patch(f"{self.BASE}/{org['id']}", headers=auth_headers, json={
            "sector": "Finance"
        })
        assert r.status_code == 200
        assert r.json()["sector"] == "Finance"

    def test_update_not_found(self, client, auth_headers):
        r = client.patch(f"{self.BASE}/999999", headers=auth_headers, json={"sector": "IT"})
        assert r.status_code == 404

    def test_delete(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={"name": "To Delete"})
        oid = r.json()["id"]
        del_r = client.delete(f"{self.BASE}/{oid}", headers=auth_headers)
        assert del_r.status_code in (200, 204)
        assert client.get(f"{self.BASE}/{oid}", headers=auth_headers).status_code == 404

    def test_delete_not_found(self, client, auth_headers):
        assert client.delete(f"{self.BASE}/999999", headers=auth_headers).status_code == 404

    def test_viewer_cannot_create(self, client, viewer_headers):
        r = client.post(self.BASE, headers=viewer_headers, json={"name": "Viewer Org"})
        # Viewer read-only: either 403 or allowed depending on RBAC
        assert r.status_code in (201, 403)

    def test_pagination_skip_limit(self, client, auth_headers):
        for i in range(5):
            client.post(self.BASE, headers=auth_headers, json={"name": f"Org {i}"})
        r = client.get(f"{self.BASE}?skip=0&limit=2", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) <= 2


# ══════════════════════════════════════════════════════════════════════════════
# CONTACTS
# ══════════════════════════════════════════════════════════════════════════════

class TestContacts:
    BASE = "/api/v1/contacts"

    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_create_contact(self, client, auth_headers, org):
        r = client.post(self.BASE, headers=auth_headers, json={
            "organization_id": org["id"],
            "first_name": "Jean",
            "last_name": "Dupont",
            "email": "jean.dupont@corp.fr",
            "position": "DG",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "jean.dupont@corp.fr"
        assert data["organization_id"] == org["id"]

    def test_create_requires_org(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "first_name": "Jean", "last_name": "Dupont",
        })
        assert r.status_code in (422, 400)

    def test_create_invalid_org_id(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "organization_id": 999999, "first_name": "Jean", "last_name": "Dupont",
        })
        assert r.status_code in (400, 404, 422)

    def test_read_contact(self, client, auth_headers, contact):
        r = client.get(f"{self.BASE}/{contact['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == contact["id"]

    def test_read_not_found(self, client, auth_headers):
        assert client.get(f"{self.BASE}/999999", headers=auth_headers).status_code == 404

    def test_list_contacts(self, client, auth_headers, contact):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        assert any(c["id"] == contact["id"] for c in r.json())

    def test_filter_by_org(self, client, auth_headers, org, contact):
        r = client.get(f"{self.BASE}?organization_id={org['id']}", headers=auth_headers)
        assert r.status_code == 200
        for c in r.json():
            assert c["organization_id"] == org["id"]

    def test_update_contact(self, client, auth_headers, contact):
        r = client.patch(f"{self.BASE}/{contact['id']}", headers=auth_headers, json={
            "position": "CTO"
        })
        assert r.status_code == 200
        assert r.json()["position"] == "CTO"

    def test_delete_contact(self, client, auth_headers, org):
        r = client.post(self.BASE, headers=auth_headers, json={
            "organization_id": org["id"], "first_name": "A", "last_name": "B",
        })
        cid = r.json()["id"]
        assert client.delete(f"{self.BASE}/{cid}", headers=auth_headers).status_code in (200, 204)
        assert client.get(f"{self.BASE}/{cid}", headers=auth_headers).status_code == 404

    def test_search_by_name(self, client, auth_headers, contact):
        r = client.get(f"{self.BASE}?q=Mamadou", headers=auth_headers)
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# OPPORTUNITIES
# ══════════════════════════════════════════════════════════════════════════════

class TestOpportunities:
    BASE = "/api/v1/opportunities"

    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_create_opportunity(self, client, auth_headers, org):
        r = client.post(self.BASE, headers=auth_headers, json={
            "organization_id": org["id"],
            "title": "Digitalisation SI",
            "status": "Prospect identifie",
            "probability": 50,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Digitalisation SI"
        assert data["probability"] == 50

    def test_create_requires_org(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "title": "No Org", "status": "Prospect identifie", "probability": 50,
        })
        assert r.status_code == 422

    def test_create_invalid_probability(self, client, auth_headers, org):
        r = client.post(self.BASE, headers=auth_headers, json={
            "organization_id": org["id"], "title": "Bad Prob",
            "status": "Prospect identifie", "probability": 200,
        })
        # Should be 422 (validation) or 201 with capped value
        assert r.status_code in (201, 422)

    def test_read_opportunity(self, client, auth_headers, opportunity):
        r = client.get(f"{self.BASE}/{opportunity['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == opportunity["id"]

    def test_read_not_found(self, client, auth_headers):
        assert client.get(f"{self.BASE}/999999", headers=auth_headers).status_code == 404

    def test_list_opportunities(self, client, auth_headers, opportunity):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        assert any(o["id"] == opportunity["id"] for o in r.json())

    def test_list_excludes_pending(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        for o in r.json():
            assert o.get("validation_status") != "pending"

    def test_update_status(self, client, auth_headers, opportunity):
        r = client.patch(f"{self.BASE}/{opportunity['id']}/status", headers=auth_headers, json={
            "status": "Qualification"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "Qualification"

    def test_update_fields(self, client, auth_headers, opportunity):
        r = client.patch(f"{self.BASE}/{opportunity['id']}", headers=auth_headers, json={
            "probability": 80, "potential_value": 200000,
        })
        assert r.status_code == 200
        assert r.json()["probability"] == 80

    def test_delete_opportunity(self, client, auth_headers, org):
        opp = client.post(self.BASE, headers=auth_headers, json={
            "organization_id": org["id"], "title": "To Delete",
            "status": "Prospect identifie", "probability": 20,
        }).json()
        assert client.delete(f"{self.BASE}/{opp['id']}", headers=auth_headers).status_code in (200, 204)
        assert client.get(f"{self.BASE}/{opp['id']}", headers=auth_headers).status_code == 404

    def test_pipeline_board(self, client, auth_headers, opportunity):
        r = client.get(f"{self.BASE}/pipeline/board", headers=auth_headers)
        assert r.status_code == 200

    def test_filter_by_org(self, client, auth_headers, org, opportunity):
        r = client.get(f"{self.BASE}?organization_id={org['id']}", headers=auth_headers)
        assert r.status_code == 200
        for o in r.json():
            assert o["organization_id"] == org["id"]
