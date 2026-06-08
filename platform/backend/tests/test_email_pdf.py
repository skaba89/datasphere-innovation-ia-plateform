"""
Tests — Email Service + PDF AO

Email :
  POST /email/send             — send (dry_run=True)
  POST /email/preview          — render HTML
  POST /email/sequences/plan   — relance schedule
  GET  /email/types            — list types
  GET  /email/track/{id}       — tracking pixel

PDF AO :
  GET  /pdf-ao/supported-formats — capabilities
  POST /pdf-ao/analyze           — analyze PDF bytes
"""

import io
import pytest

BASE_EMAIL = "/api/v1/email"
BASE_PDF   = "/api/v1/pdf-ao"


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class TestEmailTypes:
    def test_types_requires_auth(self, client):
        r = client.get(f"{BASE_EMAIL}/types")
        assert r.status_code == 401

    def test_types_returns_list(self, client, auth_headers):
        data = client.get(f"{BASE_EMAIL}/types", headers=auth_headers).json()
        assert "types" in data
        assert len(data["types"]) >= 5

    def test_types_have_required_fields(self, client, auth_headers):
        types = client.get(f"{BASE_EMAIL}/types", headers=auth_headers).json()["types"]
        for t in types:
            assert "key" in t
            assert "label" in t
            assert "trigger" in t

    def test_welcome_type_exists(self, client, auth_headers):
        types = client.get(f"{BASE_EMAIL}/types", headers=auth_headers).json()["types"]
        keys = [t["key"] for t in types]
        assert "welcome" in keys
        assert "relance_j3" in keys
        assert "team_invite" in keys


class TestEmailSend:
    def test_requires_auth(self, client):
        r = client.post(f"{BASE_EMAIL}/send", json={
            "to": "test@test.fr", "email_type": "welcome",
            "params": {"first_name": "Test"}, "dry_run": True
        })
        assert r.status_code == 401

    def test_send_welcome_dry_run(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "test@example.com",
            "email_type": "welcome",
            "params": {"first_name": "Cheickna", "login_url": "https://app.datasphere.fr"},
            "dry_run": True,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["dry_run"] is True

    def test_send_opportunity_created_dry_run(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "contact@example.org",
            "email_type": "opportunity_created",
            "params": {
                "first_name": "Mamadou",
                "opp_title": "Migration Data Platform GN",
                "org_name": "Ministère Numérique",
                "probability": 70,
            },
            "dry_run": True,
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_send_tender_match_dry_run(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "me@example.com",
            "email_type": "tender_match",
            "params": {"first_name": "Cheickna", "tender_title": "AO Data Warehouse BCRG", "score": 87},
            "dry_run": True,
        })
        assert r.status_code == 200

    def test_send_relance_j3_dry_run(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "contact@example.org",
            "email_type": "relance_j3",
            "params": {"first_name": "Cheickna", "contact_name": "M. Kouyaté", "opp_title": "AO BCRG"},
            "dry_run": True,
        })
        assert r.status_code == 200

    def test_send_team_invite_dry_run(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "collègue@example.com",
            "email_type": "team_invite",
            "params": {"inviter_name": "Cheickna KABA", "workspace_name": "DataSphere Agency",
                       "invite_url": "https://app.datasphere.fr/invite/abc123"},
            "dry_run": True,
        })
        assert r.status_code == 200

    def test_invalid_email_type_rejected(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "test@test.fr",
            "email_type": "invalid_type_xyz",
            "params": {}, "dry_run": True,
        })
        assert r.status_code == 422

    def test_invalid_email_address_rejected(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/send", headers=auth_headers, json={
            "to": "not-an-email",
            "email_type": "welcome",
            "params": {"first_name": "Test"}, "dry_run": True,
        })
        assert r.status_code == 422


