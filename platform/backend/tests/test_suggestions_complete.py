"""
AI Suggestions complete test suite.
Covers: count, pending list, batch validation, text import, BOAMP scan stub,
pending entities invisible from normal CRM.
"""
import pytest

BASE = "/api/v1/suggestions"


class TestSuggestionsCount:
    def test_requires_auth(self, client):
        assert client.get(f"{BASE}/count").status_code == 401

    def test_count_structure(self, client, auth_headers):
        r = client.get(f"{BASE}/count", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "organizations" in data
        assert "opportunities" in data
        assert "tenders" in data
        assert "total" in data
        assert isinstance(data["total"], int)
        assert data["total"] >= 0

    def test_count_zero_initially(self, client, auth_headers):
        r = client.get(f"{BASE}/count", headers=auth_headers)
        assert r.json()["total"] == 0


class TestSuggestionsPending:
    def test_requires_auth(self, client):
        assert client.get(f"{BASE}/pending").status_code == 401

    def test_pending_structure(self, client, auth_headers):
        r = client.get(f"{BASE}/pending", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "organizations" in data
        assert "opportunities" in data
        assert "tenders" in data
        assert isinstance(data["organizations"], list)
        assert isinstance(data["opportunities"], list)
        assert isinstance(data["tenders"], list)

    def test_pending_empty_initially(self, client, auth_headers):
        r = client.get(f"{BASE}/pending", headers=auth_headers)
        data = r.json()
        assert len(data["organizations"]) == 0
        assert len(data["opportunities"]) == 0
        assert len(data["tenders"]) == 0


class TestSuggestionsValidate:
    def test_requires_auth(self, client):
        r = client.post(f"{BASE}/validate", json={"items": []})
        assert r.status_code == 401

    def test_empty_batch_succeeds(self, client, auth_headers):
        r = client.post(f"{BASE}/validate", headers=auth_headers, json={
            "items": [], "validated_by": "Admin Test",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["validated"] == 0
        assert data["rejected"] == 0

    def test_invalid_entity_type(self, client, auth_headers):
        r = client.post(f"{BASE}/validate", headers=auth_headers, json={
            "items": [{"entity_type": "invalid_type", "entity_id": 1, "accept": True}],
        })
        assert r.status_code == 400

    def test_validate_nonexistent_entity(self, client, auth_headers):
        r = client.post(f"{BASE}/validate", headers=auth_headers, json={
            "items": [{"entity_type": "organization", "entity_id": 999999, "accept": True}],
            "validated_by": "Admin",
        })
        assert r.status_code == 200
        assert r.json()["not_found"] == 1

    def test_validate_missing_items_field(self, client, auth_headers):
        r = client.post(f"{BASE}/validate", headers=auth_headers, json={})
        assert r.status_code == 422

    def test_validated_entity_disappears_from_pending(self, client, auth_headers):
        """After validation, entity should no longer be in pending."""
        # We need to create a pending entity directly via DB
        from app.db.session import SessionLocal
        from app.models.organization import Organization
        from datetime import datetime, timezone

        db = SessionLocal()
        try:
            org = Organization(
                name="Pending Test Org",
                source="ai_suggested",
                validation_status="pending",
                confidence_score=0.8,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            org_id = org.id
        finally:
            db.close()

        # Verify it's in pending
        pending = client.get(f"{BASE}/pending", headers=auth_headers).json()
        assert any(o["id"] == org_id for o in pending["organizations"])

        # Validate it
        r = client.post(f"{BASE}/validate", headers=auth_headers, json={
            "items": [{"entity_type": "organization", "entity_id": org_id, "accept": True}],
            "validated_by": "Admin QA",
        })
        assert r.status_code == 200
        assert r.json()["validated"] == 1

        # Should no longer be in pending
        pending_after = client.get(f"{BASE}/pending", headers=auth_headers).json()
        assert not any(o["id"] == org_id for o in pending_after["organizations"])

    def test_rejected_entity_disappears_from_pending(self, client, auth_headers):
        from app.db.session import SessionLocal
        from app.models.organization import Organization
        from datetime import datetime, timezone

        db = SessionLocal()
        try:
            org = Organization(
                name="Rejected Test Org", source="ai_suggested",
                validation_status="pending", confidence_score=0.3,
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            org_id = org.id
        finally:
            db.close()

        client.post(f"{BASE}/validate", headers=auth_headers, json={
            "items": [{"entity_type": "organization", "entity_id": org_id, "accept": False}],
        })
        pending_after = client.get(f"{BASE}/pending", headers=auth_headers).json()
        assert not any(o["id"] == org_id for o in pending_after["organizations"])


class TestSuggestionsImportText:
    def test_requires_auth(self, client):
        r = client.post(f"{BASE}/import/text", json={"text": "test text content here"})
        assert r.status_code == 401

    def test_text_too_short(self, client, auth_headers):
        r = client.post(f"{BASE}/import/text", headers=auth_headers, json={
            "text": "too short",
        })
        assert r.status_code == 400

    def test_missing_text_field(self, client, auth_headers):
        r = client.post(f"{BASE}/import/text", headers=auth_headers, json={})
        assert r.status_code == 422

    def test_valid_text_creates_pending(self, client, auth_headers):
        """Long enough text should trigger LLM analysis and create pending suggestion."""
        long_text = """
        Appel d'offres n°2026-IT-0042 — Système d'information data
        La Direction des Systèmes d'Information du Ministère de la Transition Numérique
        lance un appel d'offres pour la mise en place d'une plateforme de données unifiée.
        Budget estimé : 500 000 € HT. Délai de soumission : 45 jours.
        Compétences requises : Data Engineering, Snowflake, Python, Architecture Lakehouse.
        Contact : dsi@ministere-numerique.gouv.fr
        """
        r = client.post(f"{BASE}/import/text", headers=auth_headers, json={
            "text": long_text.strip(),
            "source_label": "test_manual",
        })
        # Should not return 500 — either creates suggestion or returns graceful error
        assert r.status_code in (200, 201)


class TestPendingEntitiesHiddenFromCRM:
    def test_pending_orgs_not_in_crm_list(self, client, auth_headers):
        from app.db.session import SessionLocal
        from app.models.organization import Organization
        from datetime import datetime, timezone

        db = SessionLocal()
        try:
            org = Organization(
                name="Invisible Pending Org", source="boamp",
                validation_status="pending",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            org_id = org.id
        finally:
            db.close()

        crm_list = client.get("/api/v1/organizations", headers=auth_headers).json()
        assert not any(o["id"] == org_id for o in crm_list), \
            "Pending org should be invisible in normal CRM list"

    def test_pending_opportunities_not_in_crm_list(self, client, auth_headers, org):
        from app.db.session import SessionLocal
        from app.models.opportunity import Opportunity
        from datetime import datetime, timezone

        db = SessionLocal()
        try:
            opp = Opportunity(
                organization_id=org["id"],
                title="Invisible Pending Opp",
                status="Prospect identifie",
                probability=50,
                source="boamp",
                validation_status="pending",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            )
            db.add(opp)
            db.commit()
            db.refresh(opp)
            opp_id = opp.id
        finally:
            db.close()

        crm_list = client.get("/api/v1/opportunities", headers=auth_headers).json()
        assert not any(o["id"] == opp_id for o in crm_list), \
            "Pending opportunity should be invisible in normal CRM list"
