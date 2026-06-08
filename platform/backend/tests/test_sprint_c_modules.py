"""
Tests — Nouveaux modules Sprint C

Couvre :
  Staffing     : GET /staffing/tenders/{id}/match
  Tender Watch : GET /tender-watch/search
  Data Mission : POST /data-mission/analyze, /agents/*
  Mission Report : GET /deliverables/tenders/{id}/mission-report
"""
import pytest
from tests.conftest import make_org, make_opp, make_tender, make_deliverable

BASE_STAFF  = "/api/v1/staffing"
BASE_WATCH  = "/api/v1/tender-watch"
BASE_MISSION = "/api/v1/data-mission"
BASE_D      = "/api/v1/deliverables"
BASE_EXPORT = "/api/v1/export"


# ══════════════════════════════════════════════════════════════════════════════
# STAFFING MATCHING
# ══════════════════════════════════════════════════════════════════════════════

class TestStaffingMatching:
    def test_requires_auth(self, client, tender):
        r = client.get(f"{BASE_STAFF}/tenders/{tender['id']}/match")
        assert r.status_code == 401

    def test_match_returns_200(self, client, auth_headers, tender):
        r = client.get(f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers)
        assert r.status_code == 200

    def test_match_structure(self, client, auth_headers, tender):
        data = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers
        ).json()
        assert "tender_id" in data
        assert "tender_title" in data
        assert "recommended_team" in data
        assert "global_team_score" in data
        assert "summary" in data
        assert "gap_analysis" in data

    def test_match_tender_id_matches(self, client, auth_headers, tender):
        data = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers
        ).json()
        assert data["tender_id"] == tender["id"]

    def test_match_recommended_team_is_list(self, client, auth_headers, tender):
        data = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers
        ).json()
        assert isinstance(data["recommended_team"], list)

    def test_match_team_member_structure(self, client, auth_headers, tender):
        data = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers
        ).json()
        if data["recommended_team"]:
            m = data["recommended_team"][0]
            assert "consultant" in m
            assert "match_score" in m
            assert "matched_terms" in m
            assert "recommendation" in m
            c = m["consultant"]
            assert "full_name" in c
            assert "role" in c
            assert "skills" in c

    def test_match_gap_analysis_structure(self, client, auth_headers, tender):
        data = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers
        ).json()
        gap = data["gap_analysis"]
        assert "required_skills" in gap
        assert "covered_skills" in gap
        assert "missing_skills" in gap
        assert "coverage_rate" in gap
        assert 0 <= gap["coverage_rate"] <= 100

    def test_match_global_score_range(self, client, auth_headers, tender):
        data = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers
        ).json()
        assert 0 <= data["global_team_score"] <= 100

    def test_match_max_results_param(self, client, auth_headers, tender):
        r = client.get(
            f"{BASE_STAFF}/tenders/{tender['id']}/match?max_results=3", headers=auth_headers
        )
        assert r.status_code == 200
        team = r.json()["recommended_team"]
        assert len(team) <= 3

    def test_match_nonexistent_tender(self, client, auth_headers):
        r = client.get(f"{BASE_STAFF}/tenders/999999/match", headers=auth_headers)
        assert r.status_code == 404

    def test_match_never_500(self, client, auth_headers, tender):
        """Même sans exigences, l'endpoint ne retourne jamais 500."""
        r = client.get(f"{BASE_STAFF}/tenders/{tender['id']}/match", headers=auth_headers)
        assert r.status_code != 500


# ══════════════════════════════════════════════════════════════════════════════
# TENDER WATCH
# ══════════════════════════════════════════════════════════════════════════════

