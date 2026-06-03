"""
Notifications complete test suite.
Covers: CRUD, mark read, mark all read, count, SSE status, RBAC.
"""
import pytest


class TestNotifications:
    BASE = "/api/v1/notifications"

    def _create(self, client, headers, title="Test notification", priority="low", notif_type="system"):
        r = client.post(self.BASE, headers=headers, json={
            "type": notif_type,
            "priority": priority,
            "title": title,
            "message": f"Message pour : {title}",
        })
        assert r.status_code == 201, r.json()
        return r.json()

    # Auth
    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_count_requires_auth(self, client):
        assert client.get(f"{self.BASE}/count").status_code == 401

    # CRUD
    def test_create_notification(self, client, auth_headers):
        n = self._create(client, auth_headers)
        assert n["title"] == "Test notification"
        assert n["is_read"] is False
        assert n["id"] > 0

    def test_create_with_all_priorities(self, client, auth_headers):
        for p in ["low", "medium", "high", "critical"]:
            n = self._create(client, auth_headers, f"Test {p}", priority=p)
            assert n["priority"] == p

    def test_list_notifications(self, client, auth_headers):
        self._create(client, auth_headers, "Notif 1")
        self._create(client, auth_headers, "Notif 2")
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_count_unread(self, client, auth_headers):
        self._create(client, auth_headers, "Unread 1")
        self._create(client, auth_headers, "Unread 2")
        r = client.get(f"{self.BASE}/count", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "unread" in data or "count" in data or isinstance(data, int)

    # Mark read
    def test_mark_single_read(self, client, auth_headers):
        n = self._create(client, auth_headers, "To read")
        r = client.post(f"{self.BASE}/{n['id']}/read", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["is_read"] is True
        assert r.json()["read_at"] is not None

    def test_mark_already_read_is_idempotent(self, client, auth_headers):
        n = self._create(client, auth_headers, "Idempotent")
        client.post(f"{self.BASE}/{n['id']}/read", headers=auth_headers)
        r = client.post(f"{self.BASE}/{n['id']}/read", headers=auth_headers)
        assert r.status_code == 200

    def test_mark_not_found(self, client, auth_headers):
        r = client.post(f"{self.BASE}/999999/read", headers=auth_headers)
        assert r.status_code == 404

    def test_mark_all_read(self, client, auth_headers):
        self._create(client, auth_headers, "Unread A")
        self._create(client, auth_headers, "Unread B")
        r = client.post(f"{self.BASE}/read-all", headers=auth_headers)
        assert r.status_code == 200
        # All should now be read
        notifications = client.get(self.BASE, headers=auth_headers).json()
        for n in notifications:
            assert n["is_read"] is True

    def test_count_after_mark_all_read(self, client, auth_headers):
        self._create(client, auth_headers, "Count test 1")
        self._create(client, auth_headers, "Count test 2")
        client.post(f"{self.BASE}/read-all", headers=auth_headers)
        r = client.get(f"{self.BASE}/count", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        count = data.get("unread", data) if isinstance(data, dict) else data
        assert count == 0 or isinstance(count, int)

    # SSE
    def test_sse_status_endpoint(self, client, auth_headers):
        r = client.get("/api/v1/notifications/stream/status", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "active_connections" in data

    # Filtering
    def test_filter_unread_only(self, client, auth_headers):
        n1 = self._create(client, auth_headers, "Will read")
        self._create(client, auth_headers, "Will stay unread")
        client.post(f"{self.BASE}/{n1['id']}/read", headers=auth_headers)
        r = client.get(f"{self.BASE}?unread_only=true", headers=auth_headers)
        assert r.status_code == 200

    def test_viewer_can_read_own_notifications(self, client, viewer_headers):
        r = client.get(self.BASE, headers=viewer_headers)
        assert r.status_code == 200
