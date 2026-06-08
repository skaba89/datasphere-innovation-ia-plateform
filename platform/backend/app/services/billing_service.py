"""
Stripe Billing Service

Handles:
  - Checkout session creation
  - Webhook event processing (invoice.paid, subscription.updated, ...)
  - Subscription status sync
  - Plan enforcement (quota checks)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.subscription import PLANS, BillingEvent, Subscription
from app.models.workspace import Workspace

log = logging.getLogger("datasphere.billing")


# ── Stripe initialization ─────────────────────────────────────────────────────

def _stripe():
    """Lazy-import Stripe to avoid import errors when key is not set."""
    import stripe as _s
    settings = get_settings()
    _s.api_key = settings.stripe_secret_key
    return _s


# ── Public API ────────────────────────────────────────────────────────────────

def get_or_create_subscription(db: Session, workspace_id: int) -> Subscription:
    """Return existing subscription or create a free one."""
    sub = db.query(Subscription).filter(Subscription.workspace_id == workspace_id).first()
    if not sub:
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        sub = Subscription(
            workspace_id=workspace_id,
            plan="free",
            status="active",
            customer_email=None,
            customer_name=ws.name if ws else None,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


def create_checkout_session(
    db: Session,
    workspace_id: int,
    plan: str,
    billing_cycle: str,
    customer_email: str,
) -> dict[str, Any]:
    """
    Create a Stripe Checkout session for plan upgrade.
    Returns {'url': checkout_url, 'session_id': session_id}.
    Falls back to mock URL if Stripe is not configured.
    """
    settings = get_settings()

    if plan not in PLANS or plan == "free":
        raise ValueError(f"Invalid plan: {plan}")

    sub = get_or_create_subscription(db, workspace_id)

    # If Stripe not configured → return mock (dev/demo mode)
    if not settings.stripe_enabled:
        log.warning("Stripe not configured — returning mock checkout URL")
        return {
            "url": f"{settings.stripe_success_url}?mock=1&plan={plan}&workspace={workspace_id}",
            "session_id": f"mock_session_{workspace_id}_{plan}",
            "mock": True,
        }

    stripe = _stripe()

    # Determine price ID
    price_map = {
        ("starter", "monthly"): settings.stripe_starter_price_id,
        ("starter", "yearly"):  settings.stripe_starter_yearly_price_id,
        ("pro",     "monthly"): settings.stripe_pro_price_id,
        ("pro",     "yearly"):  settings.stripe_pro_yearly_price_id,
    }
    price_id = price_map.get((plan, billing_cycle))
    if not price_id:
        raise ValueError(f"No Stripe price ID configured for {plan}/{billing_cycle}")

    # Get or create Stripe customer
    if sub.stripe_customer_id:
        customer_id = sub.stripe_customer_id
    else:
        customer = stripe.Customer.create(
            email=customer_email,
            name=sub.customer_name,
            metadata={"workspace_id": str(workspace_id), "platform": "datasphere"},
        )
        customer_id = customer.id
        sub.stripe_customer_id = customer_id
        sub.customer_email = customer_email
        db.commit()

    # Create checkout session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=settings.stripe_success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=settings.stripe_cancel_url,
        subscription_data={
            "metadata": {
                "workspace_id": str(workspace_id),
                "plan": plan,
                "platform": "datasphere",
            }
        },
        metadata={"workspace_id": str(workspace_id), "plan": plan},
    )

    return {"url": session.url, "session_id": session.id, "mock": False}


def create_portal_session(db: Session, workspace_id: int) -> dict[str, Any]:
    """Create Stripe Customer Portal session for subscription management."""
    settings = get_settings()
    sub = get_or_create_subscription(db, workspace_id)

    if not settings.stripe_enabled or not sub.stripe_customer_id:
        return {"url": f"http://localhost:5173/workspaces?tab=billing&mock=1", "mock": True}

    stripe = _stripe()
    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.stripe_success_url.replace('/subscription/success', '')}/workspaces",
    )
    return {"url": session.url, "mock": False}


def process_webhook(db: Session, payload: bytes, sig_header: str) -> dict[str, Any]:
    """Verify and process a Stripe webhook event."""
    settings = get_settings()
    stripe = _stripe()

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError as e:
        log.error("Stripe webhook signature invalid: %s", e)
        raise ValueError("Invalid signature") from e

    # Idempotency: skip already-processed events
    existing = db.query(BillingEvent).filter(
        BillingEvent.stripe_event_id == event["id"]
    ).first()
    if existing and existing.processed:
        log.info("Event %s already processed — skipping", event["id"])
        return {"status": "already_processed"}

    # Log the event
    billing_event = BillingEvent(
        stripe_event_id=event["id"],
        event_type=event["type"],
        payload=json.dumps(event["data"]["object"]),
    )
    db.add(billing_event)
    db.commit()

    # Dispatch
    try:
        _handle_event(db, event)
        billing_event.processed = True
    except Exception as e:
        billing_event.error = str(e)
        log.exception("Error processing Stripe event %s: %s", event["id"], e)
    finally:
        db.commit()

    return {"status": "processed", "event_type": event["type"]}


def _handle_event(db: Session, event: dict) -> None:
    """Dispatch Stripe event to the appropriate handler."""
    obj = event["data"]["object"]
    etype = event["type"]

    if etype in ("customer.subscription.created", "customer.subscription.updated"):
        _sync_subscription(db, obj)
    elif etype == "customer.subscription.deleted":
        _cancel_subscription(db, obj)
    elif etype == "invoice.paid":
        _handle_invoice_paid(db, obj)
    elif etype == "invoice.payment_failed":
        _handle_payment_failed(db, obj)
    else:
        log.debug("Unhandled Stripe event type: %s", etype)


def _sync_subscription(db: Session, stripe_sub: dict) -> None:
    """Sync Stripe subscription data to local DB."""
    workspace_id = int(stripe_sub.get("metadata", {}).get("workspace_id", 0))
    if not workspace_id:
        # Try to find by stripe_subscription_id
        existing = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub["id"]
        ).first()
        if existing:
            workspace_id = existing.workspace_id
        else:
            log.warning("No workspace_id in Stripe subscription metadata: %s", stripe_sub["id"])
            return

    sub = get_or_create_subscription(db, workspace_id)
    plan = stripe_sub.get("metadata", {}).get("plan", "starter")

    sub.stripe_subscription_id = stripe_sub["id"]
    sub.stripe_price_id = stripe_sub["items"]["data"][0]["price"]["id"] if stripe_sub.get("items") else None
    sub.plan = plan
    sub.status = stripe_sub["status"]
    sub.billing_cycle = "yearly" if stripe_sub.get("items", {}).get("data", [{}])[0].get("plan", {}).get("interval") == "year" else "monthly"

    if stripe_sub.get("trial_end"):
        sub.trial_end = datetime.fromtimestamp(stripe_sub["trial_end"], tz=timezone.utc).replace(tzinfo=None)
    if stripe_sub.get("current_period_start"):
        sub.current_period_start = datetime.fromtimestamp(stripe_sub["current_period_start"], tz=timezone.utc).replace(tzinfo=None)
    if stripe_sub.get("current_period_end"):
        sub.current_period_end = datetime.fromtimestamp(stripe_sub["current_period_end"], tz=timezone.utc).replace(tzinfo=None)

    # Sync plan to workspace
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if ws:
        ws.plan = plan

    db.commit()
    log.info("Synced subscription for workspace %d → plan=%s status=%s", workspace_id, plan, sub.status)


def _cancel_subscription(db: Session, stripe_sub: dict) -> None:
    sub = db.query(Subscription).filter(
        Subscription.stripe_subscription_id == stripe_sub["id"]
    ).first()
    if not sub:
        return
    sub.status = "canceled"
    sub.canceled_at = datetime.utcnow()
    sub.plan = "free"
    ws = db.query(Workspace).filter(Workspace.id == sub.workspace_id).first()
    if ws:
        ws.plan = "free"
    db.commit()
    log.info("Subscription canceled for workspace %d", sub.workspace_id)


def _handle_invoice_paid(db: Session, invoice: dict) -> None:
    log.info("Invoice paid: %s — amount: %s", invoice.get("id"), invoice.get("amount_paid"))


def _handle_payment_failed(db: Session, invoice: dict) -> None:
    sub_id = invoice.get("subscription")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(
        Subscription.stripe_subscription_id == sub_id
    ).first()
    if sub:
        sub.status = "past_due"
        db.commit()
    log.warning("Payment failed for subscription %s", sub_id)


# ── Quota enforcement ─────────────────────────────────────────────────────────

def check_quota(db: Session, workspace_id: int, resource: str) -> dict[str, Any]:
    """
    Check if workspace is within plan quota for a resource.
    resource: 'members' | 'tenders' | 'deliverables' | 'ai_actions'

    Returns:
      {'allowed': bool, 'used': int, 'limit': int, 'plan': str}
    """
    sub = get_or_create_subscription(db, workspace_id)
    plan_cfg = PLANS.get(sub.plan, PLANS["free"])
    limit_key = f"max_{resource}" if resource != "ai_actions" else "ai_actions_month"
    limit = plan_cfg.get(limit_key, 0)

    if limit == -1:  # unlimited
        return {"allowed": True, "used": 0, "limit": -1, "plan": sub.plan, "unlimited": True}

    # Count current usage
    from app.models.tender import Tender
    from app.models.deliverable import Deliverable
    from app.models.workspace import WorkspaceMember

    used = 0
    if resource == "tenders":
        used = db.query(Tender).count()
    elif resource == "deliverables":
        used = db.query(Deliverable).count()
    elif resource == "members":
        used = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id
        ).count()
    elif resource == "ai_actions":
        used = sub.ai_actions_used or 0

    return {
        "allowed": used < limit,
        "used": used,
        "limit": limit,
        "plan": sub.plan,
        "unlimited": False,
        "upgrade_required": used >= limit,
    }


def increment_ai_usage(db: Session, workspace_id: int) -> int:
    """Increment AI action counter. Returns new count."""
    sub = get_or_create_subscription(db, workspace_id)
    sub.ai_actions_used = (sub.ai_actions_used or 0) + 1
    db.commit()
    return sub.ai_actions_used
