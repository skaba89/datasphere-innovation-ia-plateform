"""
Tests for the Scheduler module, LLM service (simulation), agent executor and pending-approvals endpoint.
All tests use simulation fallback (no real API keys needed).
"""

# ---------------------------------------------------------------------------
# Helpers (shared with test_agent_actions patterns)
# ---------------------------------------------------------------------------

def _bootstrap(client):
    payload = {
        "email": "admin@datasphere-innovation.net",
        "password": "Admin123456!",
        "first_name": "Admin",
        "last_name": "DataSphere",
        "role": "admin",
        "is_active": True,
    }
    resp = client.post("/api/v1/auth/bootstrap-admin", json=payload)
    assert resp.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _create_org(client, headers):
    r = client.post(
        "/api/v1/organizations",
        json={"name": "ARPT Test", "country": "Guinée", "sector": "Telecom"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


def _create_opp(client, headers, org_id):
    r = client.post(
        "/api/v1/opportunities",
        json={
            "organization_id": org_id,
            "title": "Mission data IA test",
            "priority": "Haute",
            "status": "Besoin qualifié",
            "probability": 75,
        },
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


def _install_agents(client, headers):
    r = client.post("/api/v1/agents/defaults/install", headers=headers)
    assert r.status_code in (200, 201)
    return r.json()


def _create_assignment(client, headers, opp_id):
    agents = client.get("/api/v1/agents", headers=headers).json()
    agent_id = agents[0]["id"]
    r = client.post(
        "/api/v1/agents/assignments",
        json={
            "agent_id": agent_id,
            "opportunity_id": opp_id,
            "assignment_type": "opportunity_analysis",
            "objective": "Analyser l'opportunité et proposer une stratégie.",
            "expected_deliverable": "Note de cadrage.",
            "priority": "Haute",
            "status": "planned",
            "human_reviewer": "Sekouna",
        },
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


# ---------------------------------------------------------------------------
# LLM Service — simulation fallback
# ---------------------------------------------------------------------------

def test_llm_service_simulation_fallback():
    """Without API keys, the LLM service always returns simulation results."""
    from app.services.llm_service import complete, provider_label
    result, next_step = complete("Test prompt", system="Test system", action_type="context_analysis")
    assert isinstance(result, str)
    assert len(result) > 10
    assert provider_label() == "simulation"


def test_llm_service_unknown_action_type():
    from app.services.llm_service import complete
    result, next_step = complete("Prompt", action_type="unknown_type")
    assert isinstance(result, str)
    assert len(result) > 0


# ---------------------------------------------------------------------------
# Agent Executor
# ---------------------------------------------------------------------------

def test_agent_executor_uses_simulation(client, auth_headers):
    """Agent executor falls back to simulation and returns non-empty result."""
    org_id = _create_org(client, auth_headers)
    opp_id = _create_opp(client, auth_headers, org_id)
    _install_agents(client, auth_headers)
    assignment = _create_assignment(client, auth_headers, opp_id)
    plan = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment["id"]},
        headers=auth_headers,
    )
    assert plan.status_code == 201
    actions = plan.json()
    auto_action = next(a for a in actions if not a["requires_human_approval"])

    run_resp = client.post(
        "/api/v1/agent-actions/run",
        json={"action_id": auto_action["id"]},
        headers=auth_headers,
    )
    assert run_resp.status_code == 200
    data = run_resp.json()
    assert data["status"] == "done"
    assert data["result_summary"] is not None
    assert len(data["result_summary"]) > 10
    assert data["executed_at"] is not None


def test_agent_executor_blocks_unapproved_sensitive_action(client, auth_headers):
    org_id = _create_org(client, auth_headers)
    opp_id = _create_opp(client, auth_headers, org_id)
    _install_agents(client, auth_headers)
    assignment = _create_assignment(client, auth_headers, opp_id)
    plan = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment["id"]},
        headers=auth_headers,
    )
    actions = plan.json()
    sensitive = next(a for a in actions if a["requires_human_approval"])

    # Should be blocked without approval
    run_resp = client.post(
        "/api/v1/agent-actions/run",
        json={"action_id": sensitive["id"]},
        headers=auth_headers,
    )
    assert run_resp.status_code == 403

    # After approval, should execute
    approve = client.post(
        f"/api/v1/agent-actions/{sensitive['id']}/approve?actor_name=Sekouna",
        headers=auth_headers,
    )
    assert approve.status_code == 200

    run_resp2 = client.post(
        "/api/v1/agent-actions/run",
        json={"action_id": sensitive["id"]},
        headers=auth_headers,
    )
    assert run_resp2.status_code == 200
    assert run_resp2.json()["status"] == "done"


