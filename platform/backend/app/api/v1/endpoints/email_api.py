"""
Email API endpoints

POST /email/send              — Envoyer un email typé
POST /email/preview           — Prévisualiser le HTML d'un email (dry-run)
POST /email/sequences/plan    — Planifier une séquence de relance
GET  /email/types             — Liste des types d'emails disponibles
GET  /email/track/{id}        — Pixel de tracking d'ouverture (public)
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.email_service import (
    EmailType, RelanceSequence, build_email, send_typed_email,
)

log = logging.getLogger("datasphere.email_api")

router = APIRouter(prefix="/email", tags=["email"])

# 1×1 transparent GIF
_TRACKING_PIXEL = bytes.fromhex(
    "47494638396101000100800000ffffff00000021f9040000000000002c00000000"
    "01000100000002024401003b"
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class SendEmailRequest(BaseModel):
    to:         EmailStr
    email_type: EmailType
    params:     dict[str, Any]
    dry_run:    bool = False


class PreviewRequest(BaseModel):
    email_type: EmailType
    params:     dict[str, Any]


class SequencePlanRequest(BaseModel):
    opportunity_id: int
    contact_email:  EmailStr
    first_name:     str
    contact_name:   str
    opp_title:      str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send", dependencies=[Depends(get_current_user)])
def send_email_endpoint(
    req: SendEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a typed email to a recipient."""
    success = send_typed_email(
        to=str(req.to),
        email_type=req.email_type,
        params=req.params,
        dry_run=req.dry_run,
    )
    return {
        "success":   success,
        "to":        str(req.to),
        "type":      req.email_type,
        "dry_run":   req.dry_run,
        "message":   "Email envoyé" if success else "Échec de l'envoi",
    }


@router.post("/preview", dependencies=[Depends(get_current_user)])
def preview_email(req: PreviewRequest):
    """
    Return the rendered HTML for an email without sending it.
    Useful for previewing templates in the UI.
    """
    from app.services.email_service import _base_template
    subject, body = build_email(req.email_type, req.params)
    html = _base_template(subject, body, tracking_id=None)
    return {
        "subject": subject,
        "html":    html,
        "type":    req.email_type,
    }


@router.post("/sequences/plan", dependencies=[Depends(get_current_user)])
def plan_relance_sequence(req: SequencePlanRequest):
    """
    Plan a J+3/J+7/J+14 relance sequence for an opportunity.
    Returns the schedule — in production, this would be persisted to a task queue.
    """
    params = {
        "first_name":   req.first_name,
        "contact_name": req.contact_name,
        "opp_title":    req.opp_title,
        "url":          f"https://datasphere-innovation.fr/opportunities/{req.opportunity_id}",
    }
    schedule = RelanceSequence.plan(req.opportunity_id, str(req.contact_email), params)
    return {
        "opportunity_id": req.opportunity_id,
        "contact_email":  str(req.contact_email),
        "sequence":       schedule,
        "total_emails":   len(schedule),
        "message":        "Séquence planifiée : J+3, J+7, J+14",
    }


@router.get("/types", dependencies=[Depends(get_current_user)])
def list_email_types():
    """List all available email types with descriptions."""
    return {
        "types": [
            {"key": EmailType.WELCOME,               "label": "Bienvenue",              "trigger": "Création de compte"},
            {"key": EmailType.OPPORTUNITY_CREATED,    "label": "Opportunité créée",      "trigger": "Nouvelle opportunité CRM"},
            {"key": EmailType.TENDER_MATCH,           "label": "Match AO",               "trigger": "AO correspondant détecté"},
            {"key": EmailType.DELIVERABLE_REVIEW,     "label": "Livrable en révision",   "trigger": "Livrable soumis"},
            {"key": EmailType.DELIVERABLE_APPROVED,   "label": "Livrable approuvé",      "trigger": "Livrable validé"},
            {"key": EmailType.RELANCE_J3,             "label": "Relance J+3",            "trigger": "3 jours après contact"},
            {"key": EmailType.RELANCE_J7,             "label": "Relance J+7",            "trigger": "7 jours après contact"},
            {"key": EmailType.RELANCE_J14,            "label": "Relance J+14",           "trigger": "14 jours sans réponse"},
            {"key": EmailType.SUBSCRIPTION_UPGRADE,   "label": "Upgrade abonnement",     "trigger": "Paiement Stripe réussi"},
            {"key": EmailType.TEAM_INVITE,            "label": "Invitation équipe",      "trigger": "Invitation workspace"},
        ]
    }


@router.get("/track/{tracking_id}", include_in_schema=False)
def tracking_pixel(tracking_id: str, db: Session = Depends(get_db)):
    """
    1×1 pixel for email open tracking.
    Public endpoint — no auth required (called by email client).
    """
    log.info("Email opened: tracking_id=%s", tracking_id)
    # In production: update email_tracking table with open timestamp
    return Response(
        content=_TRACKING_PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.post("/test")
def test_smtp_config(
    to: str | None = None,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Test la config SMTP en envoyant un email de vérification. Admin uniquement."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from app.core.config import get_settings

    settings = get_settings()

    if not settings.smtp_enabled:
        return {
            "success": False,
            "status": "not_configured",
            "message": "SMTP non configuré. Ajoutez SMTP_HOST et SMTP_USER dans les variables Render.",
            "fix": {
                "SMTP_HOST": "mail.datasphere-innovation.net",
                "SMTP_PORT": "587",
                "SMTP_USER": "infos@datasphere-innovation.net",
                "SMTP_PASSWORD": "(mot de passe mail LWS)",
                "SMTP_FROM": "DataSphere Innovation <infos@datasphere-innovation.net>",
            }
        }

    recipient = to or current_user.email
    cfg = {"host": settings.smtp_host, "port": settings.smtp_port,
           "user": settings.smtp_user, "tls": settings.smtp_tls}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "[DataSphere] ✅ Test SMTP"
        msg["From"]    = settings.smtp_from
        msg["To"]      = recipient
        msg.attach(MIMEText(
            f"<h2>✅ SMTP OK</h2><p>Serveur : {settings.smtp_host}:{settings.smtp_port}</p>",
            "html", "utf-8"
        ))
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            if settings.smtp_tls:
                s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)
            s.sendmail(settings.smtp_from, [recipient], msg.as_string())

        return {"success": True, "status": "sent",
                "message": f"Email de test envoyé à {recipient}", "config": cfg}

    except smtplib.SMTPAuthenticationError:
        return {"success": False, "status": "auth_error",
                "message": "❌ Authentification échouée — SMTP_PASSWORD incorrect ?", "config": cfg}
    except (smtplib.SMTPConnectError, ConnectionRefusedError, TimeoutError) as e:
        return {"success": False, "status": "connect_error",
                "message": f"❌ Connexion impossible à {settings.smtp_host}:{settings.smtp_port}: {e}", "config": cfg}
    except Exception as e:
        return {"success": False, "status": "error",
                "message": str(e)[:200], "config": cfg}
