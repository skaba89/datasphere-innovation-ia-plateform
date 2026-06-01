"""
Tests for Excel export, SMTP send (preview mode) and Gantt analytics.
"""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _seed(client, headers):
    org = client.post("/api/v1/organizations", json={
        "name": "Export Test Org", "country": "GN", "sector": "Telecom"
    }, headers=headers).json()
    opp = client.post("/api/v1/opportunities", json={
        "organization_id": org["id"],
        "title": "Mission export test",
        "priority": "Haute",
        "status": "Besoin qualifié",
        "probability": 75,
        "potential_value": "60000.00",
    }, headers=headers).json()
    tender = client.post("/api/v1/tenders", json={
        "opportunity_id": opp["id"],
        "reference": "EXPORT-001",
        "title": "AO export test",
        "buyer_name": "Test Buyer",
        "go_no_go_decision": "Go",
        "go_no_go_score": 80,
        "status": "draft",
    }, headers=headers).json()
    return org, opp, tender


def _make_approved_deliverable(client, headers, opp_id):
    d = client.post("/api/v1/deliverables/generate-draft", json={
        "opportunity_id": opp_id,
        "deliverable_type": "offre_commerciale",
        "language": "fr",
    }, headers=headers).json()
    client.post(f"/api/v1/deliverables/{d['id']}/review", json={"reviewer_name": "Tester"}, headers=headers)
    client.post(f"/api/v1/deliverables/{d['id']}/approve", json={"approver_name": "Admin"}, headers=headers)
    return d["id"]


# ── Excel — Auth ──────────────────────────────────────────────────────────────

def test_excel_requires_auth(client):
    for path in ["/pipeline", "/tenders", "/actions", "/deliverables", "/full-report"]:
        assert client.get(f"/api/v1/export/excel{path}").status_code == 401


# ── Excel — Pipeline ─────────────────────────────────────────────────────────

def test_excel_pipeline_download(client, auth_headers):
    _seed(client, auth_headers)
    resp = client.get("/api/v1/export/excel/pipeline", headers=auth_headers)
    assert resp.status_code == 200
    ct = resp.headers.get("content-type", "")
    assert "spreadsheet" in ct or "officedocument" in ct
    assert len(resp.content) > 1000  # real xlsx file
    assert resp.headers.get("content-disposition", "").endswith('.xlsx"')


def test_excel_pipeline_has_data(client, auth_headers):
    _seed(client, auth_headers)
    resp = client.get("/api/v1/export/excel/pipeline", headers=auth_headers)
    assert resp.status_code == 200
    # Xlsx magic bytes: PK zip header
    assert resp.content[:2] == b"PK"


# ── Excel — Tenders ───────────────────────────────────────────────────────────

def test_excel_tenders_download(client, auth_headers):
    _seed(client, auth_headers)
    resp = client.get("/api/v1/export/excel/tenders", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"


# ── Excel — Actions ───────────────────────────────────────────────────────────

def test_excel_actions_download(client, auth_headers):
    resp = client.get("/api/v1/export/excel/actions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"


# ── Excel — Deliverables ──────────────────────────────────────────────────────

def test_excel_deliverables_download(client, auth_headers):
    _, opp, _ = _seed(client, auth_headers)
    _make_approved_deliverable(client, auth_headers, opp["id"])
    resp = client.get("/api/v1/export/excel/deliverables", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"


# ── Excel — Full report ───────────────────────────────────────────────────────

def test_excel_full_report_download(client, auth_headers):
    _seed(client, auth_headers)
    resp = client.get("/api/v1/export/excel/full-report", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"
    assert len(resp.content) > 5000  # multi-sheet is larger


# ── SMTP send — preview mode ──────────────────────────────────────────────────

def test_smtp_send_requires_auth(client):
    resp = client.post("/api/v1/deliverables/1/send-email", json={
        "to_email": "test@test.com", "to_name": "Test"
    })
    assert resp.status_code == 401


def test_smtp_send_not_found(client, auth_headers):
    resp = client.post("/api/v1/deliverables/99999/send-email", json={
        "to_email": "test@example.com", "to_name": "Test"
    }, headers=auth_headers)
    assert resp.status_code == 404


def test_smtp_send_preview_mode(client, auth_headers):
    """Without SMTP configured, returns preview-mode result (not an error)."""
    _, opp, _ = _seed(client, auth_headers)
    did = _make_approved_deliverable(client, auth_headers, opp["id"])

    resp = client.post(f"/api/v1/deliverables/{did}/send-email", json={
        "to_email": "client@arpt.gov.gn",
        "to_name": "Directeur ARPT",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "sent" in data
    assert "provider" in data
    assert "message" in data
    # In test env SMTP is not configured → preview mode
    assert data["sent"] is False
    assert "preview" in data["provider"]


# ── Gantt ────────────────────────────────────────────────────────────────────

def test_gantt_requires_auth(client):
    assert client.get("/api/v1/analytics/gantt").status_code == 401


def test_gantt_structure(client, auth_headers):
    resp = client.get("/api/v1/analytics/gantt", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "assignments" in data
    assert "generated_at" in data
    assert isinstance(data["assignments"], list)


def test_gantt_with_data(client, auth_headers):
    _, opp, _ = _seed(client, auth_headers)
    client.post("/api/v1/agents/defaults/install", headers=auth_headers)
    agents = client.get("/api/v1/agents", headers=auth_headers).json()
    assignment = client.post("/api/v1/agents/assignments", json={
        "agent_id": agents[0]["id"],
        "opportunity_id": opp["id"],
        "assignment_type": "opportunity_analysis",
        "objective": "Test gantt",
        "priority": "Haute",
        "status": "planned",
    }, headers=auth_headers).json()

    resp = client.get("/api/v1/analytics/gantt", headers=auth_headers)
    data = resp.json()
    assert len(data["assignments"]) >= 1

    row = data["assignments"][0]
    assert "assignment_id" in row
    assert "agent_name" in row
    assert "actions" in row
    assert "total_actions" in row
    assert "done_actions" in row

    for action in row["actions"]:
        assert "action_type" in action
        assert "start" in action
        assert "end" in action
        assert "status" in action
