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


@router.get("/templates")
def list_webhook_templates(current_user=Depends(get_current_user)):
    """Return pre-built webhook templates for Zapier, Make, Slack, etc."""
    return [
        {
            "key":         "zapier_tender_go",
            "name":        "Zapier — AO décision GO",
            "description": "Déclenche un Zap quand un AO reçoit une décision GO",
            "platform":    "zapier",
            "events":      ["tender.go_decision"],
            "payload_example": {
                "event":      "tender.go_decision",
                "tender_id":  42,
                "title":      "Mission Data Lake ARTP",
                "buyer_name": "ARTP Guinée",
                "score":      87,
                "decision":   "go",
                "deadline":   "2026-07-15T00:00:00Z",
            },
            "setup_url":   "https://zapier.com/apps/webhooks",
            "docs":        "Collez l'URL du Zap dans le champ URL de votre webhook DataSphere.",
        },
        {
            "key":         "make_workflow_complete",
            "name":        "Make — Workflow terminé",
            "description": "Déclenche un scénario Make quand un mémoire technique est prêt",
            "platform":    "make",
            "events":      ["workflow.completed"],
            "payload_example": {
                "event":          "workflow.completed",
                "tender_id":      42,
                "tender_title":   "Mission Data Lake ARTP",
                "deliverable_id": 15,
                "generated_at":   "2026-06-13T08:30:00Z",
            },
            "setup_url": "https://www.make.com/en/integrations/webhooks",
            "docs":      "Créez un scénario Make avec le module Webhooks > Custom Webhook.",
        },
        {
            "key":         "slack_boamp_match",
            "name":        "Slack — BOAMP AO détecté",
            "description": "Notifie un canal Slack quand un AO BOAMP à fort score est détecté",
            "platform":    "slack",
            "events":      ["boamp.match"],
            "payload_example": {
                "text":        "🎯 *Nouvel AO détecté* — Mission Data Engineering (Score : 91/100)",
                "attachments": [{
                    "color":  "#facc15",
                    "fields": [
                        {"title": "Acheteur",  "value": "ARTP Guinée",    "short": True},
                        {"title": "Score",     "value": "91/100",         "short": True},
                        {"title": "Deadline",  "value": "15 juillet 2026","short": True},
                    ],
                }],
            },
            "setup_url": "https://api.slack.com/messaging/webhooks",
            "docs":      "Créez une Slack App avec Incoming Webhooks activé.",
        },
        {
            "key":         "teams_deliverable_approved",
            "name":        "Microsoft Teams — Livrable approuvé",
            "description": "Notifie un canal Teams quand un livrable est approuvé",
            "platform":    "teams",
            "events":      ["deliverable.approved"],
            "payload_example": {
                "@type":    "MessageCard",
                "@context": "http://schema.org/extensions",
                "title":    "✅ Livrable approuvé",
                "text":     "Le mémoire **Mission Data Lake ARTP** a été approuvé.",
                "sections": [{"facts": [
                    {"name": "Livrable", "value": "Mémoire Technique — Mission Data Lake"},
                    {"name": "Approuvé par", "value": "Cheickna KABA"},
                    {"name": "Date", "value": "13/06/2026"},
                ]}],
            },
            "setup_url": "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors",
            "docs":      "Dans Teams : canal → Connecteurs → Webhook entrant.",
        },
        {
            "key":         "notion_tender_created",
            "name":        "Notion — AO importé",
            "description": "Crée une page Notion quand un nouvel AO est importé",
            "platform":    "notion",
            "events":      ["tender.created"],
            "payload_example": {
                "event":      "tender.created",
                "tender_id":  43,
                "title":      "Mission Gouvernance Data — DGNUM",
                "buyer_name": "DGNUM Mali",
                "source":     "boamp",
                "created_at": "2026-06-13T06:00:00Z",
            },
            "setup_url": "https://www.make.com/en/integrations/notion",
            "docs":      "Utilisez Make pour connecter ce webhook à votre base Notion.",
        },
    ]
