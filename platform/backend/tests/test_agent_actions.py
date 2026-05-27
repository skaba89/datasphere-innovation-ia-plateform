def create_assignment_scope(client, auth_headers, with_tender=False):
    agent_response = client.post(
        "/api/v1/agents",
        json={
            "name": "AO Delivery Agent",
            "slug": "ao-delivery-agent-tester" if not with_tender else "ao-delivery-agent-tender-tester",
            "domain": "delivery",
            "instruction_template": "Analyser le contexte, proposer les prochaines etapes et preparer les livrables.",
        },
        headers=auth_headers,
    )
    assert agent_response.status_code == 201

    org_response = client.post(
        "/api/v1/organizations",
        json={"name": "Institution Test", "country": "Guinee", "sector": "Public"},
        headers=auth_headers,
    )
    assert org_response.status_code == 201

    opp_response = client.post(
        "/api/v1/opportunities",
        json={
            "organization_id": org_response.json()["id"],
            "title": "Mission data et IA",
            "probability": 60,
        },
        headers=auth_headers,
    )
    assert opp_response.status_code == 201

    tender_id = None
    if with_tender:
        tender_response = client.post(
            "/api/v1/tenders",
            json={
                "opportunity_id": opp_response.json()["id"],
                "reference": "AO-TEST-001",
                "title": "Appel d offres data",
                "buyer_name": "Institution Test",
            },
            headers=auth_headers,
        )
        assert tender_response.status_code == 201
        tender_id = tender_response.json()["id"]

    assignment_payload = {
        "agent_id": agent_response.json()["id"],
        "opportunity_id": opp_response.json()["id"],
        "assignment_type": "analysis",
        "objective": "Preparer une analyse de mission et les actions de livraison.",
        "expected_deliverable": "Plan d action",
        "priority": "Haute",
        "status": "planned",
        "human_reviewer": "Sekouna",
    }
    if tender_id is not None:
        assignment_payload["tender_id"] = tender_id

    assignment_response = client.post(
        "/api/v1/agents/assignments",
        json=assignment_payload,
        headers=auth_headers,
    )
    assert assignment_response.status_code == 201
    return assignment_response.json()["id"]


def test_agent_actions_require_authentication(client):
    response = client.get("/api/v1/agent-actions")
    assert response.status_code == 401


def test_plan_agent_actions_is_idempotent(client, auth_headers):
    assignment_id = create_assignment_scope(client, auth_headers)

    first_plan = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment_id, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert first_plan.status_code == 201
    assert len(first_plan.json()) == 3

    second_plan = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment_id, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert second_plan.status_code == 201
    assert second_plan.json() == []

    list_response = client.get(
        f"/api/v1/agent-actions?assignment_id={assignment_id}",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 3


def test_plan_for_tender_assignment_adds_tender_review(client, auth_headers):
    assignment_id = create_assignment_scope(client, auth_headers, with_tender=True)

    plan_response = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment_id, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert plan_response.status_code == 201
    action_types = {item["action_type"] for item in plan_response.json()}
    assert "tender_requirements_review" in action_types
    assert len(plan_response.json()) == 4


def test_run_action_requires_human_approval_when_sensitive(client, auth_headers):
    assignment_id = create_assignment_scope(client, auth_headers)
    plan_response = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment_id, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert plan_response.status_code == 201

    sensitive_action = next(item for item in plan_response.json() if item["requires_human_approval"])

    blocked_run = client.post(
        "/api/v1/agent-actions/run",
        json={"action_id": sensitive_action["id"], "actor_name": "system", "force": False},
        headers=auth_headers,
    )
    assert blocked_run.status_code == 403

    approve_response = client.post(
        f"/api/v1/agent-actions/{sensitive_action['id']}/approve?actor_name=Sekouna",
        headers=auth_headers,
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"
    assert approve_response.json()["approved_by"] == "Sekouna"

    run_response = client.post(
        "/api/v1/agent-actions/run",
        json={"action_id": sensitive_action["id"], "actor_name": "system", "force": False},
        headers=auth_headers,
    )
    assert run_response.status_code == 200
    assert run_response.json()["status"] == "done"
    assert run_response.json()["result_summary"]


def test_run_auto_ready_action_without_approval(client, auth_headers):
    assignment_id = create_assignment_scope(client, auth_headers)
    plan_response = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment_id, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert plan_response.status_code == 201

    auto_action = next(item for item in plan_response.json() if not item["requires_human_approval"])

    run_response = client.post(
        "/api/v1/agent-actions/run",
        json={"action_id": auto_action["id"], "actor_name": "system", "force": False},
        headers=auth_headers,
    )
    assert run_response.status_code == 200
    assert run_response.json()["status"] == "done"
    assert run_response.json()["next_step"]


def test_create_action_rejects_unknown_assignment(client, auth_headers):
    response = client.post(
        "/api/v1/agent-actions",
        json={
            "assignment_id": 999,
            "action_type": "analysis",
            "title": "Action invalide",
            "description": "Cette action doit etre rejetee.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_plan_rejects_unknown_assignment(client, auth_headers):
    response = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": 999, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert response.status_code == 404
