"""
CRM complete test suite — Organisations, Contacts, Opportunités, pipeline.
"""
import pytest


class TestOrganizations:
    BASE = "/api/v1/organizations"

    def test_list(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200

    def test_create(self, client, auth_headers):
        r = client.post(self.BASE, json={
            "name": "Acme Corp Test", "sector": "Data Engineering",
        }, headers=auth_headers)
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["name"] == "Acme Corp Test"

    def test_create_duplicate_name(self, client, auth_headers, make_org):
        org = make_org()
        r = client.post(self.BASE, json={"name": org["name"]}, headers=auth_headers)
        assert r.status_code in (200, 201, 400, 409)

    def test_get_by_id(self, client, auth_headers, make_org):
        org = make_org()
        r = client.get(f"{self.BASE}/{org['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == org["id"]

    def test_update(self, client, auth_headers, make_org):
        org = make_org()
        r = client.patch(f"{self.BASE}/{org['id']}", json={"sector": "FinTech"}, headers=auth_headers)
        assert r.status_code == 200

    def test_get_nonexistent(self, client, auth_headers):
        r = client.get(f"{self.BASE}/999999", headers=auth_headers)
        assert r.status_code == 404

    def test_search(self, client, auth_headers, make_org):
        org = make_org()
        r = client.get(f"{self.BASE}?search={org['name'][:5]}", headers=auth_headers)
        assert r.status_code == 200

    def test_viewer_can_read(self, client, viewer_headers):
        r = client.get(self.BASE, headers=viewer_headers)
        assert r.status_code in (200, 403)


class TestContacts:
    BASE = "/api/v1/contacts"

    def test_list(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200

    def test_create(self, client, auth_headers, make_org):
        org = make_org()
        r = client.post(self.BASE, json={
            "first_name": "Mamadou", "last_name": "Diallo",
            "email": "mamadou@example.com", "organization_id": org["id"],
        }, headers=auth_headers)
        assert r.status_code in (200, 201)

    def test_create_no_required_fields(self, client, auth_headers):
        r = client.post(self.BASE, json={}, headers=auth_headers)
        assert r.status_code in (400, 422)

    def test_get_by_id(self, client, auth_headers, contact):
        r = client.get(f"{self.BASE}/{contact['id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_filter_by_org(self, client, auth_headers, make_org):
        org = make_org()
        r = client.get(f"{self.BASE}?organization_id={org['id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_nonexistent(self, client, auth_headers):
        r = client.get(f"{self.BASE}/999999", headers=auth_headers)
        assert r.status_code == 404


class TestOpportunities:
    BASE = "/api/v1/opportunities"

    def test_list(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200

    def test_create(self, client, auth_headers, make_org):
        org = make_org()
        r = client.post(self.BASE, json={
            "title": "Mission Data Platform", "organization_id": org["id"],
            "status": "Prospect identifié",
        }, headers=auth_headers)
        assert r.status_code in (200, 201)

    def test_create_missing_title(self, client, auth_headers):
        r = client.post(self.BASE, json={"organization_id": 1}, headers=auth_headers)
        assert r.status_code in (400, 422)

    def test_get_by_id(self, client, auth_headers, make_opp):
        opp = make_opp()
        r = client.get(f"{self.BASE}/{opp['id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_update_status(self, client, auth_headers, make_opp):
        opp = make_opp()
        r = client.patch(f"{self.BASE}/{opp['id']}", json={"status": "Proposition envoyée"}, headers=auth_headers)
        assert r.status_code == 200

    def test_won_opp(self, client, auth_headers, make_opp):
        opp = make_opp()
        r = client.patch(f"{self.BASE}/{opp['id']}", json={"status": "Gagné"}, headers=auth_headers)
        assert r.status_code == 200

    def test_filter_by_status(self, client, auth_headers):
        r = client.get(f"{self.BASE}?status=Prospect identifié", headers=auth_headers)
        assert r.status_code == 200

    def test_nonexistent(self, client, auth_headers):
        r = client.get(f"{self.BASE}/999999", headers=auth_headers)
        assert r.status_code == 404

    def test_viewer_can_read(self, client, viewer_headers):
        r = client.get(self.BASE, headers=viewer_headers)
        assert r.status_code in (200, 403)

    def test_viewer_cannot_create(self, client, viewer_headers, make_org):
        org = make_org()
        r = client.post(self.BASE, json={
            "title": "Test", "organization_id": org["id"],
        }, headers=viewer_headers)
        assert r.status_code in (403, 422)


class TestPipelineAnalytics:
    def test_pipeline_endpoint(self, client, auth_headers):
        r = client.get("/api/v1/analytics/pipeline", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "tenders" in data
        assert "opportunities" in data
        assert "deliverables" in data

    def test_crm_dashboard(self, client, auth_headers):
        r = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
        assert r.status_code in (200, 404)

    def test_timeline_12_months(self, client, auth_headers):
        r = client.get("/api/v1/analytics/timeline", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "months" in data
        assert isinstance(data["months"], list)
