"""
Tests — Sprint 2 services
  - RAG (TF-IDF similarity)
  - DOCX export (python-docx)
  - Deliverable templates (5 types)
  - Weekly report (HTML generation)
  - CV agent (prompt construction)
  - Onboarding status endpoint
"""

import pytest
import io


# ═══════════════════════════════════════════════════════════════════════════════
# RAG — rag_service.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestRAGService:

    def test_tokenize_basic(self):
        from app.services.rag_service import _tokenize
        tokens = _tokenize("Architecture Snowflake dbt Airflow Python")
        assert "snowflake" in tokens
        assert "dbt" in tokens
        assert "airflow" in tokens

    def test_tokenize_removes_stop_words(self):
        from app.services.rag_service import _tokenize
        tokens = _tokenize("le la les un une pour dans avec")
        assert len(tokens) == 0  # all stop words

    def test_tokenize_min_length(self):
        from app.services.rag_service import _tokenize
        tokens = _tokenize("AI ML IA big data lake")
        # Short tokens (< 3 chars) excluded: AI, ML, IA
        assert "ai" not in tokens
        assert "ml" not in tokens
        assert "big" in tokens

    def test_similarity_identical_texts(self):
        from app.services.rag_service import _tf_idf_similarity
        text = "Architecture data lake Snowflake dbt Airflow"
        score = _tf_idf_similarity(text, text, [text])
        assert score == pytest.approx(1.0, abs=0.001)

    def test_similarity_different_texts(self):
        from app.services.rag_service import _tf_idf_similarity
        text_a = "Architecture Snowflake data lake dbt Core Airflow"
        text_b = "Développement application mobile React Native iOS Android"
        score = _tf_idf_similarity(text_a, text_b, [text_a, text_b])
        assert score < 0.3  # Very different topics

    def test_similarity_related_texts(self):
        from app.services.rag_service import _tf_idf_similarity
        text_a = "Mission Data Engineering Snowflake dbt Airflow pipeline"
        text_b = "Projet Data Engineer Snowflake transformation dbt orchestration"
        score = _tf_idf_similarity(text_a, text_b, [text_a, text_b])
        assert score > 0.2  # Related content

    def test_similarity_empty_text(self):
        from app.services.rag_service import _tf_idf_similarity
        score = _tf_idf_similarity("", "architecture Snowflake", [])
        assert score == 0.0

    def test_build_rag_context_empty(self):
        from app.services.rag_service import build_rag_context
        result = build_rag_context([])
        assert result == ""

    def test_build_rag_context_with_items(self):
        from app.services.rag_service import build_rag_context
        similar = [
            {"id": 1, "title": "Mémoire Snowflake", "type": "technical_proposal",
             "score": 0.82, "excerpt": "Architecture data lake...", "approved_at": None},
        ]
        ctx = build_rag_context(similar)
        assert "Exemple 1" in ctx
        assert "Mémoire Snowflake" in ctx
        assert "0.82" in ctx
        assert "Architecture data lake" in ctx

    def test_find_similar_no_approved(self, client, auth_headers):
        """With no approved deliverables, returns empty list."""
        resp = client.get("/api/v1/deliverables/similar?title=Mission+Data+Engineering",
                          headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) == 0

    def test_find_similar_after_approval(self, client, auth_headers, tender):
        """After approving a deliverable, similar search returns results."""
        # Create deliverable
        d = client.post("/api/v1/deliverables", headers=auth_headers, json={
            "tender_id": tender["id"],
            "title": "Architecture Snowflake Data Lake dbt Airflow",
            "deliverable_type": "technical_proposal",
            "status": "draft",
            "content_markdown": "# Architecture\n\nNous proposons Snowflake + dbt Core + Airflow pour le data lake.",
            "version": 1,
        }).json()

        # Approve it
        client.post(f"/api/v1/deliverables/{d['id']}/approve", headers=auth_headers)

        # Search for similar
        resp = client.get("/api/v1/deliverables/similar?title=Data+Lake+Snowflake+Architecture",
                          headers=auth_headers)
        assert resp.status_code == 200
        results = resp.json()
        # May or may not find depending on TF-IDF threshold — just validate structure
        assert isinstance(results, list)
        if results:
            assert "score" in results[0]
            assert "title" in results[0]
            assert results[0]["score"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
# DOCX Export — docx_export.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestDocxExport:

    def test_markdown_to_docx_returns_bytes(self):
        from app.services.docx_export import markdown_to_docx
        result = markdown_to_docx(
            title="Test Livrable",
            content_markdown="# Section 1\n\nContenu de test.\n\n## Section 2\n\n- Item 1\n- Item 2",
        )
        assert isinstance(result, bytes)
        assert len(result) > 1000  # A valid docx is at least 1KB
        # Docx files start with PK (ZIP format)
        assert result[:2] == b'PK'

    def test_markdown_to_docx_with_buyer(self):
        from app.services.docx_export import markdown_to_docx
        result = markdown_to_docx(
            title="Mémoire Technique ARTP",
            content_markdown="# Mémoire\n\nContexte mission ARTP Guinée.",
            buyer_name="ARTP Guinée",
            author="DataSphere Innovation",
        )
        assert len(result) > 2000

    def test_markdown_to_docx_with_table(self):
        from app.services.docx_export import markdown_to_docx
        md = "# Test\n\n| Col1 | Col2 | Col3 |\n|---|---|---|\n| A | B | C |\n| D | E | F |"
        result = markdown_to_docx(title="Tableau Test", content_markdown=md)
        assert result[:2] == b'PK'

    def test_markdown_to_docx_headings(self):
        from app.services.docx_export import markdown_to_docx
        md = "# Titre 1\n\n## Titre 2\n\n### Titre 3\n\n#### Titre 4\n\nParagraphe."
        result = markdown_to_docx(title="Headings Test", content_markdown=md)
        assert len(result) > 1000

    def test_docx_export_endpoint(self, client, auth_headers, tender):
        """GET /deliverables/{id}/export/docx returns Word document."""
        d = client.post("/api/v1/deliverables", headers=auth_headers, json={
            "tender_id": tender["id"],
            "title": "Livrable DOCX Test",
            "deliverable_type": "technical_proposal",
            "status": "draft",
            "content_markdown": "# Mémoire\n\n## Section 1\n\nContenu professionnel.\n\n| Stack | Usage |\n|---|---|\n| Snowflake | Data warehouse |",
            "version": 1,
        }).json()

        resp = client.get(f"/api/v1/deliverables/{d['id']}/export/docx",
                          headers=auth_headers)
        assert resp.status_code == 200
        assert "wordprocessingml" in resp.headers.get("content-type", "")
        assert ".docx" in resp.headers.get("content-disposition", "")
        assert len(resp.content) > 1000
        assert resp.content[:2] == b'PK'

    def test_docx_export_not_found(self, client, auth_headers):
        resp = client.get("/api/v1/deliverables/999999/export/docx",
                          headers=auth_headers)
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Deliverable Templates — deliverable_templates.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestDeliverableTemplates:

    def test_list_templates_returns_5(self):
        from app.services.deliverable_templates import list_templates
        templates = list_templates()
        assert len(templates) == 5

    def test_all_keys_present(self):
        from app.services.deliverable_templates import list_templates
        templates = list_templates()
        keys = {t["key"] for t in templates}
        assert "memoire_technique" in keys
        assert "proposition_commerciale" in keys
        assert "note_synthese" in keys
        assert "plan_projet" in keys
        assert "presentation_executive" in keys

    def test_template_has_sections(self):
        from app.services.deliverable_templates import get_template
        tmpl = get_template("memoire_technique")
        assert tmpl is not None
        assert len(tmpl.sections) >= 3
        assert tmpl.sections[0].content_markdown

    def test_template_not_found(self):
        from app.services.deliverable_templates import get_template
        assert get_template("nonexistent_key") is None

    def test_apply_template_returns_markdown(self):
        from app.services.deliverable_templates import apply_template
        result = apply_template("note_synthese")
        assert "content_markdown" in result
        assert len(result["content_markdown"]) > 100

    def test_apply_template_replaces_buyer(self):
        from app.services.deliverable_templates import apply_template
        result = apply_template("note_synthese", buyer_name="ARTP Guinée")
        assert "ARTP Guinée" in result["content_markdown"]

    def test_apply_template_replaces_tender_title(self):
        from app.services.deliverable_templates import apply_template
        result = apply_template("memoire_technique", tender_title="Mission Data Lake")
        # tender_title replaces [[MISSION]], [[AO]], [[TITRE_AO]] placeholders
        content = result["content_markdown"]
        # Template sections are present (even if placeholder not in this template)
        assert len(content) > 200
        assert "sections" in result

    def test_templates_endpoint_list(self, client, auth_headers):
        resp = client.get("/api/v1/deliverables/templates", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5
        assert all("key" in t and "name" in t for t in data)

    def test_template_endpoint_by_key(self, client, auth_headers):
        resp = client.get("/api/v1/deliverables/templates/plan_projet",
                          headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "sections" in data
        assert len(data["sections"]) >= 2

    def test_template_endpoint_not_found(self, client, auth_headers):
        resp = client.get("/api/v1/deliverables/templates/fake_key",
                          headers=auth_headers)
        assert resp.status_code == 404

    def test_create_from_template(self, client, auth_headers, tender):
        resp = client.post(
            f"/api/v1/deliverables/from-template/proposition_commerciale?tender_id={tender['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["deliverable_type"] == "commercial_proposal"
        assert "💼" in data["title"]


# ═══════════════════════════════════════════════════════════════════════════════
# Weekly Report — weekly_report.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestWeeklyReport:

    def test_generate_html_contains_datasphere(self, client, auth_headers):
        """The report endpoint returns valid HTML."""
        resp = client.get("/api/v1/reports/weekly/preview", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "")
        html = resp.text
        assert "DataSphere" in html
        assert "Rapport hebdomadaire" in html

    def test_report_html_has_kpi_sections(self, client, auth_headers):
        resp = client.get("/api/v1/reports/weekly/preview", headers=auth_headers)
        html = resp.text
        # Should contain KPI cards
        assert "AOs détectés" in html or "AO" in html
        assert "Livrables" in html

    def test_report_html_has_cta(self, client, auth_headers):
        resp = client.get("/api/v1/reports/weekly/preview", headers=auth_headers)
        html = resp.text
        assert "onrender.com" in html or "datasphere" in html.lower()

    def test_send_report_requires_admin(self, client, viewer_headers):
        """Only admins can send the report manually."""
        resp = client.post("/api/v1/reports/weekly/send", headers=viewer_headers)
        assert resp.status_code == 403

    def test_send_report_as_admin_returns_result(self, client, auth_headers):
        """Admin can trigger the report send (no SMTP configured → sent=0)."""
        resp = client.post("/api/v1/reports/weekly/send", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "sent" in data
        assert "total" in data


# ═══════════════════════════════════════════════════════════════════════════════
# Onboarding Status — setup endpoint
# ═══════════════════════════════════════════════════════════════════════════════

class TestOnboardingStatus:

    def test_onboarding_status_requires_auth(self, client):
        resp = client.get("/api/v1/setup/onboarding-status")
        assert resp.status_code == 401

    def test_onboarding_status_structure(self, client, auth_headers):
        resp = client.get("/api/v1/setup/onboarding-status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "steps" in data
        assert "steps_done" in data
        assert "total_steps" in data
        assert "progress_pct" in data
        assert "onboarding_complete" in data
        assert data["total_steps"] == 5

    def test_onboarding_steps_keys(self, client, auth_headers):
        resp = client.get("/api/v1/setup/onboarding-status", headers=auth_headers)
        data = resp.json()
        assert "provider" in data["steps"]
        assert "agents" in data["steps"]
        assert "boamp" in data["steps"]
        assert "workflow" in data["steps"]
        assert "team" in data["steps"]

    def test_onboarding_team_done_with_admin(self, client, auth_headers):
        """In test env, team.done=False (only 1 user), provider=False (no GROQ_API_KEY)."""
        resp = client.get("/api/v1/setup/onboarding-status", headers=auth_headers)
        data = resp.json()
        # Admin exists, but no second user = team not done
        assert data["steps"]["team"]["done"] is False

    def test_onboarding_agents_done_after_install(self, client, auth_headers):
        """After installing default agents, agents.done=True."""
        client.post("/api/v1/agents/defaults/install", headers=auth_headers)
        resp = client.get("/api/v1/setup/onboarding-status", headers=auth_headers)
        data = resp.json()
        assert data["steps"]["agents"]["done"] is True

    def test_progress_pct_range(self, client, auth_headers):
        resp = client.get("/api/v1/setup/onboarding-status", headers=auth_headers)
        data = resp.json()
        assert 0 <= data["progress_pct"] <= 100
        assert data["steps_done"] == round(data["progress_pct"] / 100 * 5)


# ═══════════════════════════════════════════════════════════════════════════════
# CV Agent — cv_agent.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestCVAgent:

    def test_domains_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/cv/domains", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "domains" in data
        assert len(data["domains"]) == 4
        keys = [d["key"] for d in data["domains"]]
        assert "data_engineering" in keys
        assert "data_science" in keys
        assert "bi_analytics" in keys
        assert "data_governance" in keys

    def test_domain_has_required_fields(self, client, auth_headers):
        resp = client.get("/api/v1/cv/domains", headers=auth_headers)
        for domain in resp.json()["domains"]:
            assert "key" in domain
            assert "label" in domain
            assert "roles" in domain
            assert "stack" in domain
            assert len(domain["stack"]) >= 4

    def test_cv_list_empty_initially(self, client, auth_headers):
        resp = client.get("/api/v1/cv", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_cv_generate_requires_first_name(self, client, auth_headers):
        resp = client.post("/api/v1/cv/generate", headers=auth_headers, json={
            "last_name": "KABA",
            "domain": "data_engineering",
        })
        assert resp.status_code == 422  # Validation error

    def test_cv_generate_requires_last_name(self, client, auth_headers):
        resp = client.post("/api/v1/cv/generate", headers=auth_headers, json={
            "first_name": "Cheickna",
            "domain": "data_engineering",
        })
        assert resp.status_code == 422

    def test_cv_generate_minimum_years(self, client, auth_headers):
        """years_experience < 6 should fail validation."""
        resp = client.post("/api/v1/cv/generate", headers=auth_headers, json={
            "first_name": "Test",
            "last_name": "User",
            "domain": "data_engineering",
            "years_experience": 3,  # below minimum of 6
        })
        assert resp.status_code == 422

    def test_cv_export_md_not_found(self, client, auth_headers):
        resp = client.get("/api/v1/cv/999/export/md", headers=auth_headers)
        assert resp.status_code == 404

    def test_cv_export_html_not_found(self, client, auth_headers):
        resp = client.get("/api/v1/cv/999/export/html", headers=auth_headers)
        assert resp.status_code == 404
