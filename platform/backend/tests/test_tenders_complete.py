"""
Tenders complete test suite.
Covers: CRUD, requirements, Go/No-Go criteria, compliance matrix,
recommendation engine, workflow, RBAC.
"""
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_tender(client, headers, opportunity_id, ref_suffix=""):
    r = client.post("/api/v1/tenders", headers=headers, json={
        "opportunity_id": opportunity_id,
        "title": f"Appel d'offres test {ref_suffix}",
        "reference": f"AO-TEST-{ref_suffix or '001'}",
        "buyer_name": "Ministère Test",
        "status": "draft",
    })
    assert r.status_code == 201, r.json()
    return r.json()


# ══════════════════════════════════════════════════════════════════════════════
# TENDERS
# ══════════════════════════════════════════════════════════════════════════════

class TestTenders:
    BASE = "/api/v1/tenders"

    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_create_tender(self, client, auth_headers, opportunity):
        r = client.post(self.BASE, headers=auth_headers, json={
            "opportunity_id": opportunity["id"],
            "title": "Nouveau AO",
            "reference": "REF-001",
            "buyer_name": "ACME Gov",
            "status": "draft",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Nouveau AO"
        assert data["opportunity_id"] == opportunity["id"]

    def test_create_requires_opportunity(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "title": "No Opp Tender", "status": "draft",
        })
        assert r.status_code == 422

    def test_create_invalid_opportunity(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "opportunity_id": 999999, "title": "Bad Opp", "status": "draft",
        })
        assert r.status_code in (400, 404, 422)

    def test_create_missing_title(self, client, auth_headers, opportunity):
        r = client.post(self.BASE, headers=auth_headers, json={
            "opportunity_id": opportunity["id"], "status": "draft",
        })
        assert r.status_code == 422

    def test_read_tender(self, client, auth_headers, tender):
        r = client.get(f"{self.BASE}/{tender['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == tender["id"]

    def test_read_not_found(self, client, auth_headers):
        assert client.get(f"{self.BASE}/999999", headers=auth_headers).status_code == 404

    def test_list_tenders(self, client, auth_headers, tender):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        assert any(t["id"] == tender["id"] for t in r.json())

    def test_list_excludes_pending(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        for t in r.json():
            assert t.get("validation_status") != "pending"

    def test_update_tender(self, client, auth_headers, tender):
        r = client.patch(f"{self.BASE}/{tender['id']}", headers=auth_headers, json={
            "status": "analysing", "buyer_name": "Updated Ministry",
        })
        assert r.status_code == 200
        assert r.json()["buyer_name"] == "Updated Ministry"

    def test_update_not_found(self, client, auth_headers):
        r = client.patch(f"{self.BASE}/999999", headers=auth_headers, json={"status": "draft"})
        assert r.status_code == 404

    def test_delete_tender(self, client, auth_headers, opportunity):
        t = make_tender(client, auth_headers, opportunity["id"], "del")
        assert client.delete(f"{self.BASE}/{t['id']}", headers=auth_headers).status_code in (200, 204)
        assert client.get(f"{self.BASE}/{t['id']}", headers=auth_headers).status_code == 404

    def test_viewer_can_read(self, client, viewer_headers, tender):
        r = client.get(f"/api/v1/tenders/{tender['id']}", headers=viewer_headers)
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# TENDER REQUIREMENTS
# ══════════════════════════════════════════════════════════════════════════════

class TestTenderRequirements:
    def make_req(self, client, headers, tender_id, ref="REQ-01"):
        r = client.post(f"/api/v1/tenders/{tender_id}/requirements", headers=headers, json={
            "code": ref,
            "description": "Description de l'exigence",
            "requirement_type": "technical",
            "is_mandatory": True,
        })
        assert r.status_code == 201, r.json()
        return r.json()

    def test_create_requirement(self, client, auth_headers, tender):
        req = self.make_req(client, auth_headers, tender["id"])
        assert req["code"] == "REQ-01"
        assert req["tender_id"] == tender["id"]

    def test_list_requirements(self, client, auth_headers, tender):
        self.make_req(client, auth_headers, tender["id"])
        r = client.get(f"/api/v1/tenders/{tender['id']}/requirements", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_update_requirement(self, client, auth_headers, tender):
        req = self.make_req(client, auth_headers, tender["id"])
        r = client.patch(f"/api/v1/tenders/requirements/{req['id']}", headers=auth_headers, json={
            "is_mandatory": False
        })
        assert r.status_code == 200
        assert r.json()["is_mandatory"] is False

    def test_delete_requirement(self, client, auth_headers, tender):
        req = self.make_req(client, auth_headers, tender["id"])
        r = client.delete(f"/api/v1/tenders/requirements/{req['id']}", headers=auth_headers)
        assert r.status_code in (200, 204)

    def test_requirement_wrong_tender_rejected(self, client, auth_headers, tender, opportunity):
        """Requirement must be linked to the right tender_id."""
        t2 = make_tender(client, auth_headers, opportunity["id"], "002")
        req = self.make_req(client, auth_headers, tender["id"])
        # Trying to access via wrong tender
        r = client.get(f"/api/v1/tenders/{t2['id']}/requirements", headers=auth_headers)
        ids = [x["id"] for x in r.json()]
        assert req["id"] not in ids


# ══════════════════════════════════════════════════════════════════════════════
# GO/NO-GO
# ══════════════════════════════════════════════════════════════════════════════

class TestGoNoGo:
    GBASE = "/api/v1/tender-governance"

    def make_criterion(self, client, headers, tender_id, name="Critère 1", score=4):
        r = client.post(f"{self.GBASE}/tenders/{tender_id}/go-no-go", headers=headers, json={
            "tender_id": tender_id,
            "name": name,
            "score": score,
            "weight": 2,
            "max_score": 5,
            "rationale": "Rationale test",
        })
        assert r.status_code == 201, r.json()
        return r.json()

    def test_requires_auth(self, client, tender):
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/go-no-go")
        assert r.status_code == 401

    def test_create_criterion(self, client, auth_headers, tender):
        c = self.make_criterion(client, auth_headers, tender["id"])
        assert c["name"] == "Critère 1"
        assert c["score"] == 4
        assert c["tender_id"] == tender["id"]

    def test_list_criteria(self, client, auth_headers, tender):
        self.make_criterion(client, auth_headers, tender["id"])
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/go-no-go", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_update_criterion(self, client, auth_headers, tender):
        c = self.make_criterion(client, auth_headers, tender["id"])
        r = client.patch(f"{self.GBASE}/go-no-go/{c['id']}", headers=auth_headers, json={
            "score": 2, "rationale": "Updated rationale"
        })
        assert r.status_code == 200
        assert r.json()["score"] == 2

    def test_delete_criterion(self, client, auth_headers, tender):
        c = self.make_criterion(client, auth_headers, tender["id"])
        r = client.delete(f"{self.GBASE}/go-no-go/{c['id']}", headers=auth_headers)
        assert r.status_code in (200, 204)

    def test_summary_calculation(self, client, auth_headers, tender):
        """Summary should compute weighted score from criteria."""
        self.make_criterion(client, auth_headers, tender["id"], "C1", score=4)
        self.make_criterion(client, auth_headers, tender["id"], "C2", score=3)
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/go-no-go/summary", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "weighted_score" in data
        assert "percentage" in data
        assert "recommendation" in data
        assert data["criteria_count"] == 2

    def test_summary_empty_criteria(self, client, auth_headers, tender):
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/go-no-go/summary", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["criteria_count"] == 0

    def test_recommendation_endpoint(self, client, auth_headers, tender):
        self.make_criterion(client, auth_headers, tender["id"], score=5)
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/go-no-go/recommendation", headers=auth_headers)
        assert r.status_code == 200

    def test_criterion_negative_score_rejected(self, client, auth_headers, tender):
        r = client.post(f"{self.GBASE}/tenders/{tender['id']}/go-no-go", headers=auth_headers, json={
            "tender_id": tender["id"], "name": "Bad Score", "score": -1,
        })
        assert r.status_code == 422

    def test_criterion_invalid_weight(self, client, auth_headers, tender):
        r = client.post(f"{self.GBASE}/tenders/{tender['id']}/go-no-go", headers=auth_headers, json={
            "tender_id": tender["id"], "name": "Bad Weight", "score": 3, "weight": 0,
        })
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# COMPLIANCE MATRIX
# ══════════════════════════════════════════════════════════════════════════════

class TestComplianceMatrix:
    GBASE = "/api/v1/tender-governance"

    def make_item(self, client, headers, tender_id, summary="Exigence test"):
        r = client.post(f"{self.GBASE}/tenders/{tender_id}/compliance", headers=headers, json={
            "tender_id": tender_id,
            "requirement_summary": summary,
            "compliance_status": "to_review",
        })
        assert r.status_code == 201, r.json()
        return r.json()

    def test_requires_auth(self, client, tender):
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/compliance")
        assert r.status_code == 401

    def test_create_compliance_item(self, client, auth_headers, tender):
        item = self.make_item(client, auth_headers, tender["id"])
        assert item["requirement_summary"] == "Exigence test"
        assert item["compliance_status"] == "to_review"
        assert item["tender_id"] == tender["id"]

    def test_list_compliance_items(self, client, auth_headers, tender):
        self.make_item(client, auth_headers, tender["id"])
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/compliance", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_update_compliance_status(self, client, auth_headers, tender):
        item = self.make_item(client, auth_headers, tender["id"])
        r = client.patch(f"{self.GBASE}/compliance/{item['id']}", headers=auth_headers, json={
            "compliance_status": "compliant",
            "evidence": "Section 3.2 du mémoire",
        })
        assert r.status_code == 200
        assert r.json()["compliance_status"] == "compliant"

    def test_delete_compliance_item(self, client, auth_headers, tender):
        item = self.make_item(client, auth_headers, tender["id"])
        r = client.delete(f"{self.GBASE}/compliance/{item['id']}", headers=auth_headers)
        assert r.status_code in (200, 204)

    def test_compliance_summary(self, client, auth_headers, tender):
        self.make_item(client, auth_headers, tender["id"], "Exigence 1")
        self.make_item(client, auth_headers, tender["id"], "Exigence 2")
        # Update one to compliant
        items = client.get(f"{self.GBASE}/tenders/{tender['id']}/compliance", headers=auth_headers).json()
        client.patch(f"{self.GBASE}/compliance/{items[0]['id']}", headers=auth_headers, json={
            "compliance_status": "compliant"
        })
        r = client.get(f"{self.GBASE}/tenders/{tender['id']}/compliance/summary", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_items" in data
        assert "compliant" in data
        assert "compliance_rate" in data
        assert data["total_items"] == 2
        assert data["compliant"] == 1

    def test_requirement_summary_too_short(self, client, auth_headers, tender):
        r = client.post(f"{self.GBASE}/tenders/{tender['id']}/compliance", headers=auth_headers, json={
            "tender_id": tender["id"], "requirement_summary": "X",
        })
        assert r.status_code == 422

    def test_all_compliance_statuses_valid(self, client, auth_headers, tender):
        statuses = ["to_review", "compliant", "partial", "gap"]
        for status in statuses:
            item = self.make_item(client, auth_headers, tender["id"], f"Exig {status}")
            r = client.patch(f"{self.GBASE}/compliance/{item['id']}", headers=auth_headers, json={
                "compliance_status": status
            })
            assert r.status_code == 200
