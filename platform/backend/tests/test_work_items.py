def create_scope(client, auth_headers):
    agent_response = client.post(
        "/api/v1/agents",
        json={
            "name": "Delivery Analyst",
            "slug": "delivery-analyst",
            "domain": "delivery",
            "instruction_template": "Analyser le contexte et preparer un livrable relu par un humain.",
        },
        headers=auth_headers,
    )
    assert agent_response.status_code == 201

    org_response = client.post(
        "/api/v1/organizations",
        json={"name": "DataSphere Client", "country": "Guinee", "sector": "Public"},
        headers=auth_headers,
    )
    assert org_response.status_code == 201

    opp_response = client.post(
        "/api/v1/opportunities",
        json={
            "organization_id": org_response.json()["id"],
            "title": "Mission conseil data",
            "probability": 40,
        },
        headers=auth_headers,
    )
    assert opp_response.status_code == 201

    assignment_response = client.post(
        "/api/v1/agents/assignments",
        json={
            "agent_id": agent_response.json()["id"],
            "opportunity_id": opp_response.json()["id"],
            "objective": "Preparer une premiere analyse de mission.",
        },
        headers=auth_headers,
    )
    assert assignment_response.status_code == 201

    return agent_response.json()["id"], opp_response.json()["id"], assignment_response.json()["id"]


def test_work_items_require_authentication(client):
    response = client.get("/api/v1/work-items")
    assert response.status_code == 401


def test_create_review_and_complete_work_item(client, auth_headers):
    agent_id, opportunity_id, assignment_id = create_scope(client, auth_headers)

    create_response = client.post(
        "/api/v1/work-items",
        json={
            "agent_id": agent_id,
            "assignment_id": assignment_id,
            "opportunity_id": opportunity_id,
            "title": "Analyse de cadrage",
            "category": "analysis",
            "objective": "Produire une synthese initiale pour cadrer la mission.",
            "expected_output": "Synthese de cadrage",
            "recommended_next_step": "Faire relire par le responsable commercial.",
            "priority": "Haute",
            "status": "draft",
            "needs_review": True,
            "created_by": "test-suite",
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    item = create_response.json()
    assert item["id"] == 1
    assert item["status"] == "draft"

    blocked_completion = client.post("/api/v1/work-items/1/complete", headers=auth_headers)
    assert blocked_completion.status_code == 400

    review_response = client.post("/api/v1/work-items/1/review", headers=auth_headers)
    assert review_response.status_code == 200
    assert review_response.json()["status"] == "reviewed"
    assert review_response.json()["reviewed_by"] == "admin@datasphere-innovation.net"

    complete_response = client.post("/api/v1/work-items/1/complete", headers=auth_headers)
    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "completed"

    list_response = client.get("/api/v1/work-items", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_work_item_rejects_unknown_agent(client, auth_headers):
    response = client.post(
        "/api/v1/work-items",
        json={
            "agent_id": 999,
            "opportunity_id": 1,
            "title": "Invalid item",
            "objective": "Verifier le rejet des references invalides.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