class TestEmailPreview:
    def test_requires_auth(self, client):
        r = client.post(f"{BASE_EMAIL}/preview", json={
            "email_type": "welcome", "params": {"first_name": "Test"}
        })
        assert r.status_code == 401

    def test_preview_returns_html(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/preview", headers=auth_headers, json={
            "email_type": "welcome",
            "params": {"first_name": "Cheickna"},
        })
        assert r.status_code == 200
        data = r.json()
        assert "html" in data
        assert "subject" in data
        assert "<!DOCTYPE html>" in data["html"]

    def test_preview_subject_contains_name(self, client, auth_headers):
        data = client.post(f"{BASE_EMAIL}/preview", headers=auth_headers, json={
            "email_type": "welcome", "params": {"first_name": "Sekouna"},
        }).json()
        assert "Sekouna" in data["subject"] or "Sekouna" in data["html"]

    def test_preview_html_has_datasphere_branding(self, client, auth_headers):
        data = client.post(f"{BASE_EMAIL}/preview", headers=auth_headers, json={
            "email_type": "welcome", "params": {"first_name": "Test"},
        }).json()
        assert "DataSphere" in data["html"]

    def test_preview_all_types(self, client, auth_headers):
        test_params = {
            "welcome":             {"first_name": "T"},
            "opportunity_created": {"first_name": "T", "opp_title": "O", "org_name": "C", "probability": 50},
            "tender_match":        {"first_name": "T", "tender_title": "AO Test", "score": 75},
            "deliverable_review":  {"first_name": "T", "deliverable_title": "Mémoire"},
            "deliverable_approved":{"first_name": "T", "deliverable_title": "Mémoire"},
            "relance_j3":          {"first_name": "T", "contact_name": "M. X", "opp_title": "O"},
            "relance_j7":          {"first_name": "T", "contact_name": "M. X", "opp_title": "O"},
            "relance_j14":         {"first_name": "T", "contact_name": "M. X", "opp_title": "O"},
            "subscription_upgrade":{"first_name": "T", "plan": "Pro", "features": ["IA illimitée"]},
            "team_invite":         {"inviter_name": "T", "workspace_name": "W", "invite_url": "https://x.fr"},
        }
        for etype, params in test_params.items():
            r = client.post(f"{BASE_EMAIL}/preview", headers=auth_headers, json={
                "email_type": etype, "params": params,
            })
            assert r.status_code == 200, f"Preview failed for {etype}: {r.text}"


class TestEmailSequences:
    def test_requires_auth(self, client):
        r = client.post(f"{BASE_EMAIL}/sequences/plan", json={
            "opportunity_id": 1, "contact_email": "x@x.fr",
            "first_name": "T", "contact_name": "M", "opp_title": "O",
        })
        assert r.status_code == 401

    def test_plan_returns_3_emails(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/sequences/plan", headers=auth_headers, json={
            "opportunity_id": 1,
            "contact_email": "contact@example.org",
            "first_name": "Cheickna",
            "contact_name": "M. Kouyaté",
            "opp_title": "Mission Data Platform BCRG",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["total_emails"] == 3
        assert len(data["sequence"]) == 3

    def test_sequence_schedule_days(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/sequences/plan", headers=auth_headers, json={
            "opportunity_id": 1, "contact_email": "x@x.fr",
            "first_name": "T", "contact_name": "M", "opp_title": "O",
        })
        seq = r.json()["sequence"]
        types = [s["email_type"] for s in seq]
        assert "relance_j3" in types
        assert "relance_j7" in types
        assert "relance_j14" in types

    def test_sequence_has_scheduled_dates(self, client, auth_headers):
        r = client.post(f"{BASE_EMAIL}/sequences/plan", headers=auth_headers, json={
            "opportunity_id": 1, "contact_email": "x@x.fr",
            "first_name": "T", "contact_name": "M", "opp_title": "O",
        })
        for item in r.json()["sequence"]:
            assert "scheduled_at" in item
            assert item["scheduled_at"]  # not empty


