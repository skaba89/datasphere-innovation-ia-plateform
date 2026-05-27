def test_default_agents_install_requires_authentication(client):
    response = client.post("/api/v1/agents/defaults/install")
    assert response.status_code == 401


def test_install_default_agents_is_idempotent(client, auth_headers):
    preview_before = client.get("/api/v1/agents/defaults", headers=auth_headers)
    assert preview_before.status_code == 200
    assert preview_before.json() == []

    first_install = client.post("/api/v1/agents/defaults/install", headers=auth_headers)
    assert first_install.status_code == 201
    installed = first_install.json()
    assert len(installed) == 5
    assert {item["slug"] for item in installed} == {
        "data-architect-senior",
        "expert-reponse-ao",
        "consultant-data-gouvernance",
        "business-analyst-it-data",
        "expert-documentation-client",
    }

    second_install = client.post("/api/v1/agents/defaults/install", headers=auth_headers)
    assert second_install.status_code == 201
    assert len(second_install.json()) == 5
    assert [item["id"] for item in second_install.json()] == [item["id"] for item in installed]

    preview_after = client.get("/api/v1/agents/defaults", headers=auth_headers)
    assert preview_after.status_code == 200
    assert len(preview_after.json()) == 5

    list_response = client.get("/api/v1/agents", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 5
