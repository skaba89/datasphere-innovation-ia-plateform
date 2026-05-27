def test_organizations_require_authentication(client):
    response = client.get("/api/v1/organizations")
    assert response.status_code == 401


def test_create_list_read_update_delete_organization(client, auth_headers):
    payload = {
        "name": "DataSphere Innovation",
        "country": "France / Guinee",
        "sector": "Data, IT, IA",
        "organization_type": "Cabinet de conseil",
        "website": "https://datasphere-innovation.net",
        "description": "Cabinet de conseil augmente par agents IA.",
    }

    create_response = client.post("/api/v1/organizations", json=payload, headers=auth_headers)
    assert create_response.status_code == 201
    organization = create_response.json()
    assert organization["id"] == 1
    assert organization["name"] == payload["name"]

    list_response = client.get("/api/v1/organizations", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    read_response = client.get("/api/v1/organizations/1", headers=auth_headers)
    assert read_response.status_code == 200
    assert read_response.json()["name"] == payload["name"]

    patch_response = client.patch(
        "/api/v1/organizations/1",
        json={"country": "Guinee"},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["country"] == "Guinee"

    delete_response = client.delete("/api/v1/organizations/1", headers=auth_headers)
    assert delete_response.status_code == 204

    list_after_delete = client.get("/api/v1/organizations", headers=auth_headers)
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []
