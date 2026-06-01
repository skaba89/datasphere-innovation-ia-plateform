"""
Tests for Analytics pipeline, Export (markdown/HTML), and Audit logs.
"""

import pytest


# ── Helpers ──────────────────────────────────────────────────────────────────

def _setup(client):
    """Bootstrap admin + login, return auth headers."""
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


def _seed_data(client, headers):
    """Create org → opportunity → tender → install agents → assignment → actions → deliverable."""
    org = client.post("/api/v1/organizations", json={
        "name": "ARPT Guinée Test", "country": "Guinée", "sector": "Telecom",
    }, headers=headers).json()

    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Plateforme data IA",
        "priority": "Haute",
        "status": "Besoin qualifié",
        "probability": 70,
        "potential_value": "50000.00",
    }, headers=headers).json()

    tender = client.post("/api/v1/tenders", json={
        "opportunity_id": opp["id"],
        "reference": "ARPT-2026-001",
        "title": "AO data IA test",
        "buyer_name": "ARPT",
        "go_no_go_decision": "Go",
        "go_no_go_score": 80,
        "status": "draft",
    }, headers=headers).json()

    client.post("/api/v1/agents/defaults/install", headers=headers)
    agents = client.get("/api/v1/agents", headers=headers).json()

    assignment = client.post("/api/v1/agents/assignments", json={
        "agent_id": agents[0]["id"],
        "opportunity_id": opp["id"],
        "assignment_type": "opportunity_analysis",
        "objective": "Test analytics",
        "priority": "Haute",
        "status": "planned",
        "human_reviewer": "Test",
    }, headers=headers).json()

    # Generate deliverable
    client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp["id"],
        "deliverable_type": "note_cadrage",
        "language": "fr",
    }, headers=headers)

    return {"org": org, "opp": opp, "tender": tender, "assignment": assignment}


# ── Analytics ────────────────────────────────────────────────────────────────

def test_pipeline_analytics_requires_auth(client):
    resp = client.get("/api/v1/analytics/pipeline")
    assert resp.status_code == 401


def test_pipeline_analytics_structure(client, auth_headers):
    _seed_data(client, auth_headers)
    resp = client.get("/api/v1/analytics/pipeline", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    # Top-level keys
    for key in ("opportunities", "tenders", "agents", "deliverables", "scheduler", "notifications", "computed_at"):
        assert key in data, f"Missing key: {key}"


def test_pipeline_analytics_opportunity_stats(client, auth_headers):
    _seed_data(client, auth_headers)
    data = client.get("/api/v1/analytics/pipeline", headers=auth_headers).json()
    opp = data["opportunities"]

    assert opp["total"] >= 1
    assert opp["high_priority"] >= 1
    assert opp["total_potential"] >= 50000.0
    assert opp["pipeline_value"] >= 0
    assert isinstance(opp["by_status"], dict)
    assert isinstance(opp["by_priority"], dict)


def test_pipeline_analytics_tender_stats(client, auth_headers):
    _seed_data(client, auth_headers)
    data = client.get("/api/v1/analytics/pipeline", headers=auth_headers).json()
    t = data["tenders"]

    assert t["total"] >= 1
    assert t["go_count"] >= 1
    assert "Go" in t["by_decision"]


def test_pipeline_analytics_agent_stats(client, auth_headers):
    _seed_data(client, auth_headers)
    data = client.get("/api/v1/analytics/pipeline", headers=auth_headers).json()
    a = data["agents"]

    assert a["total_profiles"] >= 5
    assert a["total_assignments"] >= 1
    assert a["total_actions"] >= 0
    assert 0.0 <= a["completion_rate"] <= 100.0


def test_pipeline_analytics_deliverable_stats(client, auth_headers):
    _seed_data(client, auth_headers)
    data = client.get("/api/v1/analytics/pipeline", headers=auth_headers).json()
    d = data["deliverables"]

    assert d["total"] >= 1
    assert d["draft"] >= 1
    assert 0.0 <= d["approval_rate"] <= 100.0


def test_pipeline_analytics_notifications(client, auth_headers):
    _seed_data(client, auth_headers)
    data = client.get("/api/v1/analytics/pipeline", headers=auth_headers).json()
    notifs = data["notifications"]

    assert isinstance(notifs, list)
    for n in notifs:
        assert "type" in n
        assert "priority" in n
        assert "title" in n
        assert n["priority"] in ("high", "medium", "low")


# ── Export ────────────────────────────────────────────────────────────────────

def _create_deliverable(client, headers):
    """Create an organisation, opportunity and generate a deliverable draft."""
    org = client.post("/api/v1/organizations", json={
        "name": "Export Test Org", "country": "FR", "sector": "IT",
    }, headers=headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Mission export test",
        "priority": "Normale",
        "status": "Besoin qualifié",
        "probability": 50,
    }, headers=headers).json()
    d = client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp["id"],
        "deliverable_type": "note_cadrage",
        "language": "fr",
    }, headers=headers).json()
    return d["id"]


