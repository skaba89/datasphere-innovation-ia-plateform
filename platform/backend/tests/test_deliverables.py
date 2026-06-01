"""
Tests for the Deliverables API module.
Follows the same patterns as test_tenders.py and test_agents.py.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def create_test_organization(client, auth_headers):
    response = client.post(
        "/api/v1/organizations",
        json={
            "name": "ARPT Guinee",
            "country": "Guinee",
            "sector": "Institution publique",
            "organization_type": "Regulateur",
            "description": "Organisation de test pour livrables.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_test_opportunity(client, auth_headers):
    org_id = create_test_organization(client, auth_headers)
    response = client.post(
        "/api/v1/opportunities",
        json={
            "organization_id": org_id,
            "title": "Plateforme data et IA — ARPT",
            "opportunity_type": "Appel d offres public",
            "country": "Guinee",
            "sector": "Data, IT, IA",
            "status": "Besoin qualifie",
            "priority": "Haute",
            "potential_value": "50000.00",
            "probability": 70,
            "next_action": "Produire la note de cadrage",
            "owner_name": "Sekouna",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_test_deliverable(client, auth_headers, opportunity_id: int):
    response = client.post(
        "/api/v1/deliverables",
        json={
            "opportunity_id": opportunity_id,
            "title": "Note de cadrage — ARPT plateforme data",
            "deliverable_type": "note_cadrage",
            "status": "draft",
            "language": "fr",
            "audience": "Direction ARPT",
            "content_markdown": "# Note de cadrage\n\nContenu initial de la note de cadrage pour le projet ARPT.",
            "generated_by": "test",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


def test_deliverables_require_authentication(client):
    response = client.get("/api/v1/deliverables")
    assert response.status_code == 401


def test_deliverable_sections_require_authentication(client):
    response = client.get("/api/v1/deliverables/1/sections")
    assert response.status_code == 401


def test_deliverable_contributions_require_authentication(client):
    response = client.get("/api/v1/deliverables/1/contributions")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# CRUD — Deliverable
# ---------------------------------------------------------------------------


def test_create_and_list_deliverable(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)

    assert deliverable["id"] == 1
    assert deliverable["title"] == "Note de cadrage — ARPT plateforme data"
    assert deliverable["deliverable_type"] == "note_cadrage"
    assert deliverable["status"] == "draft"
    assert deliverable["version"] == 1
    assert deliverable["language"] == "fr"
    assert deliverable["opportunity_id"] == opp_id

    list_response = client.get("/api/v1/deliverables", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_read_deliverable(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    created = create_test_deliverable(client, auth_headers, opp_id)

    response = client.get(f"/api/v1/deliverables/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == created["title"]


def test_read_deliverable_not_found(client, auth_headers):
    response = client.get("/api/v1/deliverables/9999", headers=auth_headers)
    assert response.status_code == 404


def test_update_deliverable_increments_version(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    created = create_test_deliverable(client, auth_headers, opp_id)
    assert created["version"] == 1

    patch_response = client.patch(
        f"/api/v1/deliverables/{created['id']}",
        json={"content_markdown": "# Note de cadrage mise a jour\n\nContenu enrichi avec les informations complementaires."},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["version"] == 2


def test_delete_deliverable(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    created = create_test_deliverable(client, auth_headers, opp_id)

    delete_response = client.delete(f"/api/v1/deliverables/{created['id']}", headers=auth_headers)
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/v1/deliverables/{created['id']}", headers=auth_headers)
    assert get_response.status_code == 404


def test_filter_deliverables_by_opportunity(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    create_test_deliverable(client, auth_headers, opp_id)

    response = client.get(f"/api/v1/deliverables?opportunity_id={opp_id}", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1

    response_empty = client.get("/api/v1/deliverables?opportunity_id=9999", headers=auth_headers)
    assert response_empty.status_code == 200
    assert len(response_empty.json()) == 0


def test_create_deliverable_requires_scope(client, auth_headers):
    response = client.post(
        "/api/v1/deliverables",
        json={
            "title": "Livrable sans scope",
            "deliverable_type": "note_cadrage",
            "content_markdown": "Contenu sans aucun scope renseigne.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Review and Approve workflow
# ---------------------------------------------------------------------------


def test_review_deliverable(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    created = create_test_deliverable(client, auth_headers, opp_id)
    assert created["status"] == "draft"

    review_response = client.post(
        f"/api/v1/deliverables/{created['id']}/review",
        json={"reviewer_name": "Sekouna"},
        headers=auth_headers,
    )
    assert review_response.status_code == 200
    data = review_response.json()
    assert data["status"] == "in_review"
    assert data["reviewed_by"] == "Sekouna"
    assert data["reviewed_at"] is not None


def test_approve_deliverable(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    created = create_test_deliverable(client, auth_headers, opp_id)

    client.post(
        f"/api/v1/deliverables/{created['id']}/review",
        json={"reviewer_name": "Sekouna"},
        headers=auth_headers,
    )

    approve_response = client.post(
        f"/api/v1/deliverables/{created['id']}/approve",
        json={"approver_name": "Cheickna KABA"},
        headers=auth_headers,
    )
    assert approve_response.status_code == 200
    data = approve_response.json()
    assert data["status"] == "approved"
    assert data["approved_by"] == "Cheickna KABA"
    assert data["approved_at"] is not None


# ---------------------------------------------------------------------------
# Generate draft
# ---------------------------------------------------------------------------


def test_generate_draft_from_opportunity(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)

    response = client.post(
        "/api/v1/deliverables/generate-draft",
        json={
            "opportunity_id": opp_id,
            "deliverable_type": "note_cadrage",
            "language": "fr",
            "audience": "Direction",
            "generated_by": "agent",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["deliverable_type"] == "note_cadrage"
    assert data["generated_by"] == "agent"
    assert "Note de cadrage" in data["title"]
    assert len(data["content_markdown"]) > 100


def test_generate_draft_all_types(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable_types = [
        "note_cadrage",
        "memoire_technique",
        "plan_action",
        "synthese_contexte",
        "rapport_conformite",
        "offre_commerciale",
        "bilan_mission",
    ]
    for dtype in deliverable_types:
        response = client.post(
            "/api/v1/deliverables/generate-draft",
            json={"opportunity_id": opp_id, "deliverable_type": dtype},
            headers=auth_headers,
        )
        assert response.status_code == 201, f"Failed for type: {dtype}"
        assert response.json()["deliverable_type"] == dtype


def test_generate_draft_requires_scope(client, auth_headers):
    response = client.post(
        "/api/v1/deliverables/generate-draft",
        json={"deliverable_type": "note_cadrage"},
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


def test_create_and_list_sections(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)
    deliverable_id = deliverable["id"]

    section_response = client.post(
        f"/api/v1/deliverables/{deliverable_id}/sections",
        json={
            "deliverable_id": deliverable_id,
            "title": "Contexte et enjeux",
            "section_key": "contexte",
            "position": 1,
            "content_markdown": "Cette section decrit le contexte et les enjeux de la mission.",
        },
        headers=auth_headers,
    )
    assert section_response.status_code == 201
    section = section_response.json()
    assert section["title"] == "Contexte et enjeux"
    assert section["section_key"] == "contexte"
    assert section["status"] == "draft"

    list_response = client.get(f"/api/v1/deliverables/{deliverable_id}/sections", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_update_section(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)
    deliverable_id = deliverable["id"]

    section = client.post(
        f"/api/v1/deliverables/{deliverable_id}/sections",
        json={
            "deliverable_id": deliverable_id,
            "title": "Section initiale",
            "section_key": "intro",
            "position": 1,
            "content_markdown": "Contenu initial de la section.",
        },
        headers=auth_headers,
    ).json()

    patch = client.patch(
        f"/api/v1/deliverables/{deliverable_id}/sections/{section['id']}",
        json={"title": "Introduction mise a jour", "content_markdown": "Contenu enrichi de la section introduction."},
        headers=auth_headers,
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "Introduction mise a jour"


def test_review_and_approve_section(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)
    deliverable_id = deliverable["id"]

    section = client.post(
        f"/api/v1/deliverables/{deliverable_id}/sections",
        json={
            "deliverable_id": deliverable_id,
            "title": "Plan d action",
            "section_key": "plan",
            "position": 2,
            "content_markdown": "Actions prioritaires identifiees pour la mission.",
        },
        headers=auth_headers,
    ).json()

    review = client.post(
        f"/api/v1/deliverables/{deliverable_id}/sections/{section['id']}/review",
        json={"reviewer_name": "Sekouna"},
        headers=auth_headers,
    )
    assert review.status_code == 200
    assert review.json()["status"] == "in_review"

    approve = client.post(
        f"/api/v1/deliverables/{deliverable_id}/sections/{section['id']}/approve",
        json={"approver_name": "Cheickna KABA"},
        headers=auth_headers,
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"


def test_delete_section(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)
    deliverable_id = deliverable["id"]

    section = client.post(
        f"/api/v1/deliverables/{deliverable_id}/sections",
        json={
            "deliverable_id": deliverable_id,
            "title": "Section a supprimer",
            "section_key": "to_delete",
            "position": 1,
            "content_markdown": "Contenu temporaire qui sera supprime.",
        },
        headers=auth_headers,
    ).json()

    delete = client.delete(
        f"/api/v1/deliverables/{deliverable_id}/sections/{section['id']}",
        headers=auth_headers,
    )
    assert delete.status_code == 204


# ---------------------------------------------------------------------------
# Contributions
# ---------------------------------------------------------------------------


def test_create_and_list_contributions(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)
    deliverable_id = deliverable["id"]

    contrib_response = client.post(
        f"/api/v1/deliverables/{deliverable_id}/contributions",
        json={
            "deliverable_id": deliverable_id,
            "contribution_type": "section_draft",
            "summary": "Premiere contribution de l agent Data Architect.",
            "content_markdown": "L agent a produit une analyse preliminaire du contexte.",
            "status": "proposed",
            "created_by": "agent-data-architect",
        },
        headers=auth_headers,
    )
    assert contrib_response.status_code == 201
    contrib = contrib_response.json()
    assert contrib["contribution_type"] == "section_draft"
    assert contrib["status"] == "proposed"

    list_response = client.get(f"/api/v1/deliverables/{deliverable_id}/contributions", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_update_contribution(client, auth_headers):
    opp_id = create_test_opportunity(client, auth_headers)
    deliverable = create_test_deliverable(client, auth_headers, opp_id)
    deliverable_id = deliverable["id"]

    contrib = client.post(
        f"/api/v1/deliverables/{deliverable_id}/contributions",
        json={
            "deliverable_id": deliverable_id,
            "contribution_type": "full_draft",
            "content_markdown": "Brouillon complet initial produit par l agent.",
            "status": "proposed",
            "created_by": "agent-ao",
        },
        headers=auth_headers,
    ).json()

    patch = client.patch(
        f"/api/v1/deliverables/{deliverable_id}/contributions/{contrib['id']}",
        json={"status": "accepted", "summary": "Contribution acceptee par le reviewer."},
        headers=auth_headers,
    )
    assert patch.status_code == 200
    assert patch.json()["status"] == "accepted"
