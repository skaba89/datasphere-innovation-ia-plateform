"""Tests unitaires — Billing Service"""
import pytest
from unittest.mock import patch, MagicMock


def test_get_plan_limits_free():
    from app.services.billing_service import get_plan_limits
    limits = get_plan_limits("free")
    assert limits["members"] >= 1
    assert limits["tenders"] >= 1
    assert limits["deliverables"] >= 1


def test_get_plan_limits_pro():
    from app.services.billing_service import get_plan_limits
    limits = get_plan_limits("pro")
    free_limits = get_plan_limits("free")
    # Pro doit avoir des limites plus élevées que free
    assert limits["members"] >= free_limits["members"]
    assert limits["tenders"] >= free_limits["tenders"]


def test_get_plan_limits_invalid():
    from app.services.billing_service import get_plan_limits
    with pytest.raises(ValueError):
        get_plan_limits("invalid_plan_xyz")


def test_create_checkout_mock_mode():
    """Sans STRIPE_SECRET_KEY, retourne une URL mock."""
    from app.services.billing_service import create_checkout_session

    mock_db = MagicMock()
    mock_sub = MagicMock()
    mock_sub.plan = "free"
    mock_sub.stripe_customer_id = None

    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_sub
    mock_db.query.return_value = mock_query

    with patch("app.services.billing_service.settings") as mock_settings:
        mock_settings.stripe_enabled = False
        mock_settings.stripe_success_url = "http://localhost:5173/success"

        result = create_checkout_session(mock_db, workspace_id=1, plan="starter")
        assert result["mock"] is True
        assert "url" in result
        assert "starter" in result["url"]


def test_billing_plans_defined():
    """Vérifier que tous les plans attendus sont définis."""
    from app.services.billing_service import PLANS
    assert "free" in PLANS
    assert "starter" in PLANS
    assert "pro" in PLANS
    for plan_key, plan in PLANS.items():
        assert "label" in plan
        assert "price_eur" in plan
        assert "limits" in plan


def test_plan_price_ordering():
    """Free < Starter < Pro en termes de prix."""
    from app.services.billing_service import PLANS
    assert PLANS["free"]["price_eur"] == 0
    assert PLANS["starter"]["price_eur"] > 0
    assert PLANS["pro"]["price_eur"] > PLANS["starter"]["price_eur"]