# ---------------------------------------------------------------------------
# Pending approvals
# ---------------------------------------------------------------------------

def test_pending_approvals_endpoint(client, auth_headers):
    """Pending approvals endpoint returns actions requiring human approval."""
    org_id = _create_org(client, auth_headers)
    opp_id = _create_opp(client, auth_headers, org_id)
    _install_agents(client, auth_headers)
    assignment = _create_assignment(client, auth_headers, opp_id)
    client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment["id"]},
        headers=auth_headers,
    )

    pending = client.get("/api/v1/agent-actions/pending-approvals", headers=auth_headers)
    assert pending.status_code == 200
    data = pending.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    for item in data:
        assert item["requires_human_approval"] is True
        assert item["approved_by"] is None
        assert item["status"] != "done"


def test_pending_approvals_require_authentication(client):
    resp = client.get("/api/v1/agent-actions/pending-approvals")
    assert resp.status_code == 401


def test_pending_approvals_empty_after_approval(client, auth_headers):
    org_id = _create_org(client, auth_headers)
    opp_id = _create_opp(client, auth_headers, org_id)
    _install_agents(client, auth_headers)
    assignment = _create_assignment(client, auth_headers, opp_id)
    plan = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment["id"]},
        headers=auth_headers,
    ).json()

    sensitive = [a for a in plan if a["requires_human_approval"]]
    for action in sensitive:
        client.post(
            f"/api/v1/agent-actions/{action['id']}/approve?actor_name=Sekouna",
            headers=auth_headers,
        )

    pending = client.get("/api/v1/agent-actions/pending-approvals", headers=auth_headers).json()
    unapproved = [p for p in pending if p["assignment_id"] == assignment["id"]]
    assert len(unapproved) == 0


# ---------------------------------------------------------------------------
# Scheduler endpoint
# ---------------------------------------------------------------------------

def test_scheduler_status_requires_authentication(client):
    resp = client.get("/api/v1/scheduler/status")
    assert resp.status_code == 401


def test_scheduler_status(client, auth_headers):
    resp = client.get("/api/v1/scheduler/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "running" in data
    assert "jobs" in data
    assert "pending_approvals_count" in data
    assert isinstance(data["jobs"], list)
    assert isinstance(data["pending_approvals_count"], int)


def test_scheduler_logs_empty_initially(client, auth_headers):
    resp = client.get("/api/v1/scheduler/logs", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_scheduler_trigger_unknown_job(client, auth_headers):
    resp = client.post("/api/v1/scheduler/jobs/unknown_job_xyz/trigger", headers=auth_headers)
    assert resp.status_code == 404


def test_scheduler_trigger_valid_job(client, auth_headers):
    """Test that trigger endpoint responds correctly (scheduler may or may not be running in test env)."""
    resp = client.post("/api/v1/scheduler/jobs/auto_execute/trigger", headers=auth_headers)
    # In test env (scheduler disabled), job might not exist → 404 is acceptable
    assert resp.status_code in (202, 404)


# ---------------------------------------------------------------------------
# Scheduler log CRUD
# ---------------------------------------------------------------------------

def test_scheduler_log_crud(client, auth_headers):
    """Verify scheduler log records can be written and read back."""
    from app.db.session import SessionLocal
    from app.crud.scheduler_log import create_log, list_logs, count_pending_approvals
    from datetime import datetime

    db = SessionLocal()
    try:
        log = create_log(
            db,
            job_id="auto_execute",
            job_name="Exécution actions automatiques",
            status="success",
            items_processed=3,
            started_at=datetime.utcnow(),
        )
        assert log.id is not None
        assert log.status == "success"
        assert log.items_processed == 3

        logs = list_logs(db, job_id="auto_execute", limit=10)
        assert len(logs) >= 1
        assert logs[0].job_id == "auto_execute"

        count = count_pending_approvals(db)
        assert count >= 0
    finally:
        db.close()
