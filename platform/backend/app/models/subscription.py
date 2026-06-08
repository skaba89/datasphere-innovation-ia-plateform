"""
Subscription model — Stripe billing integration.

Tracks workspace subscriptions, Stripe customer IDs,
plan changes, and usage quotas.
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime,
    ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


# ── Plan catalog (single source of truth) ─────────────────────────────────────

PLANS: dict[str, dict] = {
    "free": {
        "label":            "Gratuit",
        "price_eur":        0,
        "price_monthly_id": None,
        "price_yearly_id":  None,
        "max_members":      1,
        "max_tenders":      5,
        "max_deliverables": 10,
        "ai_actions_month": 20,
        "features": [
            "1 utilisateur",
            "5 appels d'offres / mois",
            "10 livrables",
            "20 actions IA / mois",
            "Export CSV",
        ],
        "highlight": False,
    },
    "starter": {
        "label":            "Starter",
        "price_eur":        29,
        "price_monthly_id": None,   # set via STRIPE_STARTER_PRICE_ID env
        "price_yearly_id":  None,
        "max_members":      3,
        "max_tenders":      30,
        "max_deliverables": 100,
        "ai_actions_month": 200,
        "features": [
            "3 utilisateurs",
            "30 appels d'offres / mois",
            "100 livrables",
            "200 actions IA / mois",
            "Export Excel + CSV",
            "Veille AO automatique",
            "Support email",
        ],
        "highlight": False,
    },
    "pro": {
        "label":            "Pro",
        "price_eur":        79,
        "price_monthly_id": None,   # set via STRIPE_PRO_PRICE_ID env
        "price_yearly_id":  None,
        "max_members":      10,
        "max_tenders":      -1,     # -1 = unlimited
        "max_deliverables": -1,
        "ai_actions_month": -1,
        "features": [
            "10 utilisateurs",
            "AO illimités",
            "Livrables illimités",
            "IA illimitée",
            "Tous les exports",
            "Staffing IA",
            "Rapport de mission",
            "Support prioritaire",
        ],
        "highlight": True,
    },
    "enterprise": {
        "label":            "Entreprise",
        "price_eur":        -1,     # contact sales
        "price_monthly_id": None,
        "price_yearly_id":  None,
        "max_members":      -1,
        "max_tenders":      -1,
        "max_deliverables": -1,
        "ai_actions_month": -1,
        "features": [
            "Utilisateurs illimités",
            "Multi-workspace",
            "White-label",
            "API access",
            "SSO / SAML",
            "SLA garanti",
            "CSM dédié",
        ],
        "highlight": False,
    },
}


# ── Subscription model ────────────────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id                     = Column(Integer, primary_key=True, index=True)
    workspace_id           = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"),
                                    nullable=False, unique=True, index=True)

    # Stripe identifiers
    stripe_customer_id     = Column(String(255), nullable=True, unique=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True, unique=True, index=True)
    stripe_price_id        = Column(String(255), nullable=True)

    # Plan info
    plan                   = Column(String(50), nullable=False, default="free")
    status                 = Column(String(50), nullable=False, default="active")
    # active | trialing | past_due | canceled | unpaid

    billing_cycle          = Column(String(20), nullable=False, default="monthly")
    # monthly | yearly

    # Dates
    trial_end              = Column(DateTime, nullable=True)
    current_period_start   = Column(DateTime, nullable=True)
    current_period_end     = Column(DateTime, nullable=True)
    canceled_at            = Column(DateTime, nullable=True)

    # Usage counters (reset monthly)
    ai_actions_used        = Column(Integer, nullable=False, default=0)
    ai_actions_reset_at    = Column(DateTime, nullable=True)

    # Customer info
    customer_email         = Column(String(255), nullable=True)
    customer_name          = Column(String(255), nullable=True)

    # Metadata
    notes                  = Column(Text, nullable=True)
    created_at             = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at             = Column(DateTime, default=datetime.utcnow,
                                    onupdate=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", foreign_keys=[workspace_id])


# ── Billing event log ─────────────────────────────────────────────────────────

class BillingEvent(Base):
    """Append-only ledger of Stripe webhook events for auditability."""

    __tablename__ = "billing_events"

    id             = Column(Integer, primary_key=True, index=True)
    workspace_id   = Column(Integer, ForeignKey("workspaces.id", ondelete="SET NULL"),
                            nullable=True, index=True)
    stripe_event_id = Column(String(255), nullable=False, unique=True, index=True)
    event_type     = Column(String(100), nullable=False)
    # invoice.paid | customer.subscription.updated | …
    payload        = Column(Text, nullable=True)       # JSON string
    processed      = Column(Boolean, nullable=False, default=False)
    error          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
