"""
Tests for commercial features:
- Go/No-Go AI recommendation
- Sector templates (install, list, apply)
- Email preview
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


def _create_tender_with_criteria(client, headers):
    org = client.post("/api/v1/organizations", json={
        "name": "ARPT GoNoGo Test", "country": "Guinée", "sector": "Telecom",
    }, headers=headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Mission GoNoGo Test",
        "priority": "Haute",
        "status": "Besoin qualifié",
        "probability": 65,
        "potential_value": "80000.00",
    }, headers=headers).json()
    tender = client.post("/api/v1/tenders", json={
        "opportunity_id": opp["id"],
        "reference": "ARPT-GoNoGo-001",
        "title": "Plateforme data et IA — GoNoGo test",
        "buyer_name": "ARPT",
        "go_no_go_decision": "Go",
        "go_no_go_score": 78,
        "status": "draft",
    }, headers=headers).json()

    # Add criteria
    for c in [
        {"name": "Adéquation technique", "score": 8, "weight": 3, "description": "Stack data maîtrisé"},
        {"name": "Expérience sectorielle", "score": 9, "weight": 2, "description": "Références télécom solides"},
        {"name": "Capacité équipe", "score": 7, "weight": 2, "description": "Profils disponibles"},
        {"name": "Budget", "score": 6, "weight": 1, "description": "Marge acceptable"},
    ]:
        client.post(f"/api/v1/tender-governance/tenders/{tender['id']}/go-no-go", json={
            **c, "tender_id": tender["id"],
        }, headers=headers)

    return tender["id"], opp["id"]


# ── Go/No-Go Recommendation ───────────────────────────────────────────────────

def test_gonogo_recommendation_requires_auth(client):
    resp = client.get("/api/v1/tender-governance/tenders/1/go-no-go/recommendation")
    assert resp.status_code == 401


def test_gonogo_recommendation_not_found(client, auth_headers):
    resp = client.get("/api/v1/tender-governance/tenders/9999/go-no-go/recommendation", headers=auth_headers)
    assert resp.status_code == 404


def test_gonogo_recommendation_structure(client, auth_headers):
    tender_id, _ = _create_tender_with_criteria(client, auth_headers)
    resp = client.get(
        f"/api/v1/tender-governance/tenders/{tender_id}/go-no-go/recommendation",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Required fields
    assert "decision" in data
    assert "confidence" in data
    assert "summary" in data
    assert "reasoning" in data
    assert "risks" in data
    assert "opportunities" in data
    assert "recommended_actions" in data
    assert "score_global" in data
    assert "score_percentage" in data
    assert "provider" in data
    assert "computed_at" in data


def test_gonogo_recommendation_decision_values(client, auth_headers):
    tender_id, _ = _create_tender_with_criteria(client, auth_headers)
    data = client.get(
        f"/api/v1/tender-governance/tenders/{tender_id}/go-no-go/recommendation",
        headers=auth_headers,
    ).json()
    assert data["decision"] in ("Go", "No-Go", "Go conditionnel")
    assert 0 <= data["confidence"] <= 100
    assert data["score_percentage"] >= 0
    assert isinstance(data["risks"], list)
    assert isinstance(data["opportunities"], list)


def test_gonogo_recommendation_risks_structure(client, auth_headers):
    tender_id, _ = _create_tender_with_criteria(client, auth_headers)
    data = client.get(
        f"/api/v1/tender-governance/tenders/{tender_id}/go-no-go/recommendation",
        headers=auth_headers,
    ).json()
    for risk in data["risks"]:
        assert "level" in risk
        assert "description" in risk
        assert risk["level"] in ("high", "medium", "low")


def test_gonogo_recommendation_without_criteria(client, auth_headers):
    """GoNoGo recommendation still works without criteria (uses rule-based fallback)."""
    org = client.post("/api/v1/organizations", json={
        "name": "Empty Criteria Org", "country": "FR", "sector": "IT"
    }, headers=auth_headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Test no criteria",
        "priority": "Normale",
        "status": "Besoin qualifié",
        "probability": 40,
    }, headers=auth_headers).json()
    tender = client.post("/api/v1/tenders", json={
        "opportunity_id": opp["id"],
        "reference": "T-001",
        "title": "Tender without criteria",
        "buyer_name": "TestBuyer",
        "go_no_go_score": 45,
        "status": "draft",
    }, headers=auth_headers).json()

    resp = client.get(
        f"/api/v1/tender-governance/tenders/{tender['id']}/go-no-go/recommendation",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "decision" in resp.json()


# ── Sector Templates ──────────────────────────────────────────────────────────

def test_sector_templates_requires_auth(client):
    assert client.get("/api/v1/sector-templates").status_code == 401


def test_sector_templates_install_idempotent(client, auth_headers):
    r1 = client.post("/api/v1/sector-templates/install", headers=auth_headers)
    assert r1.status_code == 201
    count1 = len(r1.json())
    assert count1 >= 10  # 5 sectors × 2 types minimum

    r2 = client.post("/api/v1/sector-templates/install", headers=auth_headers)
    assert r2.status_code == 201
    assert len(r2.json()) == count1  # idempotent — same count


def test_sector_templates_list(client, auth_headers):
    client.post("/api/v1/sector-templates/install", headers=auth_headers)
    resp = client.get("/api/v1/sector-templates", headers=auth_headers)
    assert resp.status_code == 200
    templates = resp.json()
    assert len(templates) >= 10
    for t in templates:
        assert "sector_key" in t
        assert "deliverable_type" in t
        assert "content_markdown" not in t  # not in SectorTemplateRead schema
        assert t["is_builtin"] is True


def test_sector_templates_filter_by_sector(client, auth_headers):
    client.post("/api/v1/sector-templates/install", headers=auth_headers)
    resp = client.get("/api/v1/sector-templates?sector_key=telecom", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    for t in data:
        assert t["sector_key"] == "telecom"


def test_sector_templates_list_sectors(client, auth_headers):
    resp = client.get("/api/v1/sector-templates/sectors", headers=auth_headers)
    assert resp.status_code == 200
    sectors = resp.json()
    keys = [s["key"] for s in sectors]
    assert "telecom" in keys
    assert "finance" in keys
    assert "public" in keys
    assert "energy" in keys
    assert "it_digital" in keys


def test_sector_template_apply(client, auth_headers):
    client.post("/api/v1/sector-templates/install", headers=auth_headers)
    org = client.post("/api/v1/organizations", json={
        "name": "Telecom Test Apply", "country": "GN", "sector": "Telecom"
    }, headers=auth_headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Mission télécom",
        "priority": "Haute",
        "status": "Besoin qualifié",
        "probability": 70,
    }, headers=auth_headers).json()

    resp = client.post("/api/v1/sector-templates/apply", json={
        "sector_key": "telecom",
        "deliverable_type": "memoire_technique",
        "opportunity_id": opp["id"],
        "language": "fr",
    }, headers=auth_headers)
    assert resp.status_code == 201
    d = resp.json()
    assert d["deliverable_type"] == "memoire_technique"
    assert d["status"] == "draft"
    assert "telecom" in d["generated_by"].lower() or "sector" in d["generated_by"].lower()
    assert len(d["content_markdown"]) > 200  # template content loaded


def test_sector_template_apply_not_found(client, auth_headers):
    resp = client.post("/api/v1/sector-templates/apply", json={
        "sector_key": "nonexistent_sector",
        "deliverable_type": "memoire_technique",
    }, headers=auth_headers)
    assert resp.status_code == 404


# ── Email Preview ────────────────────────────────────────────────────────────

def _create_approved_deliverable(client, headers):
    """Create org → opp → deliverable → approve it."""
    org = client.post("/api/v1/organizations", json={
        "name": "Email Preview Client", "country": "GN", "sector": "IT"
    }, headers=headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Mission email preview test",
        "priority": "Haute",
        "status": "Besoin qualifié",
        "probability": 70,
    }, headers=headers).json()
    d = client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp["id"],
        "deliverable_type": "offre_commerciale",
        "language": "fr",
        "audience": "Comité direction client",
    }, headers=headers).json()
    # Approve it
    client.post(f"/api/v1/deliverables/{d['id']}/review", json={"reviewer_name": "Sekouna"}, headers=headers)
    client.post(f"/api/v1/deliverables/{d['id']}/approve", json={"approver_name": "Sekouna KABA"}, headers=headers)
    return d["id"]


def test_email_preview_requires_auth(client):
    assert client.get("/api/v1/deliverables/1/email-preview").status_code == 401


def test_email_preview_not_found(client, auth_headers):
    resp = client.get("/api/v1/deliverables/9999/email-preview", headers=auth_headers)
    assert resp.status_code == 404


def test_email_preview_structure(client, auth_headers):
    did = _create_approved_deliverable(client, auth_headers)
    resp = client.get(f"/api/v1/deliverables/{did}/email-preview", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "subject" in data
    assert "html_body" in data
    assert "text_body" in data
    assert "from_name" in data
    assert "attachments_note" in data
    assert len(data["subject"]) > 10
    assert len(data["html_body"]) > 200


def test_email_preview_html_content(client, auth_headers):
    did = _create_approved_deliverable(client, auth_headers)
    data = client.get(f"/api/v1/deliverables/{did}/email-preview", headers=auth_headers).json()

    html = data["html_body"]
    assert "<!DOCTYPE html>" in html
    assert "DataSphere Innovation" in html
    assert "Sekouna KABA" in html
    assert "Approuvé" in html


def test_email_preview_subject_contains_type(client, auth_headers):
    did = _create_approved_deliverable(client, auth_headers)
    data = client.get(f"/api/v1/deliverables/{did}/email-preview", headers=auth_headers).json()
    # Subject should contain deliverable type label
    assert "commerciale" in data["subject"].lower() or "offre" in data["subject"].lower()


def test_email_preview_text_body(client, auth_headers):
    did = _create_approved_deliverable(client, auth_headers)
    data = client.get(f"/api/v1/deliverables/{did}/email-preview", headers=auth_headers).json()
    text = data["text_body"]
    assert "DataSphere Innovation" in text
    assert "Madame" in text or "Monsieur" in text
    assert len(text) > 100
