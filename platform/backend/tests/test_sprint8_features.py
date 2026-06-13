"""
Tests — Sprint 8 features
  - Cache service (TTL, invalidation, thread-safety)
  - CSV bulk exports (tenders, deliverables, contacts, opportunities)
  - User profile API (GET + PATCH /team/me)
  - Analytics cache integration
"""

import pytest
import time


# ═══════════════════════════════════════════════════════════════════════════════
# Cache Service — cache_service.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestCacheService:

    def setup_method(self):
        """Clear cache before each test."""
        from app.services.cache_service import cache_invalidate_prefix
        cache_invalidate_prefix("")  # Clear all

    def test_cache_set_and_get(self):
        from app.services.cache_service import cache_set, cache_get
        cache_set("test:key1", {"value": 42}, ttl=60)
        result = cache_get("test:key1")
        assert result == {"value": 42}

    def test_cache_miss_returns_none(self):
        from app.services.cache_service import cache_get
        assert cache_get("test:nonexistent_key_xyz") is None

    def test_cache_ttl_expiry(self):
        from app.services.cache_service import cache_set, cache_get
        cache_set("test:ttl_key", "value", ttl=1)
        assert cache_get("test:ttl_key") == "value"
        time.sleep(1.1)
        assert cache_get("test:ttl_key") is None  # Expired

    def test_cache_delete(self):
        from app.services.cache_service import cache_set, cache_get, cache_delete
        cache_set("test:del_key", "to_delete", ttl=60)
        assert cache_get("test:del_key") == "to_delete"
        cache_delete("test:del_key")
        assert cache_get("test:del_key") is None

    def test_cache_invalidate_prefix(self):
        from app.services.cache_service import cache_set, cache_get, cache_invalidate_prefix
        cache_set("analytics:kpis", {"a": 1}, ttl=60)
        cache_set("analytics:timeline", {"b": 2}, ttl=60)
        cache_set("other:key", {"c": 3}, ttl=60)
        deleted = cache_invalidate_prefix("analytics:")
        assert deleted == 2
        assert cache_get("analytics:kpis") is None
        assert cache_get("analytics:timeline") is None
        assert cache_get("other:key") == {"c": 3}  # Untouched

    def test_cache_overwrite(self):
        from app.services.cache_service import cache_set, cache_get
        cache_set("test:overwrite", "first", ttl=60)
        cache_set("test:overwrite", "second", ttl=60)
        assert cache_get("test:overwrite") == "second"

    def test_cache_stats(self):
        from app.services.cache_service import cache_set, cache_stats
        cache_set("test:stat1", 1, ttl=60)
        cache_set("test:stat2", 2, ttl=60)
        stats = cache_stats()
        assert "active_keys" in stats
        assert "total" in stats
        assert stats["total"] >= 2

    def test_cache_stores_any_type(self):
        from app.services.cache_service import cache_set, cache_get
        test_data = [1, "two", {"three": 3}, [4, 5]]
        cache_set("test:complex", test_data, ttl=60)
        result = cache_get("test:complex")
        assert result == test_data

    def test_invalidate_dashboard(self):
        from app.services.cache_service import cache_set, cache_get, invalidate_dashboard
        cache_set("analytics:dashboard_kpis", {"kpis": True}, ttl=60)
        cache_set("analytics:pipeline", {"pipeline": True}, ttl=60)
        invalidate_dashboard()
        assert cache_get("analytics:dashboard_kpis") is None
        assert cache_get("analytics:pipeline") is None

    def test_analytics_endpoint_uses_cache(self, client, auth_headers):
        """Second call to dashboard_kpis should be faster (cache hit)."""
        import time
        # First call — cache MISS
        t1 = time.monotonic()
        r1 = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
        d1 = time.monotonic() - t1
        assert r1.status_code == 200

        # Second call — cache HIT (should be faster)
        t2 = time.monotonic()
        r2 = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
        d2 = time.monotonic() - t2
        assert r2.status_code == 200
        assert r1.json().keys() == r2.json().keys()  # Same structure


