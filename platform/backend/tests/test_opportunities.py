def create_test_organization(client, auth_headers):
    response = client.post(
        "/api/v1/organizations",
        json={
            "name": "ARPT",
            "country": "Guinee",
            "sector": "Institution publique",
            "organization_type": "Regulateur",
            "website": "https://example.org",
            "description": "Organisation de test.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_opportunities_require_authentication(client):
    response = client.get("/api/v1/opportunities")
    assert response.status_code == 401


def test_create_list_read_update_delete_opportunity(client, auth_headers):
    organization_id = create_test_organization(client, auth_headers)

    payload = {
        "organization_id": organization_id,
        "title": "Modernisation data et IA",
        "opportunity_type": "Mission conseil",
        "country": "Guinee",
        "sector": "Data, IT, IA",
        "status": "Prospect identifie",
        "priority": "Haute",
        "potential_value": "15000.00",
        "probability": 40,
        "next_action": "Planifier un rendez-vous de cadrage",
        "next_action_date": None,
        "owner_name": "Sekouna",
        "notes": "Opportunite de test.",
    }

    create_response = client.post("/api/v1/opportunities", json=payload, headers=auth_headers)
    assert create_response.status_code == 201
    opportunity = create_response.json()
    assert opportunity["id"] == 1
    assert opportunity["title"] == payload["title"]
    assert opportunity["priority"] == "Haute"

    list_response = client.get("/api/v1/opportunities", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    read_response = client.get("/api/v1/opportunities/1", headers=auth_headers)
    assert read_response.status_code == 200
    assert read_response.json()["title"] == payload["title"]

    patch_response = client.patch(
        "/api/v1/opportunities/1",
        json={"status": "Proposition envoyee", "probability": 60},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "Proposition envoyee"
    assert patch_response.json()["probability"] == 60

    delete_response = client.delete("/api/v1/opportunities/1", headers=auth_headers)
    assert delete_response.status_code == 204

    list_after_delete = client.get("/api/v1/opportunities", headers=auth_headers)
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_opportunity_rejects_unknown_organization(client, auth_headers):
    response = client.post(
        "/api/v1/opportunities",
        json={
            "organization_id": 999,
            "title": "Invalid opportunity",
            "probability": 10,
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
