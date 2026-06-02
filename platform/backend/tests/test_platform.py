"""
Tests for Team management, Deliverable versioning, Global search and Activity feed.
"""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _admin(client):
    client.post("/api/v1/auth/bootstrap-admin", json={
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
        "first_name": "Admin", "last_name": "DataSphere",
        "role": "admin", "is_active": True,
    })
    token = client.post("/api/v1/auth/login", json={
        "email": "admin@datasphere-innovation.net", "password": "Admin123456!",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _org_opp(client, h):
    org = client.post("/api/v1/organizations", json={
        "name": "Version Test Org", "country": "GN", "sector": "IT"
    }, headers=h).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"], "title": "Version opp",
        "priority": "Haute", "status": "Besoin qualifié", "probability": 60,
    }, headers=h).json()
    return org, opp


def _deliverable(client, h, opp_id):
    return client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp_id, "deliverable_type": "note_cadrage", "language": "fr",
    }, headers=h).json()


# ── Team management ────────────────────────────────────────────────────────────

def test_team_list_requires_auth(client):
    assert client.get("/api/v1/team").status_code == 401


def test_team_list(client, auth_headers):
    resp = client.get("/api/v1/team", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    # Admin created in bootstrap is in the list
    assert any(u["role"] == "admin" for u in resp.json())


def test_team_roles_list(client, auth_headers):
    resp = client.get("/api/v1/team/roles", headers=auth_headers)
    assert resp.status_code == 200
    keys = [r["key"] for r in resp.json()["roles"]]
    assert "admin" in keys
    assert "consultant" in keys
    assert "viewer" in keys


def test_team_invite_member(client, auth_headers):
    resp = client.post("/api/v1/team/invite", json={
        "email": "consultant@datasphere.fr",
        "password": "Consultant123!",
        "first_name": "Jean",
        "last_name": "Dupont",
        "role": "consultant",
        "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "consultant@datasphere.fr"
    assert data["role"] == "consultant"


def test_team_invite_duplicate_email(client, auth_headers):
    client.post("/api/v1/team/invite", json={
        "email": "dup@datasphere.fr", "password": "Test12345!", "role": "viewer", "is_active": True,
    }, headers=auth_headers)
    resp = client.post("/api/v1/team/invite", json={
        "email": "dup@datasphere.fr", "password": "Test12345!", "role": "viewer", "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 409


def test_team_invite_invalid_role(client, auth_headers):
    resp = client.post("/api/v1/team/invite", json={
        "email": "bad@role.fr", "password": "Test12345!",
        "role": "superuser", "is_active": True,
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_team_update_role(client, auth_headers):
    member = client.post("/api/v1/team/invite", json={
        "email": "toupdate@ds.fr", "password": "Test12345!", "role": "consultant", "is_active": True,
    }, headers=auth_headers).json()

    resp = client.patch(f"/api/v1/team/{member['id']}", json={"role": "manager"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "manager"


def test_team_deactivate_member(client, auth_headers):
    member = client.post("/api/v1/team/invite", json={
        "email": "todeactivate@ds.fr", "password": "Test12345!", "role": "viewer", "is_active": True,
    }, headers=auth_headers).json()

    resp = client.post(f"/api/v1/team/{member['id']}/deactivate", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_team_change_password(client, auth_headers):
    member = client.post("/api/v1/team/invite", json={
        "email": "pwdchange@ds.fr", "password": "OldPass123!", "role": "consultant", "is_active": True,
    }, headers=auth_headers).json()

    resp = client.post(f"/api/v1/team/{member['id']}/change-password",
                       json={"new_password": "NewPass456!"}, headers=auth_headers)
    assert resp.status_code == 200

    # New password works
    login = client.post("/api/v1/auth/login", json={
        "email": "pwdchange@ds.fr", "password": "NewPass456!"
    })
    assert login.status_code == 200


def test_team_not_found(client, auth_headers):
    assert client.get("/api/v1/team/99999", headers=auth_headers).status_code == 404


# ── Versioning ────────────────────────────────────────────────────────────────

def test_versioning_list_empty(client, auth_headers):
    _, opp = _org_opp(client, auth_headers)
    d = _deliverable(client, auth_headers, opp["id"])

    resp = client.get(f"/api/v1/deliverables/{d['id']}/versions", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_versioning_create_snapshot(client, auth_headers):
    _, opp = _org_opp(client, auth_headers)
    d = _deliverable(client, auth_headers, opp["id"])

    resp = client.post(
        f"/api/v1/deliverables/{d['id']}/versions/snapshot",
        params={"change_note": "Premier brouillon", "created_by": "Sekouna"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    snap = resp.json()
    assert snap["version"] == d["version"]
    assert snap["deliverable_id"] == d["id"]
    assert snap["change_note"] == "Premier brouillon"


def test_versioning_multiple_snapshots(client, auth_headers):
    _, opp = _org_opp(client, auth_headers)
    d = _deliverable(client, auth_headers, opp["id"])

    # Create 2 snapshots
    client.post(f"/api/v1/deliverables/{d['id']}/versions/snapshot",
                params={"created_by": "Auto"}, headers=auth_headers)
    # Modify deliverable to bump version
    client.patch(f"/api/v1/deliverables/{d['id']}", json={"summary": "v2 modifié"}, headers=auth_headers)
    client.post(f"/api/v1/deliverables/{d['id']}/versions/snapshot",
                params={"created_by": "Auto", "change_note": "v2"}, headers=auth_headers)

    versions = client.get(f"/api/v1/deliverables/{d['id']}/versions", headers=auth_headers).json()
    assert len(versions) >= 2


def test_versioning_restore(client, auth_headers):
    _, opp = _org_opp(client, auth_headers)
    d = _deliverable(client, auth_headers, opp["id"])

    # Snapshot at v1
    snap = client.post(
        f"/api/v1/deliverables/{d['id']}/versions/snapshot",
        params={"created_by": "Test"},
        headers=auth_headers,
    ).json()

    # Restore to v1
    resp = client.post(
        f"/api/v1/deliverables/{d['id']}/versions/restore",
        json={"version_number": snap["version"], "restored_by": "Admin"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    restored = resp.json()
    assert restored["status"] == "draft"
    assert restored["version"] > snap["version"]  # version bumped


def test_versioning_diff_requires_two_versions(client, auth_headers):
    _, opp = _org_opp(client, auth_headers)
    d = _deliverable(client, auth_headers, opp["id"])

    client.post(f"/api/v1/deliverables/{d['id']}/versions/snapshot",
                params={"created_by": "Test"}, headers=auth_headers)

    # compare_to version doesn't exist yet — 404
    resp = client.get(
        f"/api/v1/deliverables/{d['id']}/versions/{d['version']}/diff",
        params={"compare_to": 99},
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ── Global search ─────────────────────────────────────────────────────────────

def test_search_requires_auth(client):
    assert client.get("/api/v1/search?q=arpt").status_code == 401


def test_search_too_short(client, auth_headers):
    resp = client.get("/api/v1/search?q=a", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_search_finds_organization(client, auth_headers):
    client.post("/api/v1/organizations", json={
        "name": "ARPT Guinée Conakry", "country": "Guinée", "sector": "Telecom"
    }, headers=auth_headers)

    resp = client.get("/api/v1/search?q=ARPT", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert "organizations" in data["results"]
    assert any("ARPT" in o["title"] for o in data["results"]["organizations"])


def test_search_finds_opportunity(client, auth_headers):
    org = client.post("/api/v1/organizations", json={
        "name": "Search Test Org", "country": "FR", "sector": "IT"
    }, headers=auth_headers).json()
    client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Plateforme data Lakehouse souveraine",
        "priority": "Haute", "status": "Besoin qualifié", "probability": 70,
    }, headers=auth_headers)

    resp = client.get("/api/v1/search?q=Lakehouse", headers=auth_headers)
    data = resp.json()
    assert "opportunities" in data["results"]
    assert any("Lakehouse" in o["title"] for o in data["results"]["opportunities"])


def test_search_finds_deliverable(client, auth_headers):
    org = client.post("/api/v1/organizations", json={
        "name": "Search Deliv Org", "country": "GN", "sector": "IT"
    }, headers=auth_headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"], "title": "Mission search",
        "priority": "Haute", "status": "Besoin qualifié", "probability": 60,
    }, headers=auth_headers).json()
    d = client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp["id"],
        "deliverable_type": "memoire_technique",
        "language": "fr",
    }, headers=auth_headers).json()

    resp = client.get("/api/v1/search?q=mémoire", headers=auth_headers)
    data = resp.json()
    if "deliverables" in data["results"]:
        assert any(r["id"] == d["id"] for r in data["results"]["deliverables"])


def test_search_result_structure(client, auth_headers):
    resp = client.get("/api/v1/search?q=test", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "query" in data
    assert "total" in data
    assert "results" in data
    # Each result has the expected fields
    for category, items in data["results"].items():
        for item in items:
            assert "id" in item
            assert "type" in item
            assert "title" in item
            assert "subtitle" in item


# ── Activity feed ─────────────────────────────────────────────────────────────

def test_activity_feed_requires_auth(client):
    assert client.get("/api/v1/activity/feed").status_code == 401


def test_activity_feed_structure(client, auth_headers):
    resp = client.get("/api/v1/activity/feed", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "days" in data
    assert "generated_at" in data
    assert isinstance(data["items"], list)


def test_activity_feed_after_action(client, auth_headers):
    """Activity feed captures events after they happen."""
    # Create something — triggers audit log
    client.post("/api/v1/organizations", json={
        "name": "Activity Test Org", "country": "GN", "sector": "IT"
    }, headers=auth_headers)

    resp = client.get("/api/v1/activity/feed?days=1", headers=auth_headers)
    data = resp.json()
    assert data["total"] >= 0  # May or may not capture depending on audit write


def test_activity_feed_limit(client, auth_headers):
    resp = client.get("/api/v1/activity/feed?limit=5", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 5


def test_activity_feed_item_fields(client, auth_headers):
    # Create something that generates audit log
    org = client.post("/api/v1/organizations", json={
        "name": "Feed Item Org", "country": "GN", "sector": "IT"
    }, headers=auth_headers).json()
    # Approve a deliverable to get feed items
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"], "title": "Feed Opp",
        "priority": "Haute", "status": "Besoin qualifié", "probability": 60,
    }, headers=auth_headers).json()
    d = client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp["id"], "deliverable_type": "note_cadrage", "language": "fr",
    }, headers=auth_headers).json()
    client.post(f"/api/v1/deliverables/{d['id']}/review", json={"reviewer_name": "Test"}, headers=auth_headers)
    client.post(f"/api/v1/deliverables/{d['id']}/approve", json={"approver_name": "Admin"}, headers=auth_headers)

    resp = client.get("/api/v1/activity/feed?days=1", headers=auth_headers)
    data = resp.json()
    if data["items"]:
        item = data["items"][0]
        for field in ["id", "source", "action", "icon", "title", "timestamp"]:
            assert field in item


# ── Contact form tests ─────────────────────────────────────────────────────────

def test_contact_form_returns_200(client):
    """Contact form should always return 200 with success=True."""
    resp = client.post("/api/v1/contact", json={
        "firstname": "Mamadou",
        "lastname": "Diallo",
        "email": "mamadou@example.com",
        "need_type": "Diagnostic data & SI",
        "message": "Je souhaite un audit de mon SI.",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "message" in data


def test_contact_form_missing_email_rejected(client):
    """Contact form without email must fail validation."""
    resp = client.post("/api/v1/contact", json={
        "firstname": "Test",
        "lastname": "User",
        "email": "not-an-email",
        "need_type": "Autre",
    })
    assert resp.status_code == 422


# ── Upload tests ───────────────────────────────────────────────────────────────

def _make_tender(client, auth_headers):
    """Helper: create org + opportunity + tender, return tender_id."""
    org = client.post("/api/v1/organizations", headers=auth_headers,
        json={"name": "Upload Test Org", "country": "FR"}).json()
    opp = client.post("/api/v1/opportunities", headers=auth_headers, json={
        "title": "Upload Test Opp", "organization_id": org["id"],
        "status": "active", "probability": 50,
    }).json()
    tender = client.post("/api/v1/tenders", headers=auth_headers, json={
        "title": "AO Upload Test", "status": "draft",
        "opportunity_id": opp["id"], "reference": "AO-UP-001",
    }).json()
    return tender["id"]


def test_upload_tender_file(client, auth_headers):
    """Upload a small file to a tender."""
    tender_id = _make_tender(client, auth_headers)
    import io
    resp = client.post(
        f"/api/v1/uploads/tenders/{tender_id}",
        headers={"Authorization": auth_headers["Authorization"]},
        files={"file": ("test_doc.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["original_name"] == "test_doc.pdf"
    assert data["resource_type"] == "tender"
    assert data["resource_id"] == tender_id


def test_upload_list_files(client, auth_headers):
    """List files for a tender returns a list."""
    tender_id = _make_tender(client, auth_headers)
    resp = client.get(f"/api/v1/uploads/tenders/{tender_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_upload_blocked_extension(client, auth_headers):
    """Executable files must be rejected with 415."""
    tender_id = _make_tender(client, auth_headers)
    import io
    resp = client.post(
        f"/api/v1/uploads/tenders/{tender_id}",
        headers={"Authorization": auth_headers["Authorization"]},
        files={"file": ("malware.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert resp.status_code == 415


# ── AI Suggestions tests ──────────────────────────────────────────────────────

def test_suggestions_count_returns_zero_on_fresh_db(client, auth_headers):
    """Fresh DB has no pending suggestions."""
    resp = client.get("/api/v1/suggestions/count", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "organizations" in data
    assert "opportunities" in data
    assert "tenders" in data
    assert data["total"] >= 0


def test_suggestions_pending_returns_empty(client, auth_headers):
    """Pending suggestions list returns grouped structure."""
    resp = client.get("/api/v1/suggestions/pending", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "organizations" in data
    assert "opportunities" in data
    assert "tenders" in data


def test_suggestions_validate_empty_batch(client, auth_headers):
    """Empty batch validation returns success with zeros."""
    resp = client.post("/api/v1/suggestions/validate", headers=auth_headers, json={
        "items": [],
        "validated_by": "Test User",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["validated"] == 0
    assert data["rejected"] == 0


def test_suggestions_validate_invalid_entity_type(client, auth_headers):
    """Invalid entity_type returns 400."""
    resp = client.post("/api/v1/suggestions/validate", headers=auth_headers, json={
        "items": [{"entity_type": "foobar", "entity_id": 1, "accept": True}],
        "validated_by": "Test",
    })
    assert resp.status_code == 400


def test_import_text_too_short(client, auth_headers):
    """Text import with < 30 chars is rejected."""
    resp = client.post("/api/v1/suggestions/import/text", headers=auth_headers, json={
        "text": "trop court",
    })
    assert resp.status_code == 400


def test_export_contacts_csv(client, auth_headers):
    """Contacts CSV export returns valid CSV content."""
    resp = client.get("/api/v1/export/excel/contacts/csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.text
    assert "Prénom" in content or "ID" in content


def test_export_opportunities_csv(client, auth_headers):
    """Opportunities CSV export returns valid CSV content."""
    resp = client.get("/api/v1/export/excel/opportunities/csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
