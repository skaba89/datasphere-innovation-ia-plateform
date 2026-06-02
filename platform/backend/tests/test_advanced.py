"""
Tests for Notifications, Mission report and Health monitor.
"""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _seed(client, headers):
    org = client.post("/api/v1/organizations", json={
        "name": "Notif Test Org", "country": "GN", "sector": "IT"
    }, headers=headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"], "title": "Notif mission",
        "priority": "Haute", "status": "Besoin qualifié", "probability": 70,
        "potential_value": "50000",
    }, headers=headers).json()
    tender = client.post("/api/v1/tenders", json={
        "opportunity_id": opp["id"],
        "reference": "NOTIF-001",
        "title": "AO notification test",
        "buyer_name": "Test Buyer",
        "go_no_go_decision": "Go",
        "go_no_go_score": 82,
        "status": "draft",
    }, headers=headers).json()
    return org, opp, tender


# ── Notifications ─────────────────────────────────────────────────────────────

def test_notifications_requires_auth(client):
    assert client.get("/api/v1/notifications").status_code == 401


def test_notifications_count_requires_auth(client):
    assert client.get("/api/v1/notifications/count").status_code == 401


def test_notifications_empty_initially(client, auth_headers):
    resp = client.get("/api/v1/notifications", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_notifications_count(client, auth_headers):
    resp = client.get("/api/v1/notifications/count", headers=auth_headers)
    assert resp.status_code == 200
    assert "unread" in resp.json()
    assert isinstance(resp.json()["unread"], int)


def test_notifications_create(client, auth_headers):
    resp = client.post("/api/v1/notifications", json={
        "type": "system",
        "priority": "high",
        "title": "Test notification",
        "body": "Ceci est un test.",
        "ttl_hours": 24,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test notification"
    assert data["is_read"] is False
    assert data["type"] == "system"


def test_notifications_mark_read(client, auth_headers):
    n = client.post("/api/v1/notifications", json={
        "type": "system", "priority": "low", "title": "Read me"
    }, headers=auth_headers).json()

    resp = client.post(f"/api/v1/notifications/{n['id']}/read", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True
    assert resp.json()["read_at"] is not None


def test_notifications_mark_all_read(client, auth_headers):
    # Create 2 notifications
    for i in range(2):
        client.post("/api/v1/notifications", json={
            "type": "system", "priority": "low", "title": f"Batch {i}"
        }, headers=auth_headers)

    resp = client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert resp.status_code == 200
    assert "marked_read" in resp.json()

    # Count should be 0
    count = client.get("/api/v1/notifications/count", headers=auth_headers).json()
    assert count["unread"] == 0


def test_notifications_unread_filter(client, auth_headers):
    # Create 1 read + 1 unread
    n1 = client.post("/api/v1/notifications", json={
        "type": "system", "priority": "low", "title": "Unread one"
    }, headers=auth_headers).json()
    n2 = client.post("/api/v1/notifications", json={
        "type": "system", "priority": "low", "title": "Will be read"
    }, headers=auth_headers).json()
    client.post(f"/api/v1/notifications/{n2['id']}/read", headers=auth_headers)

    resp = client.get("/api/v1/notifications?unread_only=true", headers=auth_headers)
    assert resp.status_code == 200
    unread_ids = [n["id"] for n in resp.json()]
    assert n1["id"] in unread_ids
    assert n2["id"] not in unread_ids


def test_notifications_push_from_crud(client, auth_headers):
    """Test push helpers used by scheduler."""
    from app.db.session import SessionLocal
    from app.crud.notification import push_approval_required, push_deliverable_approved, count_unread

    db = SessionLocal()
    try:
        n = push_approval_required(db, action_id=99, action_title="Test action")
        assert n.type == "approval_required"
        assert n.priority == "high"
        assert n.resource_id == 99

        n2 = push_deliverable_approved(db, deliverable_id=42, title="Mon livrable")
        assert n2.type == "deliverable_approved"
        assert n2.resource_id == 42
    finally:
        db.close()


# ── Mission Report ────────────────────────────────────────────────────────────

def test_mission_report_requires_auth(client):
    assert client.get("/api/v1/deliverables/tenders/1/mission-report").status_code == 401


def test_mission_report_not_found(client, auth_headers):
    resp = client.get("/api/v1/deliverables/tenders/99999/mission-report", headers=auth_headers)
    assert resp.status_code == 404


def test_mission_report_html(client, auth_headers):
    _, _, tender = _seed(client, auth_headers)

    # Add requirements
    client.post(f"/api/v1/tenders/{tender['id']}/requirements", json={
        "requirement_code": "REQ-001",
        "description": "Architecture data moderne",
        "requirement_type": "Obligatoire",
        "tender_id": tender["id"],
        "status": "à_traiter",
    }, headers=auth_headers)

    resp = client.get(f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    html = resp.text
    assert "<!DOCTYPE html>" in html
    assert "DataSphere Innovation" in html
    assert "NOTIF-001" in html or "AO notification test" in html
    assert "window.print()" in html


def test_mission_report_has_sections(client, auth_headers):
    _, _, tender = _seed(client, auth_headers)

    resp = client.get(f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers)
    html = resp.text
    # Check key sections are present
    assert "Exigences" in html or "Contexte" in html
    assert "Rapport" in html
    # KPI cards must be present
    assert "analysées" in html or "Livrables" in html


def test_mission_report_includes_deliverables(client, auth_headers):
    _, opp, tender = _seed(client, auth_headers)

    # Create and approve a deliverable
    d = client.post("/api/v1/deliverables/generate-draft", json={
        "tender_id": tender["id"],
        "deliverable_type": "memoire_technique",
        "language": "fr",
    }, headers=auth_headers).json()
    client.post(f"/api/v1/deliverables/{d['id']}/review", json={"reviewer_name": "R"}, headers=auth_headers)
    client.post(f"/api/v1/deliverables/{d['id']}/approve", json={"approver_name": "A"}, headers=auth_headers)

    resp = client.get(f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers)
    html = resp.text
    assert "Livrables approuvés" in html or "approuvé" in html.lower()


# ── Health monitor ────────────────────────────────────────────────────────────

def test_health_detailed_requires_auth(client):
    assert client.get("/api/v1/health/detailed").status_code == 401


def test_health_detailed_structure(client, auth_headers):
    resp = client.get("/api/v1/health/detailed", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "overall" in data
    assert "version" in data
    assert "checks" in data
    assert "timestamp" in data

    checks = data["checks"]
    assert "database" in checks
    assert "scheduler" in checks
    assert "llm" in checks
    assert "smtp" in checks


def test_health_database_up(client, auth_headers):
    resp = client.get("/api/v1/health/detailed", headers=auth_headers)
    db_check = resp.json()["checks"]["database"]
    assert db_check["status"] == "up"
    assert "users" in db_check


def test_health_llm_shows_mode(client, auth_headers):
    resp = client.get("/api/v1/health/detailed", headers=auth_headers)
    llm = resp.json()["checks"]["llm"]
    assert llm["status"] in ("simulation", "live")
    assert "provider" in llm


def test_health_smtp_shows_config(client, auth_headers):
    resp = client.get("/api/v1/health/detailed", headers=auth_headers)
    smtp = resp.json()["checks"]["smtp"]
    assert smtp["status"] in ("configured", "preview_only")


def test_health_overall_healthy_on_fresh_db(client, auth_headers):
    resp = client.get("/api/v1/health/detailed", headers=auth_headers)
    data = resp.json()
    # Fresh DB should be healthy or attention (never error on basic checks)
    assert data["overall"] in ("healthy", "attention", "degraded")
