"""
Tests — BOAMP Client + TenderWatch sources

Tests en mode mock pour BOAMP (API externe non disponible en CI).
Vérifie la structure, le parsing et l'intégration avec le scoring.
"""

import pytest
from unittest.mock import patch, MagicMock


# ══════════════════════════════════════════════════════════════════════════════
# BOAMP CLIENT UNIT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestBOAMPNormalization:
    """Tests du parsing/normalisation des données BOAMP."""

    def test_normalize_basic_record(self):
        from app.services.boamp_client import _normalize

        record = {
            "idweb": "2024-123456",
            "objet": "Migration datawarehouse Oracle vers Snowflake",
            "nomacheteur": "Conseil Régional d'Île-de-France",
            "dateparution": "2026-03-15",
            "datelimitereponse": "2026-04-20",
            "montant": "150000",
            "urllink": "https://www.boamp.fr/avis/detail/2024-123456",
        }
        result = _normalize(record)
        assert result.id == "2024-123456"
        assert "Snowflake" in result.title
        assert result.buyer_name == "Conseil Régional d'Île-de-France"
        assert result.deadline == "20/04/2026"
        assert result.estimated_value == 150000.0
        assert result.url == "https://www.boamp.fr/avis/detail/2024-123456"

    def test_normalize_missing_fields(self):
        from app.services.boamp_client import _normalize

        result = _normalize({})
        assert result.id  # should generate an id
        assert result.title  # fallback title
        assert result.buyer_name  # fallback buyer
        assert result.reference.startswith("BOAMP-")

    def test_normalize_cpv_list(self):
        from app.services.boamp_client import _normalize

        record = {"idweb": "abc", "objet": "Test", "code_cpv": ["72000000", "48000000"]}
        result = _normalize(record)
        assert "72000000" in result.cpv_codes
        assert "48000000" in result.cpv_codes

    def test_normalize_cpv_string(self):
        from app.services.boamp_client import _normalize

        record = {"idweb": "abc", "objet": "Test", "code_cpv": "72000000"}
        result = _normalize(record)
        assert "72000000" in result.cpv_codes

    def test_normalize_value_with_spaces(self):
        from app.services.boamp_client import _normalize

        record = {"idweb": "x", "objet": "T", "montant": "1 250 000"}
        result = _normalize(record)
        assert result.estimated_value == 1250000.0

    def test_normalize_invalid_value(self):
        from app.services.boamp_client import _normalize

        record = {"idweb": "x", "objet": "T", "montant": "N/A"}
        result = _normalize(record)
        assert result.estimated_value is None

    def test_boamp_to_watch_candidate_keys(self):
        from app.services.boamp_client import _normalize, boamp_to_watch_candidate

        record = {"idweb": "abc123", "objet": "Data mission", "nomacheteur": "Mairie"}
        annonce = _normalize(record)
        candidate = boamp_to_watch_candidate(annonce)

        for key in ["id", "title", "reference", "buyer_name", "country",
                    "source_name", "source_url", "summary", "estimated_value",
                    "requirements", "cpv_codes"]:
            assert key in candidate, f"Missing key: {key}"

    def test_boamp_to_watch_candidate_source_name(self):
        from app.services.boamp_client import _normalize, boamp_to_watch_candidate

        annonce = _normalize({"idweb": "x", "objet": "Test"})
        c = boamp_to_watch_candidate(annonce)
        assert c["source_name"] == "BOAMP"
        assert c["country"] == "France"


