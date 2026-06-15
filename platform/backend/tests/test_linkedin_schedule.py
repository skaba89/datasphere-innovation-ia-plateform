"""Tests unitaires — LinkedIn Schedule"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock


def _mock_db_no_posts():
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = []
    mock_db.execute.return_value.fetchone.return_value = None
    mock_db.execute.return_value.scalar.return_value = 0
    return mock_db


def test_schedule_stats_empty():
    """Stats retournent 0 si aucun post."""
    from app.api.v1.endpoints.linkedin_schedule import schedule_stats
    mock_db = _mock_db_no_posts()
    mock_user = MagicMock(); mock_user.id = 1
    result = schedule_stats(db=mock_db, current_user=mock_user)
    assert result["total"] == 0
    assert result["published"] == 0
    assert result["pending"] == 0


def test_calendar_weekly_slots():
    """Calendrier doit générer 14 slots sur 30 jours."""
    from app.api.v1.endpoints.linkedin_schedule import WEEKLY_CALENDAR
    assert len(WEEKLY_CALENDAR) == 14
    # Tous les offsets doivent être dans les 30 jours
    for day_offset, topic_type, hour in WEEKLY_CALENDAR:
        assert 0 <= day_offset <= 31
        assert 7 <= hour <= 18
        assert topic_type in [
            "data_engineering", "ao_insight", "market_trend",
            "tech_tip", "feedback", "guinea_africa",
        ]


def test_calendar_topic_diversity():
    """Le calendrier doit avoir au moins 4 topic_types différents."""
    from app.api.v1.endpoints.linkedin_schedule import WEEKLY_CALENDAR
    topics = {t for _, t, _ in WEEKLY_CALENDAR}
    assert len(topics) >= 4


def test_schedule_future_date_required():
    """La date de publication doit être dans le futur."""
    from app.api.v1.endpoints.linkedin_schedule import ScheduleCreate, schedule_post
    from fastapi import HTTPException

    past_dt = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    payload = ScheduleCreate(topic_type="data_engineering", scheduled_at=past_dt)

    mock_db = _mock_db_no_posts()
    mock_user = MagicMock(); mock_user.id = 1

    with pytest.raises(HTTPException) as exc:
        schedule_post(payload=payload, db=mock_db, current_user=mock_user)
    assert exc.value.status_code == 400
    assert "futur" in exc.value.detail.lower()


def test_schedule_invalid_date_format():
    """Format de date invalide → 400."""
    from app.api.v1.endpoints.linkedin_schedule import ScheduleCreate, schedule_post
    from fastapi import HTTPException

    payload = ScheduleCreate(topic_type="data_engineering", scheduled_at="not-a-date")
    mock_db = _mock_db_no_posts()
    mock_user = MagicMock(); mock_user.id = 1

    with pytest.raises(HTTPException) as exc:
        schedule_post(payload=payload, db=mock_db, current_user=mock_user)
    assert exc.value.status_code == 400


def test_cancel_published_post_forbidden():
    """Impossible d'annuler un post déjà publié."""
    from app.api.v1.endpoints.linkedin_schedule import cancel_scheduled_post
    from fastapi import HTTPException

    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row._mapping = {
        "id": 1, "status": "published", "owner_id": 1,
        "topic_type": "data_engineering", "content": "Test",
        "scheduled_at": datetime.utcnow(),
    }
    mock_db.execute.return_value.fetchone.return_value = mock_row
    mock_user = MagicMock(); mock_user.id = 1

    with pytest.raises(HTTPException) as exc:
        cancel_scheduled_post(post_id=1, db=mock_db, current_user=mock_user)
    assert exc.value.status_code == 400
    assert "publié" in exc.value.detail.lower()


def test_publish_now_no_oauth_token():
    """Publication sans token OAuth → 401."""
    from app.api.v1.endpoints.linkedin_schedule import publish_now
    from fastapi import HTTPException
    import json

    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row._mapping = {
        "id": 1, "status": "pending", "owner_id": 1,
        "topic_type": "data_engineering", "content": "Post test",
        "scheduled_at": datetime.utcnow(),
    }
    mock_db.execute.return_value.fetchone.return_value = mock_row

    mock_user = MagicMock()
    mock_user.id = 1
    mock_user.extra_data = json.dumps({})  # Pas de token LinkedIn

    with pytest.raises(HTTPException) as exc:
        publish_now(post_id=1, db=mock_db, current_user=mock_user)
    assert exc.value.status_code == 401


def test_list_scheduled_returns_list():
    """list_scheduled retourne toujours une liste."""
    from app.api.v1.endpoints.linkedin_schedule import list_scheduled

    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = []
    mock_user = MagicMock(); mock_user.id = 1

    result = list_scheduled(db=mock_db, current_user=mock_user)
    assert isinstance(result, list)