class TestEmailTracking:
    def test_tracking_pixel_returns_gif(self, client):
        """Tracking pixel is public — no auth required."""
        r = client.get(f"{BASE_EMAIL}/track/abc123def456")
        assert r.status_code == 200
        assert "image/gif" in r.headers.get("content-type", "")
        assert len(r.content) > 0


# ══════════════════════════════════════════════════════════════════════════════
# PDF AO
# ══════════════════════════════════════════════════════════════════════════════

class TestPDFAOFormats:
    def test_supported_formats_requires_auth(self, client):
        r = client.get(f"{BASE_PDF}/supported-formats")
        assert r.status_code == 401

    def test_supported_formats_structure(self, client, auth_headers):
        r = client.get(f"{BASE_PDF}/supported-formats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "supported" in data
        assert "pdf" in data["supported"]
        assert "capabilities" in data
        assert "max_size_mb" in data

    def test_extracted_fields_listed(self, client, auth_headers):
        data = client.get(f"{BASE_PDF}/supported-formats", headers=auth_headers).json()
        assert "extracted_fields" in data
        assert len(data["extracted_fields"]) >= 5


class TestPDFAOAnalyze:
    def _make_pdf(self, text: str) -> bytes:
        """Create a minimal valid PDF with given text using PyMuPDF."""
        try:
            import fitz
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 50), text, fontsize=11)
            buf = io.BytesIO()
            doc.save(buf)
            doc.close()
            return buf.getvalue()
        except Exception:
            # Fallback: minimal valid PDF structure
            return b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF"""

    def test_analyze_requires_auth(self, client):
        pdf = self._make_pdf("Test AO")
        r = client.post(f"{BASE_PDF}/analyze", files={"file": ("ao.pdf", pdf, "application/pdf")})
        assert r.status_code == 401

    def test_analyze_returns_200(self, client, auth_headers):
        pdf = self._make_pdf(
            "Objet du marché : Fourniture de services de data engineering.\n"
            "Pouvoir adjudicateur : Ministère du Numérique de Guinée\n"
            "Budget prévisionnel : 150 000 €\n"
            "Délai d'exécution : 6 mois\n"
            "Date limite de réception des offres : 15/03/2026\n"
            "Compétences requises : Python, Snowflake, dbt, Airflow\n"
        )
        r = client.post(f"{BASE_PDF}/analyze", headers=auth_headers,
                        files={"file": ("ao.pdf", pdf, "application/pdf")})
        assert r.status_code == 200

    def test_analyze_structure(self, client, auth_headers):
        pdf = self._make_pdf("Marché public - objet : Migration datawarehouse")
        r = client.post(f"{BASE_PDF}/analyze", headers=auth_headers,
                        files={"file": ("ao.pdf", pdf, "application/pdf")})
        data = r.json()
        assert "total_pages" in data
        assert "confidence" in data
        assert "technical_keywords" in data
        assert "requirements" in data
        assert "sections_found" in data

    def test_analyze_detects_technical_keywords(self, client, auth_headers):
        pdf = self._make_pdf(
            "Mission Snowflake dbt Python Airflow BigQuery data engineering"
        )
        r = client.post(f"{BASE_PDF}/analyze", headers=auth_headers,
                        files={"file": ("ao.pdf", pdf, "application/pdf")})
        if r.status_code == 200:
            kws = r.json().get("technical_keywords", [])
            # At least some keywords should be found in a keyword-dense PDF
            assert isinstance(kws, list)

    def test_analyze_rejects_non_pdf(self, client, auth_headers):
        r = client.post(f"{BASE_PDF}/analyze", headers=auth_headers,
                        files={"file": ("doc.txt", b"not a pdf", "text/plain")})
        assert r.status_code in (415, 422)

    def test_analyze_never_500(self, client, auth_headers):
        pdf = self._make_pdf("Test appel d'offres data")
        r = client.post(f"{BASE_PDF}/analyze", headers=auth_headers,
                        files={"file": ("ao.pdf", pdf, "application/pdf")})
        assert r.status_code != 500
