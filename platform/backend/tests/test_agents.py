def test_agents_require_authentication(client):
    response = client.get("/api/v1/agents")
    assert response.status_code == 401


def test_create_list_read_update_agent(client, auth_headers):
    payload = {
        "name": "Data Architect Agent",
        "slug": "data-architect-agent",
        "domain": "data-architecture",
        "seniority": "senior",
        "languages": "fr,en",
        "mission_types": "architecture,ao,governance",
        "description": "Agent specialise en architecture data.",
        "instruction_template": "Analyser le besoin et proposer une architecture data robuste avec gouvernance.",
        "tools": "documents,crm,tenders",
        "governance_rules": "Validation humaine obligatoire avant livraison client.",
        "is_active": True,
    }

    create_response = client.post("/api/v1/agents", json=payload, headers=auth_headers)
    assert create_response.status_code == 201
    agent = create_response.json()
    assert agent["id"] == 1
    assert agent["slug"] == payload["slug"]

    duplicate_response = client.post("/api/v1/agents", json=payload, headers=auth_headers)
    assert duplicate_response.status_code == 400

    list_response = client.get("/api/v1/agents", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    read_response = client.get("/api/v1/agents/1", headers=auth_headers)
    assert read_response.status_code == 200
    assert read_response.json()["domain"] == "data-architecture"

    patch_response = client.patch(
        "/api/v1/agents/1",
        json={"seniority": "principal", "is_active": False},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["seniority"] == "principal"
    assert patch_response.json()["is_active"] is False


def test_create_assignment_for_opportunity(client, auth_headers):
    agent_response = client.post(
        "/api/v1/agents",
        json={
            "name": "AO Analyst Agent",
            "slug": "ao-analyst-agent",
            "domain": "public-tenders",
            "instruction_template": "Analyser un appel d offres et produire une synthese exploitable.",
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
        json={
            "organization_id": org_response.json()["id"],
            "title": "Mission data ARPT",
            "probability": 50,
        },
        headers=auth_headers,
    )
    assert opp_response.status_code == 201

    assignment_response = client.post(
        "/api/v1/agents/assignments",
        json={
            "agent_id": agent_response.json()["id"],
            "opportunity_id": opp_response.json()["id"],
            "assignment_type": "analysis",
            "objective": "Analyser le besoin et preparer une proposition de cadrage.",
            "expected_deliverable": "Note de cadrage",
            "priority": "Haute",
            "status": "planned",
            "human_reviewer": "Sekouna",
        },
        headers=auth_headers,
    )
    assert assignment_response.status_code == 201
    assert assignment_response.json()["priority"] == "Haute"

    list_response = client.get("/api/v1/agents/assignments/list", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    patch_response = client.patch(
        "/api/v1/agents/assignments/1",
        json={"status": "in_review"},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "in_review"


def test_assignment_rejects_unknown_agent(client, auth_headers):
    response = client.post(
        "/api/v1/agents/assignments",
        json={
            "agent_id": 999,
            "opportunity_id": 1,
            "objective": "Analyser une opportunite commerciale.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
