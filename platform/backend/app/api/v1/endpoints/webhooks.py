"""
Webhooks API

GET    /webhooks/events      — catalogue des événements disponibles
GET    /webhooks             — lister les webhooks
POST   /webhooks             — enregistrer un nouveau webhook
DELETE /webhooks/{id}        — supprimer
PATCH  /webhooks/{id}        — activer/désactiver
POST   /webhooks/{id}/test   — envoyer un événement test
"""

from __future__ import annotations

import secrets
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.webhook_service import (
    WebhookEndpoint, WEBHOOK_EVENTS, dispatch_event,
)

log = logging.getLogger("datasphere.webhooks_api")

router = APIRouter(
    prefix="/webhooks",
    tags=["webhooks"],
    dependencies=[Depends(get_current_user)],
)


class WebhookCreate(BaseModel):
    url:          str  = Field(..., min_length=8, max_length=500)
    name:         str  = Field(..., min_length=1, max_length=100)
    events:       list[str] = Field(default=["*"])
    workspace_id: int | None = None


class WebhookPatch(BaseModel):
    is_active: bool | None = None
    name:      str  | None = Field(None, max_length=100)


class WebhookRead(BaseModel):
    id:                   int
    name:                 str
    url:                  str
    events:               str
    is_active:            bool
    last_delivery_at:     str | None
    last_delivery_status: str | None
    created_at:           str

    class Config: from_attributes = True


def _to_read(ep: WebhookEndpoint) -> WebhookRead:
    return WebhookRead(
        id=ep.id, name=ep.name, url=ep.url, events=ep.events,
        is_active=ep.is_active,
        last_delivery_at=ep.last_delivery_at.isoformat() if ep.last_delivery_at else None,
        last_delivery_status=ep.last_delivery_status,
        created_at=ep.created_at.isoformat(),
    )


@router.get("/events")
def list_events():
    """Catalogue des événements webhook disponibles."""
    return {
        "events": [
            {"key": k, "description": v}
            for k, v in WEBHOOK_EVENTS.items()
        ],
        "wildcard": "Utiliser '*' pour recevoir tous les événements",
    }


@router.get("", response_model=list[WebhookRead])
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    eps = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.user_id == current_user.id
    ).order_by(WebhookEndpoint.created_at.desc()).all()
    return [_to_read(ep) for ep in eps]


@router.post("", response_model=WebhookRead, status_code=status.HTTP_201_CREATED)
def create_webhook(
    payload: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate events
    invalid = [e for e in payload.events if e != "*" and e not in WEBHOOK_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Événements inconnus : {invalid}")

    ep = WebhookEndpoint(
        user_id=current_user.id,
        workspace_id=payload.workspace_id,
        url=payload.url,
        name=payload.name,
        secret=secrets.token_hex(32),
        events=" ".join(payload.events),
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    log.info("Webhook created: user=%s url=%s events=%s", current_user.email, payload.url[:60], payload.events)
    return _to_read(ep)


@router.patch("/{webhook_id}", response_model=WebhookRead)
def update_webhook(
    webhook_id: int,
    payload: WebhookPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ep = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == webhook_id,
        WebhookEndpoint.user_id == current_user.id,
    ).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Webhook introuvable")
    if payload.is_active is not None: ep.is_active = payload.is_active
    if payload.name is not None:      ep.name      = payload.name
    db.commit()
    db.refresh(ep)
    return _to_read(ep)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ep = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == webhook_id,
        WebhookEndpoint.user_id == current_user.id,
    ).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Webhook introuvable")
    db.delete(ep)
    db.commit()


@router.post("/{webhook_id}/test")
def test_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test event to verify the webhook endpoint is reachable."""
    ep = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == webhook_id,
        WebhookEndpoint.user_id == current_user.id,
    ).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Webhook introuvable")

    dispatched = dispatch_event("webhook.test", {
        "message":    "Ceci est un événement de test DataSphere",
        "webhook_id": webhook_id,
        "timestamp":  datetime.utcnow().isoformat(),
    }, db)

    return {
        "dispatched":   dispatched > 0,
        "webhook_id":   webhook_id,
        "url":          ep.url,
        "message":      "Événement test envoyé en arrière-plan. Vérifiez votre endpoint dans quelques secondes.",
    }