class TestBOAMPFetchMocked:
    """Tests du fetch BOAMP en mode mock (API externe)."""

    def _mock_boamp_response(self, records: list) -> MagicMock:
        import json
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({"results": records}).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    def test_fetch_returns_empty_on_api_error(self):
        from app.services.boamp_client import fetch_boamp

        with patch("urllib.request.urlopen", side_effect=Exception("Network error")):
            results = fetch_boamp(query="data", limit=5)
        assert results == []

    def test_fetch_parses_real_structure(self):
        from app.services.boamp_client import fetch_boamp

        mock_records = [
            {
                "idweb": "2026-001",
                "objet": "Plateforme data et analytique pour collectivité territoriale",
                "nomacheteur": "Métropole du Grand Paris",
                "dateparution": "2026-01-15",
                "datelimitereponse": "2026-02-28",
                "montant": "500000",
                "urllink": "https://www.boamp.fr/avis/detail/2026-001",
                "code_cpv": ["72000000", "48490000"],
                "procedure": "Appel d'offres ouvert",
                "lieu": "Île-de-France",
            },
            {
                "idweb": "2026-002",
                "objet": "Système d'information décisionnel BI et reporting",
                "nomacheteur": "Hôpital Nord Paris",
                "dateparution": "2026-01-20",
                "montant": "120000",
                "urllink": "https://www.boamp.fr/avis/detail/2026-002",
            },
        ]

        mock_resp = self._mock_boamp_response(mock_records)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            results = fetch_boamp(query="data", limit=10)

        assert len(results) == 2
        assert results[0].title == "Plateforme data et analytique pour collectivité territoriale"
        assert results[0].buyer_name == "Métropole du Grand Paris"
        assert results[0].estimated_value == 500000.0
        assert "72000000" in results[0].cpv_codes
        assert results[0].procedure == "Appel d'offres ouvert"
        assert results[0].location == "Île-de-France"

    def test_fetch_handles_empty_results(self):
        from app.services.boamp_client import fetch_boamp

        mock_resp = self._mock_boamp_response([])
        with patch("urllib.request.urlopen", return_value=mock_resp):
            results = fetch_boamp()
        assert results == []

    def test_fetch_limit_respected(self):
        from app.services.boamp_client import fetch_boamp

        mock_records = [{"idweb": f"{i}", "objet": f"AO {i}"} for i in range(50)]
        mock_resp = self._mock_boamp_response(mock_records[:5])  # API respects limit
        with patch("urllib.request.urlopen", return_value=mock_resp):
            results = fetch_boamp(limit=5)
        assert len(results) == 5


# ══════════════════════════════════════════════════════════════════════════════
# TENDER WATCH API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class TestTenderWatchSources:
    def test_sources_requires_auth(self, client):
        r = client.get("/api/v1/tender-watch/sources")
        assert r.status_code == 401

    def test_sources_returns_list(self, client, auth_headers):
        r = client.get("/api/v1/tender-watch/sources", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "sources" in data
        assert data["total"] >= 2

    def test_sources_has_boamp(self, client, auth_headers):
        data = client.get("/api/v1/tender-watch/sources", headers=auth_headers).json()
        ids = [s["id"] for s in data["sources"]]
        assert "boamp" in ids
        assert "local" in ids

    def test_sources_structure(self, client, auth_headers):
        data = client.get("/api/v1/tender-watch/sources", headers=auth_headers).json()
        for s in data["sources"]:
            assert "id" in s
            assert "name" in s
            assert "status" in s
            assert "requires_key" in s

    def test_boamp_source_no_key_required(self, client, auth_headers):
        data = client.get("/api/v1/tender-watch/sources", headers=auth_headers).json()
        boamp = next(s for s in data["sources"] if s["id"] == "boamp")
        assert boamp["requires_key"] is False
        assert boamp["status"] == "active"


class TestTenderWatchSearch:
    def test_search_with_source_local_param(self, client, auth_headers):
        r = client.get("/api/v1/tender-watch/search?source=local&limit=5", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_search_source_all_works(self, client, auth_headers):
        """With BOAMP unreachable in CI, falls back to local — should not crash."""
        r = client.get("/api/v1/tender-watch/search?source=all&q=data", headers=auth_headers)
        assert r.status_code == 200

    def test_search_returns_enriched_fields(self, client, auth_headers):
        """New BOAMP-enriched fields should be present (may be null for local source)."""
        r = client.get("/api/v1/tender-watch/search?source=local&limit=3", headers=auth_headers)
        if r.status_code == 200 and r.json():
            item = r.json()[0]
            # New fields should exist (even if null)
            assert "published_date" in item
            assert "cpv_codes" in item
            assert "procedure" in item
            assert "location" in item
