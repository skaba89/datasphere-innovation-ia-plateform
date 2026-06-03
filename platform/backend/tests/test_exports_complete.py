"""
Exports complete test suite.
Covers: Excel exports, CSV exports, deliverable exports (MD, HTML),
email preview, audit CSV, RBAC.
"""
import pytest


class TestExcelExports:
    BASE = "/api/v1/export/excel"

    def test_all_exports_require_auth(self, client):
        for path in ["/pipeline", "/tenders", "/actions", "/deliverables", "/full-report"]:
            assert client.get(f"{self.BASE}{path}").status_code == 401

    def test_pipeline_returns_xlsx(self, client, auth_headers):
        r = client.get(f"{self.BASE}/pipeline", headers=auth_headers)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")

    def test_tenders_returns_xlsx(self, client, auth_headers):
        r = client.get(f"{self.BASE}/tenders", headers=auth_headers)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")

    def test_actions_returns_xlsx(self, client, auth_headers):
        r = client.get(f"{self.BASE}/actions", headers=auth_headers)
        assert r.status_code == 200

    def test_deliverables_returns_xlsx(self, client, auth_headers):
        r = client.get(f"{self.BASE}/deliverables", headers=auth_headers)
        assert r.status_code == 200

    def test_full_report_returns_xlsx(self, client, auth_headers):
        r = client.get(f"{self.BASE}/full-report", headers=auth_headers)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")

    def test_exports_with_data(self, client, auth_headers, tender, opportunity, deliverable):
        """Exports should not crash when data exists."""
        for path in ["/pipeline", "/tenders", "/deliverables", "/full-report"]:
            r = client.get(f"{self.BASE}{path}", headers=auth_headers)
            assert r.status_code == 200, f"Failed: {path}"

    def test_viewer_can_export(self, client, viewer_headers):
        r = client.get(f"{self.BASE}/pipeline", headers=viewer_headers)
        assert r.status_code == 200


class TestCsvExports:
    BASE = "/api/v1/export/excel"

    def test_contacts_csv_requires_auth(self, client):
        assert client.get(f"{self.BASE}/contacts/csv").status_code == 401

    def test_contacts_csv_returns_csv(self, client, auth_headers):
        r = client.get(f"{self.BASE}/contacts/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_contacts_csv_with_data(self, client, auth_headers, contact):
        r = client.get(f"{self.BASE}/contacts/csv", headers=auth_headers)
        assert r.status_code == 200
        content = r.text
        assert len(content) > 0

    def test_contacts_csv_has_headers(self, client, auth_headers):
        r = client.get(f"{self.BASE}/contacts/csv", headers=auth_headers)
        content = r.text
        assert any(h in content for h in ["ID", "Prénom", "Nom", "Email"])

    def test_opportunities_csv_requires_auth(self, client):
        assert client.get(f"{self.BASE}/opportunities/csv").status_code == 401

    def test_opportunities_csv_returns_csv(self, client, auth_headers):
        r = client.get(f"{self.BASE}/opportunities/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_opportunities_csv_with_data(self, client, auth_headers, opportunity):
        r = client.get(f"{self.BASE}/opportunities/csv", headers=auth_headers)
        content = r.text
        assert "Titre" in content or opportunity["title"] in content or len(content) > 10

    def test_audit_log_csv(self, client, auth_headers):
        r = client.get("/api/v1/audit-logs/export/csv", headers=auth_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")


class TestDeliverableExports:
    BASE = "/api/v1/deliverables"

    def test_markdown_export(self, client, auth_headers, deliverable):
        r = client.get(f"{self.BASE}/{deliverable['id']}/export/markdown", headers=auth_headers)
        assert r.status_code == 200
        # Should return text/plain or text/markdown
        content_type = r.headers.get("content-type", "")
        assert "text" in content_type or len(r.text) > 0

    def test_html_export(self, client, auth_headers, deliverable):
        r = client.get(f"{self.BASE}/{deliverable['id']}/export/html", headers=auth_headers)
        assert r.status_code == 200
        assert "html" in r.headers.get("content-type", "").lower() or "<" in r.text

    def test_export_not_found(self, client, auth_headers):
        r = client.get(f"{self.BASE}/999999/export/markdown", headers=auth_headers)
        assert r.status_code == 404

    def test_email_preview(self, client, auth_headers, deliverable):
        r = client.get(f"{self.BASE}/{deliverable['id']}/email-preview", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "subject" in data or "html" in data or "body" in data or "preview" in data

    def test_send_email_preview_mode(self, client, auth_headers, deliverable):
        """Without SMTP, send should return preview-mode result, not 500."""
        r = client.post(f"{self.BASE}/{deliverable['id']}/send-email", headers=auth_headers, json={
            "to_email": "client@test.com", "to_name": "Client Test",
        })
        assert r.status_code in (200, 202, 400)  # Not 500


class TestCvGenerator:
    def test_generate_cv_docx(self, client, auth_headers):
        r = client.post("/api/v1/deliverables/cv/generate", headers=auth_headers, json={
            "consultant": {
                "name": "Sekouna KABA",
                "title": "Senior Data Engineer",
                "summary": "Expert Data Engineering avec 8 ans d'expérience.",
                "experience_years": 8,
                "daily_rate": "650-800 € HT",
                "skills": ["Snowflake", "dbt", "Airflow", "Python"],
                "languages": ["Français (natif)", "Anglais (courant)"],
                "experiences": [],
                "education": [{"degree": "Master 2 SID", "school": "Paris 1", "year": "2015"}],
                "certifications": ["AWS SAA"],
            }
        })
        assert r.status_code == 200
        assert "openxmlformats" in r.headers.get("content-type", "")
        assert len(r.content) > 1000  # Non-empty DOCX

    def test_generate_cv_with_tender_context(self, client, auth_headers, tender):
        r = client.post("/api/v1/deliverables/cv/generate", headers=auth_headers, json={
            "consultant": {
                "name": "Test Consultant",
                "title": "Data Architect",
                "skills": ["SQL", "Python"],
                "languages": ["Français"],
                "experiences": [],
            },
            "tender_id": tender["id"],
        })
        assert r.status_code == 200

    def test_generate_cv_requires_auth(self, client):
        r = client.post("/api/v1/deliverables/cv/generate", json={"consultant": {"name": "Test"}})
        assert r.status_code == 401