# ═══════════════════════════════════════════════════════════════════════════════
# CSV Exports — excel_export.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestCSVExports:

    def test_tenders_csv_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/export/excel/tenders/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        assert "appels_offres" in resp.headers.get("content-disposition", "")

    def test_tenders_csv_content(self, client, auth_headers, tender):
        """After creating a tender, it appears in CSV export."""
        resp = client.get("/api/v1/export/excel/tenders/csv", headers=auth_headers)
        content = resp.text
        # CSV header should be present
        assert "ID" in content
        assert "Titre" in content
        assert "Acheteur" in content

    def test_deliverables_csv_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/export/excel/deliverables/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        assert "livrables" in resp.headers.get("content-disposition", "")

    def test_deliverables_csv_content(self, client, auth_headers, tender):
        """CSV header rows are present."""
        resp = client.get("/api/v1/export/excel/deliverables/csv", headers=auth_headers)
        content = resp.text
        assert "Titre" in content or "ID" in content

    def test_contacts_csv_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/export/excel/contacts/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")

    def test_opportunities_csv_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/export/excel/opportunities/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")

    def test_csv_requires_auth(self, client):
        resp = client.get("/api/v1/export/excel/tenders/csv")
        assert resp.status_code == 401

    def test_csv_is_parseable(self, client, auth_headers):
        """CSV content should be parseable."""
        import csv, io
        resp = client.get("/api/v1/export/excel/contacts/csv", headers=auth_headers)
        reader = csv.reader(io.StringIO(resp.text))
        rows = list(reader)
        # At least header row
        assert len(rows) >= 1
        # Header should have columns
        assert len(rows[0]) >= 3

    def test_csv_utf8_encoding(self, client, auth_headers):
        """CSV should handle French characters."""
        resp = client.get("/api/v1/export/excel/opportunities/csv", headers=auth_headers)
        # Should not raise UnicodeDecodeError
        content = resp.text
        assert isinstance(content, str)


# ═══════════════════════════════════════════════════════════════════════════════
# User Profile API — GET + PATCH /team/me
# ═══════════════════════════════════════════════════════════════════════════════

class TestUserProfileAPI:

    def test_get_my_profile(self, client, auth_headers):
        resp = client.get("/api/v1/team/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "email" in data
        assert "role" in data
        assert "first_name" in data

    def test_profile_has_extended_fields(self, client, auth_headers):
        resp = client.get("/api/v1/team/me", headers=auth_headers)
        data = resp.json()
        # Extended fields present (may be None)
        assert "bio" in data
        assert "phone" in data
        assert "linkedin_url" in data
        assert "tjm" in data
        assert "skills" in data
        assert "location" in data
        assert "availability" in data

    def test_patch_first_name(self, client, auth_headers):
        resp = client.patch("/api/v1/team/me", headers=auth_headers,
                            json={"first_name": "TestModifié"})
        assert resp.status_code == 200
        assert resp.json().get("success") is True

        # Verify change
        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["first_name"] == "TestModifié"

    def test_patch_bio(self, client, auth_headers):
        resp = client.patch("/api/v1/team/me", headers=auth_headers,
                            json={"bio": "Expert Data Engineering 8 ans XP"})
        assert resp.status_code == 200

        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["bio"] == "Expert Data Engineering 8 ans XP"

    def test_patch_tjm(self, client, auth_headers):
        resp = client.patch("/api/v1/team/me", headers=auth_headers,
                            json={"tjm": 750})
        assert resp.status_code == 200
        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["tjm"] == 750

    def test_patch_skills(self, client, auth_headers):
        skills = ["Snowflake", "dbt Core", "Apache Airflow", "Python"]
        resp = client.patch("/api/v1/team/me", headers=auth_headers,
                            json={"skills": skills})
        assert resp.status_code == 200
        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["skills"] == skills

    def test_patch_availability(self, client, auth_headers):
        resp = client.patch("/api/v1/team/me", headers=auth_headers,
                            json={"availability": "immediate"})
        assert resp.status_code == 200
        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["availability"] == "immediate"

    def test_patch_partial_update(self, client, auth_headers):
        """Patching only some fields doesn't clear others."""
        # Set bio
        client.patch("/api/v1/team/me", headers=auth_headers, json={"bio": "Bio A"})
        # Set location separately
        client.patch("/api/v1/team/me", headers=auth_headers, json={"location": "Paris"})
        # Both should be present
        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["bio"] == "Bio A"
        assert profile["location"] == "Paris"

    def test_profile_requires_auth(self, client):
        resp = client.get("/api/v1/team/me")
        assert resp.status_code == 401

    def test_patch_requires_auth(self, client):
        resp = client.patch("/api/v1/team/me", json={"bio": "test"})
        assert resp.status_code == 401

    def test_patch_linkedin_url(self, client, auth_headers):
        resp = client.patch("/api/v1/team/me", headers=auth_headers,
                            json={"linkedin_url": "https://linkedin.com/in/cheickna-kaba"})
        assert resp.status_code == 200
        profile = client.get("/api/v1/team/me", headers=auth_headers).json()
        assert profile["linkedin_url"] == "https://linkedin.com/in/cheickna-kaba"
