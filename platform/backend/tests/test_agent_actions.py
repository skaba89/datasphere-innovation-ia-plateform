def create_agent_assignment(client, auth_headers):
    agent_response = client.post(
        "/api/v1/agents",
        json={
            "name": "AO Analyst",
            "slug": "ao-analyst-action-test",
            "domain": "public-tenders",
            "instruction_template": "Analyser les dossiers et proposer un plan d actions supervise.",
        },
        headers=auth_headers,
    )
    assert agent_response.status_code == 201

    org_response = client.post(
        "/api/v1/organizations",
        json={"name": "ARPT", "country": "Guinee", "sector": "Public"},
        headers=auth_headers,
    )
    assert org_response.status_code == 201

    opp_response = client.post(
        "/api/v1/opportunities",
        json={"organization_id": org_response.json()["id"], "title": "AO data", "probability": 50},
        headers=auth_headers,
    )
    assert opp_response.status_code == 201

    assignment_response = client.post(
        "/api/v1/agents/assignments",
        json={
            "agent_id": agent_response.json()["id"],
            "opportunity_id": opp_response.json()["id"],
            "assignment_type": "analysis",
            "objective": "Preparer un plan d actions pour l opportunite.",
            "priority": "Haute",
            "human_reviewer": "Sekouna",
        },
        headers=auth_headers,
    )
    assert assignment_response.status_code == 201
    return assignment_response.json()["id"]


def test_agent_actions_require_authentication(client):
    response = client.get("/api/v1/agent-actions")
    assert response.status_code == 401


def test_plan_list_and_approve_agent_actions(client, auth_headers):
    assignment_id = create_agent_assignment(client, auth_headers)

    plan_response = client.post(
        "/api/v1/agent-actions/plan",
        json={"assignment_id": assignment_id, "mode": "safe_auto"},
        headers=auth_headers,
    )
    assert plan_response.status_code == 201
    planned_actions = plan_response.json()
    assert len(planned_actions) >= 3
    assert planned_actions[0]["status"] == "auto_ready"

    list_response = client.get(f"/api/v1/agent-actions?assignment_id={assignment_id}", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == len(planned_actions)

    approval_action = next(item for item in planned_actions if item["requires_human_approval"] is True)
    approve_response = client.post(
        f"/api/v1/agent-actions/{approval_action['id']}/approve?actor_name=Sekouna",
        headers=auth_headers,
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"
    assert approve_response.json()["approved_by"] == "Sekouna"


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
