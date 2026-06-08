"""
Webhooks sortants — notifier des outils tiers (Zapier, Make, n8n…)
sur les événements clés de la plateforme.

Événements supportés :
  opportunity.created   | opportunity.stage_changed
  tender.created        | tender.decision (go/no-go)
  deliverable.approved
  contact.created
  boamp.match           (AO BOAMP à score élevé)

Configuration :
  POST /webhooks          — enregistrer un webhook
  GET  /webhooks          — lister les webhooks actifs
  DELETE /webhooks/{id}   — supprimer
  POST /webhooks/{id}/test — envoyer un événement test
  GET  /webhooks/events   — catalogue des événements disponibles

Delivery :
  - POST HTTP avec payload JSON signé (HMAC-SHA256)
  - Retry 3× avec backoff exponentiel (2s, 10s, 30s) en thread daemon
  - Timeout 10s par requête
  - Logs de livraison consultables
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import threading
import time
import urllib.request
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Session

from app.db.session import Base

log = logging.getLogger("datasphere.webhooks")


# ── Model ─────────────────────────────────────────────────────────────────────

class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True)

    url          = Column(String(500), nullable=False)
    secret       = Column(String(64),  nullable=False)          # HMAC signing secret
    name         = Column(String(100), nullable=False)          # "Mon Zapier"
    events       = Column(Text, nullable=False, default="*")    # "*" or "opportunity.created deliverable.approved"
    is_active    = Column(Boolean, nullable=False, default=True)
    last_delivery_at     = Column(DateTime, nullable=True)
    last_delivery_status = Column(String(10), nullable=True)     # "200" | "500" | "timeout"

    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ── Event catalog ─────────────────────────────────────────────────────────────

WEBHOOK_EVENTS = {
    "opportunity.created":       "Nouvelle opportunité créée dans le CRM",
    "opportunity.stage_changed": "Statut d'une opportunité modifié",
    "tender.created":            "Nouvel appel d'offres créé",
    "tender.decision":           "Décision Go / No-Go sur un AO",
    "deliverable.approved":      "Livrable approuvé",
    "deliverable.created":       "Nouveau livrable créé",
    "contact.created":           "Nouveau contact ajouté au CRM",
    "boamp.match":               "AO BOAMP détecté avec score élevé",
    "subscription.upgraded":     "Abonnement mis à niveau",
}


# ── Delivery engine ───────────────────────────────────────────────────────────

def _sign_payload(secret: str, payload: bytes) -> str:
    """Generate HMAC-SHA256 signature for the payload."""
    return "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def _deliver(endpoint: WebhookEndpoint, event_type: str, data: dict, db_session_factory) -> None:
    """
    Deliver a webhook event to the endpoint URL.
    Called in a daemon thread — retries 3× with exponential backoff.
    """
    payload = json.dumps({
        "event":     event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data":      data,
        "source":    "datasphere-innovation",
    }, ensure_ascii=False).encode()

    signature = _sign_payload(endpoint.secret, payload)
    headers = {
        "Content-Type":          "application/json",
        "X-DataSphere-Event":    event_type,
        "X-DataSphere-Signature": signature,
        "X-DataSphere-Delivery": secrets.token_hex(8),
        "User-Agent":            "DataSphere-Webhook/1.9",
    }

    delays = [0, 2, 10, 30]   # immediate + 3 retries
    final_status = "error"

    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
        try:
            req = urllib.request.Request(endpoint.url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                final_status = str(resp.status)
                log.info("Webhook delivered: %s → %s (HTTP %s)", event_type, endpoint.url[:60], resp.status)
                break
        except Exception as e:
            if attempt == len(delays) - 1:
                final_status = "timeout" if "timeout" in str(e).lower() else "error"
                log.warning("Webhook delivery failed after %d attempts: %s → %s: %s",
                            len(delays), event_type, endpoint.url[:60], e)

    # Update last_delivery stats (best-effort, new DB session)
    try:
        db = db_session_factory()
        ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint.id).first()
        if ep:
            ep.last_delivery_at     = datetime.utcnow()
            ep.last_delivery_status = final_status[:10]
            db.commit()
        db.close()
    except Exception:
        pass


def dispatch_event(event_type: str, data: dict, db: Session) -> int:
    """
    Dispatch a webhook event to all matching active endpoints.
    Delivery is asynchronous (daemon threads).
    Returns number of endpoints dispatched to.
    """
    endpoints = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.is_active == True   # noqa
    ).all()

    matching = [
        ep for ep in endpoints
        if ep.events == "*" or event_type in ep.events.split()
    ]

    if not matching:
        return 0

    from app.db.session import SessionLocal

    for ep in matching:
        t = threading.Thread(
            target=_deliver,
            args=(ep, event_type, data, SessionLocal),
            daemon=True,
        )
        t.start()

    log.info("Dispatched event '%s' to %d endpoints", event_type, len(matching))
    return len(matching)