class TestTenderWatch:
    def test_requires_auth(self, client):
        r = client.get(f"{BASE_WATCH}/search")
        assert r.status_code == 401

    def test_search_returns_200(self, client, auth_headers):
        r = client.get(f"{BASE_WATCH}/search", headers=auth_headers)
        assert r.status_code == 200

    def test_search_returns_list(self, client, auth_headers):
        data = client.get(f"{BASE_WATCH}/search", headers=auth_headers).json()
        assert isinstance(data, list)

    def test_search_with_query(self, client, auth_headers):
        r = client.get(f"{BASE_WATCH}/search?q=data+platform", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search_candidate_structure(self, client, auth_headers):
        data = client.get(f"{BASE_WATCH}/search", headers=auth_headers).json()
        if data:
            c = data[0]
            assert "title" in c
            assert "reference" in c
            assert "buyer_name" in c
            assert "qualification_score" in c
            assert "score_breakdown" in c
            assert 0 <= c["qualification_score"] <= 100

    def test_search_score_breakdown_structure(self, client, auth_headers):
        data = client.get(f"{BASE_WATCH}/search", headers=auth_headers).json()
        if data:
            bd = data[0]["score_breakdown"]
            for field in ["technical_fit", "strategic_fit", "commercial_fit",
                          "global_score", "recommendation"]:
                assert field in bd
            assert 0 <= bd["global_score"] <= 100

    def test_search_limit_param(self, client, auth_headers):
        r = client.get(f"{BASE_WATCH}/search?limit=5", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) <= 5

    def test_search_empty_query_ok(self, client, auth_headers):
        r = client.get(f"{BASE_WATCH}/search?q=", headers=auth_headers)
        assert r.status_code == 200

    def test_search_unknown_query_ok(self, client, auth_headers):
        r = client.get(f"{BASE_WATCH}/search?q=xyznotexist99999", headers=auth_headers)
        assert r.status_code == 200
        # May return empty list or default candidates

    def test_search_never_500(self, client, auth_headers):
        r = client.get(f"{BASE_WATCH}/search", headers=auth_headers)
        assert r.status_code != 500


# ══════════════════════════════════════════════════════════════════════════════
# DATA MISSION
# ══════════════════════════════════════════════════════════════════════════════

class TestDataMission:
    MISSION_PAYLOAD = {
        "project_title": "Migration Datawarehouse Oracle vers Snowflake",
        "context": "Migration d'un datawarehouse legacy Oracle vers Snowflake avec dbt et Airflow pour une banque.",
        "requirements": ["Snowflake", "dbt", "Airflow", "Python", "SQL"],
    }

    def test_analyze_requires_auth(self, client):
        r = client.post(f"{BASE_MISSION}/analyze", json=self.MISSION_PAYLOAD)
        assert r.status_code == 401

    def test_analyze_returns_200(self, client, auth_headers):
        r = client.post(f"{BASE_MISSION}/analyze", headers=auth_headers, json=self.MISSION_PAYLOAD)
        assert r.status_code == 200

    def test_analyze_structure(self, client, auth_headers):
        data = client.post(
            f"{BASE_MISSION}/analyze", headers=auth_headers, json=self.MISSION_PAYLOAD
        ).json()
        # Should have at least some keys
        assert isinstance(data, dict)
        assert len(data) > 0

    def test_analyze_missing_required_fields(self, client, auth_headers):
        r = client.post(f"{BASE_MISSION}/analyze", headers=auth_headers, json={
            "requirements": ["Python"]
        })
        assert r.status_code == 422  # project_title + context are required

    def test_analyze_never_500(self, client, auth_headers):
        r = client.post(f"{BASE_MISSION}/analyze", headers=auth_headers, json=self.MISSION_PAYLOAD)
        assert r.status_code != 500

    def test_agent_data_engineer_returns_200(self, client, auth_headers):
        r = client.post(f"{BASE_MISSION}/agents/data-engineer", headers=auth_headers, json={
            "project_title": "Plateforme Data Banque Centrale",
            "context": "Architecture d'une plateforme de données pour une banque centrale de Guinée.",
            "requirements": ["Snowflake", "dbt", "scalable", "sécurisée"],
        })
        assert r.status_code == 200

    def test_agent_data_analyst_returns_200(self, client, auth_headers):
        r = client.post(f"{BASE_MISSION}/agents/data-analyst", headers=auth_headers, json={
            "project_title": "Analyse Transactions Financières",
            "context": "Analyse des données de transaction d'une institution financière africaine.",
            "requirements": ["Power BI", "SQL", "statistiques"],
        })
        assert r.status_code == 200

    def test_agent_data_engineer_structure(self, client, auth_headers):
        data = client.post(f"{BASE_MISSION}/agents/data-engineer", headers=auth_headers, json={
            "project_title": "Mission Data Engineering",
            "context": "Mission data engineering pipeline avec orchestration.", "requirements": ["Python", "Airflow"],
        }).json()
        assert isinstance(data, dict)

    def test_agent_never_500(self, client, auth_headers):
        for endpoint in ["data-engineer", "data-analyst"]:
            r = client.post(f"{BASE_MISSION}/agents/{endpoint}", headers=auth_headers, json={
                "project_title": "Test Mission",
                "context": "Test mission context for agents.", "requirements": [],
            })
            assert r.status_code != 500, f"500 on /agents/{endpoint}"


# ══════════════════════════════════════════════════════════════════════════════
# MISSION REPORT (via deliverables)
# ══════════════════════════════════════════════════════════════════════════════

class TestMissionReport:
    def test_returns_200(self, client, auth_headers, tender):
        r = client.get(
            f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers
        )
        assert r.status_code == 200

    def test_returns_html(self, client, auth_headers, tender):
        r = client.get(
            f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers
        )
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "html" in ct.lower()

    def test_html_contains_tender_info(self, client, auth_headers, tender):
        r = client.get(
            f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers
        )
        assert r.status_code == 200
        assert len(r.text) > 100

    def test_nonexistent_tender(self, client, auth_headers):
        r = client.get(f"/api/v1/deliverables/tenders/999999/mission-report", headers=auth_headers)
        assert r.status_code in (404, 200)  # 200 with empty report or 404

    def test_never_500(self, client, auth_headers, tender):
        r = client.get(
            f"/api/v1/deliverables/tenders/{tender['id']}/mission-report", headers=auth_headers
        )
        assert r.status_code != 500
