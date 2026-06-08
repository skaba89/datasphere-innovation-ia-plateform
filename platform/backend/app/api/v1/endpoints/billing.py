"""
Billing API endpoints

GET  /billing/plans              — Public plan catalog (no auth)
GET  /billing/subscription       — Current workspace subscription
POST /billing/checkout           — Create Stripe checkout session
POST /billing/portal             — Create Stripe customer portal session
POST /billing/webhook            — Stripe webhook handler (no auth, signed)
POST /billing/mock-upgrade       — Dev/demo: upgrade plan without Stripe
GET  /billing/quota/{resource}   — Check quota for a resource
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.subscription import PLANS
from app.models.user import User
from app.services.billing_service import (
    check_quota,
    create_checkout_session,
    create_portal_session,
    get_or_create_subscription,
    process_webhook,
)

log = logging.getLogger("datasphere.billing")

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    workspace_id:  int
    plan:          str = Field(..., pattern=r"^(starter|pro|enterprise)$")
    billing_cycle: str = Field("monthly", pattern=r"^(monthly|yearly)$")
    customer_email: EmailStr


class CheckoutResponse(BaseModel):
    url:        str
    session_id: str
    mock:       bool = False


class PortalRequest(BaseModel):
    workspace_id: int


class MockUpgradeRequest(BaseModel):
    workspace_id: int
    plan: str = Field(..., pattern=r"^(free|starter|pro|enterprise)$")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans")
def list_plans():
    """Public plan catalog — no authentication required. Cached 15 min."""
    from app.core.cache import cache, PLANS_TTL
    cached = cache.get("billing:plans")
    if cached is not None:
        return cached
    result = {
        "plans": [
            {
                "key":          key,
                "label":        cfg["label"],
                "price_eur":    cfg["price_eur"],
                "billing_note": "/ mois" if cfg["price_eur"] > 0 else (
                    "sur devis" if cfg["price_eur"] < 0 else "gratuit pour toujours"
                ),
                "highlight":    cfg["highlight"],
                "features":     cfg["features"],
                "limits": {
                    "members":      cfg["max_members"],
                    "tenders":      cfg["max_tenders"],
                    "deliverables": cfg["max_deliverables"],
                    "ai_actions":   cfg["ai_actions_month"],
                },
            }
            for key, cfg in PLANS.items()
        ],
        "stripe_enabled": get_settings().stripe_enabled,
    }
    cache.set("billing:plans", result, ttl=PLANS_TTL)
    return result


@router.get("/subscription", dependencies=[Depends(get_current_user)])
def get_subscription(
    workspace_id: int,
    db: Session = Depends(get_db),
):
    """Return current subscription for a workspace."""
    sub = get_or_create_subscription(db, workspace_id)
    plan_cfg = PLANS.get(sub.plan, PLANS["free"])
    return {
        "workspace_id":           workspace_id,
        "plan":                   sub.plan,
        "plan_label":             plan_cfg["label"],
        "status":                 sub.status,
        "billing_cycle":          sub.billing_cycle,
        "stripe_customer_id":     sub.stripe_customer_id,
        "stripe_subscription_id": sub.stripe_subscription_id,
        "trial_end":              sub.trial_end.isoformat() if sub.trial_end else None,
        "current_period_end":     sub.current_period_end.isoformat() if sub.current_period_end else None,
        "canceled_at":            sub.canceled_at.isoformat() if sub.canceled_at else None,
        "ai_actions_used":        sub.ai_actions_used,
        "ai_actions_limit":       plan_cfg["ai_actions_month"],
        "features":               plan_cfg["features"],
        "stripe_enabled":         get_settings().stripe_enabled,
    }


@router.post("/checkout", response_model=CheckoutResponse,
             dependencies=[Depends(get_current_user)])
def create_checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    """Create a Stripe Checkout session for plan upgrade."""
    try:
        result = create_checkout_session(
            db=db,
            workspace_id=payload.workspace_id,
            plan=payload.plan,
            billing_cycle=payload.billing_cycle,
            customer_email=str(payload.customer_email),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("Checkout error: %s", e)
        raise HTTPException(status_code=500, detail="Erreur lors de la création du paiement")


@router.post("/portal", dependencies=[Depends(get_current_user)])
def billing_portal(payload: PortalRequest, db: Session = Depends(get_db)):
    """Create a Stripe Customer Portal session."""
    result = create_portal_session(db, payload.workspace_id)
    return result


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    """
    Stripe webhook handler.
    Verifies signature and processes events asynchronously.
    Public endpoint — authentication is via Stripe signature.
    """
    payload = await request.body()

    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        result = process_webhook(db, payload, stripe_signature)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mock-upgrade", dependencies=[Depends(get_current_user)])
def mock_upgrade(
    payload: MockUpgradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dev/demo mode: upgrade workspace plan without going through Stripe.
    Only available when stripe_enabled=False or APP_ENV=development.
    """
    settings = get_settings()
    if settings.stripe_enabled and settings.app_env not in ("development", "dev", "test"):
        raise HTTPException(
            status_code=403,
            detail="Mock upgrade not available in production. Use Stripe checkout."
        )

    sub = get_or_create_subscription(db, payload.workspace_id)
    from app.models.workspace import Workspace
    ws = db.query(Workspace).filter(Workspace.id == payload.workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    sub.plan = payload.plan
    sub.status = "active"
    ws.plan = payload.plan
    db.commit()

    return {
        "success": True,
        "workspace_id": payload.workspace_id,
        "plan": payload.plan,
        "message": f"Plan mis à jour vers '{payload.plan}' (mode demo)",
    }


@router.get("/quota/{resource}", dependencies=[Depends(get_current_user)])
def get_quota(
    resource: str,
    workspace_id: int,
    db: Session = Depends(get_db),
):
    """
    Check quota for a specific resource.
    resource: members | tenders | deliverables | ai_actions
    """
    if resource not in ("members", "tenders", "deliverables", "ai_actions"):
        raise HTTPException(status_code=400, detail=f"Unknown resource: {resource}")

    return check_quota(db, workspace_id, resource)
