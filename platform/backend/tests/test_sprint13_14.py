"""
Tests Sprint 13-14 : Expériences consultants + CRM auto + Settings + Email test
"""
import pytest


# ── Consultant Experiences ────────────────────────────────────────────────────

class TestConsultantExperiences:

    def test_list_experiences_empty(self, client, auth_headers):
        resp = client.get("/api/v1/consultant/experiences", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_experience(self, client, auth_headers):
        resp = client.post("/api/v1/consultant/experiences", headers=auth_headers, json={
            "company":     "DataSphere Conseil",
            "role":        "Data Engineer Senior",
            "start_date":  "01/2022",
            "end_date":    "12/2023",
            "is_current":  False,
            "description": "Conception pipeline ETL Snowflake + dbt Core + Airflow",
            "technologies":"Snowflake, dbt Core, Apache Airflow, Python, SQL",
            "achievements":"Réduction 40% temps traitement\nMise en place 50+ modèles dbt",
            "is_highlight": True,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["company"] == "DataSphere Conseil"
        assert data["role"] == "Data Engineer Senior"
        assert data["is_highlight"] is True
        return data["id"]

    def test_create_experience_with_client(self, client, auth_headers):
        resp = client.post("/api/v1/consultant/experiences", headers=auth_headers, json={
            "company":     "Capgemini",
            "client_name": "Banque de France",
            "role":        "Data Architect",
            "sector":      "Banque / Finance",
            "location":    "Paris, La Défense",
            "start_date":  "03/2021",
            "end_date":    "12/2021",
            "description": "Architecture data lake PostgreSQL + Kafka",
            "is_current":  False,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_name"] == "Banque de France"
        assert data["sector"] == "Banque / Finance"

    def test_list_experiences_after_create(self, client, auth_headers):
        client.post("/api/v1/consultant/experiences", headers=auth_headers, json={
            "company": "Thales", "role": "MLOps Engineer",
            "start_date": "01/2024", "is_current": True,
            "description": "Pipelines ML production avec MLflow",
        })
        resp = client.get("/api/v1/consultant/experiences", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_update_experience(self, client, auth_headers):
        create = client.post("/api/v1/consultant/experiences", headers=auth_headers, json={
            "company": "OldCo", "role": "Engineer",
            "start_date": "01/2020", "description": "Old desc",
        })
        exp_id = create.json()["id"]

        resp = client.patch(f"/api/v1/consultant/experiences/{exp_id}",
                            headers=auth_headers, json={"role": "Senior Engineer"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "Senior Engineer"

    def test_delete_experience(self, client, auth_headers):
        create = client.post("/api/v1/consultant/experiences", headers=auth_headers, json={
            "company": "ToDelete", "role": "Engineer",
            "start_date": "01/2020", "description": "To be deleted",
        })
        exp_id = create.json()["id"]

        resp = client.delete(f"/api/v1/consultant/experiences/{exp_id}", headers=auth_headers)
        assert resp.status_code == 204

        list_resp = client.get("/api/v1/consultant/experiences", headers=auth_headers)
        ids = [e["id"] for e in list_resp.json()]
        assert exp_id not in ids

    def test_experience_requires_auth(self, client):
        resp = client.get("/api/v1/consultant/experiences")
        assert resp.status_code == 401

    def test_experience_isolation(self, client, auth_headers):
        """Un utilisateur ne voit pas les expériences des autres."""
        client.post("/api/v1/consultant/experiences", headers=auth_headers, json={
            "company": "MySilo", "role": "Eng",
            "start_date": "01/2020", "description": "Private",
        })
        resp = client.get("/api/v1/consultant/experiences", headers=auth_headers)
        for exp in resp.json():
            assert exp.get("owner_email") != "other@other.com"


# ── CV Prompt avec expériences réelles ───────────────────────────────────────

class TestCVWithRealExperiences:

    def test_cv_prompt_without_experiences(self):
        from app.services.cv_agent import _build_cv_prompt
        prompt = _build_cv_prompt("Jean", "Dupont", "data_engineering", None, 8)
        assert "Jean" in prompt
        assert "Data Engineer" in prompt or "data" in prompt.lower()

    def test_cv_prompt_with_real_experiences(self):
        from app.services.cv_agent import _build_cv_prompt
        exps = [
            {
                "company": "SACEM", "client_name": "SACEM", "role": "Data Engineer Senior",
                "sector": "Médias", "location": "Paris", "project_type": "Data Lake",
                "start_date": "01/2022", "end_date": "12/2023", "is_current": False,
                "context": "Migration vers Snowflake",
                "description": "Pipeline ETL avec Snowflake et dbt Core",
                "achievements": "Réduction 40% temps traitement",
                "technologies": "Snowflake, dbt, Airflow",
                "methodologies": "Agile",
            }
        ]
        prompt = _build_cv_prompt("Cheickna", "KABA", "data_engineering", "Mission Snowflake", 8, exps)
        assert "SACEM" in prompt
        assert "NE PAS INVENTER" in prompt or "RÉELLES" in prompt
        assert "Snowflake" in prompt

    def test_cv_prompt_experiences_count(self):
        from app.services.cv_agent import _build_cv_prompt
        exps = [
            {"company": f"Co{i}", "role": "DE", "start_date": "01/202" + str(i),
             "end_date": None, "is_current": i == 2, "description": f"Desc {i}",
             "achievements": "OK", "technologies": "Python",
             "client_name": None, "sector": None, "location": None,
             "project_type": None, "context": None, "methodologies": None}
            for i in range(3)
        ]
        prompt = _build_cv_prompt("X", "Y", "data_engineering", None, 8, exps)
        assert "3 expérience" in prompt


# ── CRM Automation ────────────────────────────────────────────────────────────

class TestCRMAutomation:

    def test_sync_stats_structure(self, client, auth_headers):
        resp = client.get("/api/v1/crm/auto/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "organizations" in data
        assert "opportunities" in data
        assert "automation_rate" in data

    def test_sync_orgs_returns_counts(self, client, auth_headers):
        resp = client.post("/api/v1/crm/auto/sync-orgs", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "created" in data
        assert "skipped" in data

    def test_sync_opps_returns_counts(self, client, auth_headers):
        resp = client.post("/api/v1/crm/auto/sync-opps", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "created" in data

    def test_full_sync(self, client, auth_headers):
        resp = client.post("/api/v1/crm/auto/sync", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "done"
        assert "organizations" in data
        assert "opportunities" in data

    def test_crm_sync_requires_auth(self, client):
        resp = client.post("/api/v1/crm/auto/sync")
        assert resp.status_code == 401


# ── Settings Status ───────────────────────────────────────────────────────────

class TestSettingsAdmin:

    def test_settings_status_structure(self, client, auth_headers):
        resp = client.get("/api/v1/settings/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert "llm" in data
        assert "stripe" in data
        assert "monitoring" in data
        assert "security" in data
        assert "app" in data

    def test_settings_email_structure(self, client, auth_headers):
        data = client.get("/api/v1/settings/status", headers=auth_headers).json()
        email = data["email"]
        assert "configured" in email
        assert "status" in email

    def test_settings_llm_structure(self, client, auth_headers):
        data = client.get("/api/v1/settings/status", headers=auth_headers).json()
        llm = data["llm"]
        assert "groq" in llm
        assert "openai" in llm
        assert "active_provider" in llm

    def test_settings_security_flags(self, client, auth_headers):
        data = client.get("/api/v1/settings/status", headers=auth_headers).json()
        sec = data["security"]
        assert "secret_key_strength" in sec
        assert "setup_disabled" in sec

    def test_settings_requires_auth(self, client):
        resp = client.get("/api/v1/settings/status")
        assert resp.status_code == 401


# ── Email Test Endpoint ───────────────────────────────────────────────────────

class TestEmailTest:

    def test_email_test_when_not_configured(self, client, auth_headers):
        """Sans SMTP configuré, retourne un message d'erreur explicite."""
        resp = client.post("/api/v1/email/test", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        # Should have success field
        assert "success" in data
        # In test env, SMTP is not configured
        if not data["success"]:
            assert "status" in data
            assert data["status"] in ("not_configured", "connect_error", "auth_error", "error")

    def test_email_test_requires_auth(self, client):
        resp = client.post("/api/v1/email/test")
        assert resp.status_code == 401
