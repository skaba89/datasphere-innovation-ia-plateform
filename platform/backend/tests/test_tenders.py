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


def create_test_opportunity(client, auth_headers):
    organization_id = create_test_organization(client, auth_headers)
    response = client.post(
        "/api/v1/opportunities",
        json={
            "organization_id": organization_id,
            "title": "Plateforme data et IA",
            "opportunity_type": "Appel d offres public",
            "country": "Guinee",
            "sector": "Data, IT, IA",
            "status": "Besoin qualifie",
            "priority": "Haute",
            "potential_value": "25000.00",
            "probability": 50,
            "next_action": "Analyser le cahier des charges",
            "owner_name": "Sekouna",
            "notes": "Opportunite de test pour appel d offres.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_test_tender(client, auth_headers):
    opportunity_id = create_test_opportunity(client, auth_headers)
    response = client.post(
        "/api/v1/tenders",
        json={
            "opportunity_id": opportunity_id,
            "reference": "AO-2026-001",
            "title": "Digitalisation et plateforme data institutionnelle",
            "buyer_name": "ARPT",
            "publication_date": None,
            "submission_deadline": None,
            "source_url": "https://example.org/ao",
            "summary": "Appel d offres de test.",
            "go_no_go_score": 80,
            "go_no_go_decision": "Go",
            "status": "draft",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_tenders_require_authentication(client):
    response = client.get("/api/v1/tenders")
    assert response.status_code == 401


def test_create_list_read_update_delete_tender(client, auth_headers):
    opportunity_id = create_test_opportunity(client, auth_headers)

    payload = {
        "opportunity_id": opportunity_id,
        "reference": "AO-2026-001",
        "title": "Digitalisation et plateforme data institutionnelle",
        "buyer_name": "ARPT",
        "publication_date": None,
        "submission_deadline": None,
        "source_url": "https://example.org/ao",
        "summary": "Appel d offres de test.",
        "go_no_go_score": 80,
        "go_no_go_decision": "Go",
        "status": "draft",
    }

    create_response = client.post("/api/v1/tenders", json=payload, headers=auth_headers)
    assert create_response.status_code == 201
    tender = create_response.json()
    assert tender["id"] == 1
    assert tender["title"] == payload["title"]
    assert tender["reference"] == payload["reference"]

    list_response = client.get("/api/v1/tenders", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    read_response = client.get("/api/v1/tenders/1", headers=auth_headers)
    assert read_response.status_code == 200
    assert read_response.json()["title"] == payload["title"]

    patch_response = client.patch(
        "/api/v1/tenders/1",
        json={"status": "submitted", "go_no_go_score": 90},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "submitted"
    assert patch_response.json()["go_no_go_score"] == 90

    delete_response = client.delete("/api/v1/tenders/1", headers=auth_headers)
    assert delete_response.status_code == 204

    list_after_delete = client.get("/api/v1/tenders", headers=auth_headers)
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_tender_rejects_unknown_opportunity(client, auth_headers):
    response = client.post(
        "/api/v1/tenders",
        json={
            "opportunity_id": 999,
            "title": "Invalid tender",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_create_list_update_delete_tender_requirement(client, auth_headers):
    tender_id = create_test_tender(client, auth_headers)

    payload = {
        "tender_id": tender_id,
        "requirement_code": "EX-001",
        "section": "Conformite technique",
        "description": "Le prestataire doit proposer une architecture securisee et documentee.",
        "requirement_type": "Obligatoire",
        "response_strategy": "Decrire l architecture cible, les flux et les controles de securite.",
        "proof_or_deliverable": "Schema d architecture et memoire technique.",
        "owner_name": "Sekouna",
        "status": "A traiter",
        "comments": "Exigence critique.",
    }

    create_response = client.post(f"/api/v1/tenders/{tender_id}/requirements", json=payload, headers=auth_headers)
    assert create_response.status_code == 201
    requirement = create_response.json()
    assert requirement["id"] == 1
    assert requirement["requirement_code"] == "EX-001"

    list_response = client.get(f"/api/v1/tenders/{tender_id}/requirements", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    patch_response = client.patch(
        "/api/v1/tenders/requirements/1",
        json={"status": "Conforme", "comments": "Traitement valide."},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "Conforme"

    delete_response = client.delete("/api/v1/tenders/requirements/1", headers=auth_headers)
    assert delete_response.status_code == 204

    list_after_delete = client.get(f"/api/v1/tenders/{tender_id}/requirements", headers=auth_headers)
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_requirement_rejects_mismatched_tender_id(client, auth_headers):
    tender_id = create_test_tender(client, auth_headers)

    response = client.post(
        f"/api/v1/tenders/{tender_id}/requirements",
        json={
            "tender_id": 999,
            "description": "Exigence invalide.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