def test_export_markdown_requires_auth(client):
    resp = client.get("/api/v1/deliverables/1/export/markdown")
    assert resp.status_code == 401


def test_export_html_requires_auth(client):
    resp = client.get("/api/v1/deliverables/1/export/html")
    assert resp.status_code == 401


def test_export_markdown_not_found(client, auth_headers):
    resp = client.get("/api/v1/deliverables/9999/export/markdown", headers=auth_headers)
    assert resp.status_code == 404


def test_export_markdown_content(client, auth_headers):
    did = _create_deliverable(client, auth_headers)
    resp = client.get(f"/api/v1/deliverables/{did}/export/markdown", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    content = resp.text
    assert "DataSphere" in content or "note_cadrage" in content or "#" in content
    assert "Content-Disposition" in resp.headers
    assert ".md" in resp.headers["Content-Disposition"]


def test_export_html_content(client, auth_headers):
    did = _create_deliverable(client, auth_headers)
    resp = client.get(f"/api/v1/deliverables/{did}/export/html", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    html = resp.text
    assert "<!DOCTYPE html>" in html
    assert "DataSphere" in html
    assert "window.print()" in html  # print button present
    assert "@media print" in html    # print CSS present


# ── Audit logs ───────────────────────────────────────────────────────────────

def test_audit_logs_requires_auth(client):
    resp = client.get("/api/v1/audit-logs")
    assert resp.status_code == 401


def test_audit_logs_empty_initially(client, auth_headers):
    resp = client.get("/api/v1/audit-logs", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_audit_log_written_on_approve(client, auth_headers):
    """Approving an action should write an APPROVE audit log."""
    org = client.post("/api/v1/organizations", json={
        "name": "Audit Test Org", "country": "GN", "sector": "IT"
    }, headers=auth_headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Mission audit",
        "priority": "Haute",
        "status": "Besoin qualifié",
        "probability": 60,
    }, headers=auth_headers).json()
    client.post("/api/v1/agents/defaults/install", headers=auth_headers)
    agents = client.get("/api/v1/agents", headers=auth_headers).json()
    assignment = client.post("/api/v1/agents/assignments", json={
        "agent_id": agents[0]["id"],
        "opportunity_id": opp["id"],
        "assignment_type": "opportunity_analysis",
        "objective": "Audit test",
        "priority": "Haute",
        "status": "planned",
    }, headers=auth_headers).json()

    actions = client.get(
        f"/api/v1/agent-actions?assignment_id={assignment['id']}",
        headers=auth_headers,
    ).json()
    sensitive = next((a for a in actions if a["requires_human_approval"]), None)
    assert sensitive is not None

    client.post(
        f"/api/v1/agent-actions/{sensitive['id']}/approve?actor_name=Sekouna",
        headers=auth_headers,
    )

    logs = client.get("/api/v1/audit-logs?action=APPROVE", headers=auth_headers).json()
    assert len(logs) >= 1
    log = logs[0]
    assert log["action"] == "APPROVE"
    assert log["resource_type"] == "agent_action"
    assert log["actor_name"] == "Sekouna"


def test_audit_log_filter_by_resource_type(client, auth_headers):
    resp = client.get("/api/v1/audit-logs?resource_type=agent_action", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    for log in data:
        assert log["resource_type"] == "agent_action"


def test_audit_log_crud_direct(client, auth_headers):
    """Write and read audit logs directly via CRUD."""
    from app.db.session import SessionLocal
    from app.crud.audit_log import write_log, list_audit_logs

    db = SessionLocal()
    try:
        log = write_log(
            db,
            action="TEST",
            resource_type="test_resource",
            resource_id=42,
            resource_label="Test resource",
            actor_name="pytest",
            detail="unit test",
        )
        assert log.id is not None
        assert log.action == "TEST"
        assert log.status == "success"

        logs = list_audit_logs(db, resource_type="test_resource")
        assert len(logs) >= 1
        assert logs[0].actor_name == "pytest"
    finally:
        db.close()
