"""
SMTP Service — transactional emails for DataSphere Innovation Platform.
- send_deliverable: approved deliverable to client
- send_contact: contact form submission notification
- send_reset_password: password reset link
Falls back gracefully when SMTP is not configured.
"""

from __future__ import annotations

import logging
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailSendResult:
    def __init__(self, sent: bool, provider: str, message: str):
        self.sent = sent
        self.provider = provider
        self.message = message

    def dict(self):
        return {"sent": self.sent, "provider": self.provider, "message": self.message}


def send_deliverable(
    db: Session,
    deliverable_id: int,
    to_email: str,
    to_name: str,
) -> EmailSendResult:
    """
    Send an approved deliverable by email.
    The HTML export is attached as an .html file (openable in any browser → print as PDF).
    Returns a result indicating if the email was actually sent or preview-only.
    """
    settings = get_settings()

    # Generate preview content
    from app.services.email_preview_service import generate_email_preview
    from app.api.v1.endpoints.export import _md_to_html, _TYPE_LABELS, _STATUS_LABELS
    from app.crud.deliverable import get_deliverable
    from datetime import datetime

    deliverable = get_deliverable(db, deliverable_id)
    if not deliverable:
        raise ValueError(f"Deliverable {deliverable_id} not found")

    preview = generate_email_preview(db, deliverable_id)
    subject = preview.subject
    html_body = preview.html_body
    text_body = preview.text_body

    if not settings.smtp_enabled:
        logger.info(
            "SMTP not configured — email preview generated for deliverable #%d (not sent)",
            deliverable_id,
        )
        return EmailSendResult(
            sent=False,
            provider="preview",
            message="SMTP non configuré. Configurez SMTP_HOST et SMTP_USER dans .env pour envoyer.",
        )

    # Build the MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = f"{to_name} <{to_email}>"

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Attach the deliverable as an HTML file
    from app.api.v1.endpoints.export import _md_to_html as md2html
    type_label = _TYPE_LABELS.get(deliverable.deliverable_type, deliverable.deliverable_type)
    exported_at = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
    
    # Re-generate full export HTML for attachment
    body_html = md2html(deliverable.content_markdown or "")
    full_html = f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>{deliverable.title}</title>
<style>body{{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.6;}}
h1,h2,h3{{color:#1e3a5f;}} table{{border-collapse:collapse;width:100%;}}
td,th{{border:1px solid #e2e8f0;padding:8px;}} th{{background:#f8fafc;font-weight:700;}}
</style></head><body>
<h1>{deliverable.title}</h1>
<p><strong>Type :</strong> {type_label} | <strong>Statut :</strong> Approuvé ✓ | <strong>Date :</strong> {exported_at}</p>
<hr>
{body_html}
</body></html>"""

    attachment = MIMEBase("text", "html")
    attachment.set_payload(full_html.encode("utf-8"))
    encoders.encode_base64(attachment)
    filename = f"{deliverable.deliverable_type}_{deliverable.id}.html"
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(attachment)

    # Send
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_tls:
                smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, [to_email], msg.as_string())

        logger.info("Email sent for deliverable #%d to %s via %s", deliverable_id, to_email, settings.smtp_host)
        return EmailSendResult(
            sent=True,
            provider=f"smtp://{settings.smtp_host}:{settings.smtp_port}",
            message=f"Email envoyé à {to_name} <{to_email}>.",
        )
    except Exception as exc:
        logger.error("SMTP send failed for deliverable #%d: %s", deliverable_id, exc)
        raise


def _smtp_send(msg: MIMEMultipart, to_email: str) -> None:
    """Internal helper — open SMTP connection and send a MIME message."""
    settings = get_settings()
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_tls:
            smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(settings.smtp_from, [to_email], msg.as_string())


def send_contact(
    firstname: str,
    lastname: str,
    email: str,
    organisation: str,
    need_type: str,
    message: str,
) -> EmailSendResult:
    """
    Notify DataSphere team of a new contact form submission.
    If SMTP is not configured, logs the contact and returns a non-blocking result.
    """
    settings = get_settings()
    subject = f"[DataSphere] Nouveau contact — {need_type} — {firstname} {lastname}"
    html_body = f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#1e293b">
<h2 style="color:#facc15;border-bottom:2px solid #facc15;padding-bottom:8px">
  Nouveau contact — DataSphere Innovation</h2>
<table style="width:100%;border-collapse:collapse;margin-top:20px">
  <tr><td style="padding:10px;background:#f8fafc;font-weight:700;width:160px">Prénom</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">{firstname}</td></tr>
  <tr><td style="padding:10px;background:#f8fafc;font-weight:700">Nom</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">{lastname}</td></tr>
  <tr><td style="padding:10px;background:#f8fafc;font-weight:700">Email</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">
        <a href="mailto:{email}">{email}</a></td></tr>
  <tr><td style="padding:10px;background:#f8fafc;font-weight:700">Organisation</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">{organisation or '—'}</td></tr>
  <tr><td style="padding:10px;background:#f8fafc;font-weight:700">Type de besoin</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">
        <strong style="color:#facc15">{need_type}</strong></td></tr>
  <tr><td style="padding:10px;background:#f8fafc;font-weight:700;vertical-align:top">Message</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap">{message or '—'}</td></tr>
</table>
<p style="margin-top:24px;color:#64748b;font-size:.85rem">
  Répondre directement à : <a href="mailto:{email}">{email}</a>
</p>
</body></html>"""

    text_body = (
        f"Nouveau contact DataSphere\n\n"
        f"Prénom : {firstname}\nNom : {lastname}\n"
        f"Email : {email}\nOrganisation : {organisation or '—'}\n"
        f"Besoin : {need_type}\n\nMessage :\n{message or '—'}"
    )

    logger.info(
        "Contact form — %s %s <%s> — %s",
        firstname, lastname, email, need_type,
    )

    if not settings.smtp_enabled:
        return EmailSendResult(
            sent=False,
            provider="log",
            message="Contact enregistré (SMTP non configuré — activez SMTP pour recevoir les emails).",
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = settings.smtp_user  # notify the team mailbox
    msg["Reply-To"] = f"{firstname} {lastname} <{email}>"
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        _smtp_send(msg, settings.smtp_user)
        logger.info("Contact email sent to %s", settings.smtp_user)
        return EmailSendResult(sent=True, provider=f"smtp://{settings.smtp_host}", message="Notification envoyée à l'équipe.")
    except Exception as exc:
        logger.error("Contact email send failed: %s", exc)
        return EmailSendResult(sent=False, provider="error", message=str(exc))


def send_reset_password(email: str, reset_url: str, firstname: str = "") -> EmailSendResult:
    """Send a password reset link."""
    settings = get_settings()
    greeting = f"Bonjour {firstname}," if firstname else "Bonjour,"
    subject = "Réinitialisation de votre mot de passe — DataSphere Innovation"
    html_body = f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#1e293b">
<h2 style="color:#facc15">Réinitialisation de mot de passe</h2>
<p>{greeting}</p>
<p>Vous avez demandé la réinitialisation de votre mot de passe sur DataSphere Innovation Platform.</p>
<p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
<p style="text-align:center;margin:32px 0">
  <a href="{reset_url}" style="background:#facc15;color:#06101e;padding:14px 28px;
     border-radius:8px;font-weight:700;text-decoration:none;display:inline-block">
    Réinitialiser mon mot de passe
  </a>
</p>
<p style="color:#64748b;font-size:.85rem">
  Ce lien expire dans <strong>1 heure</strong>.<br>
  Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="color:#94a3b8;font-size:.78rem">DataSphere Innovation · contact@datasphere-innovation.fr</p>
</body></html>"""
    text_body = (
        f"{greeting}\n\nRéinitialisez votre mot de passe ici :\n{reset_url}\n\n"
        "Ce lien expire dans 1 heure.\n"
        "Si vous n'avez pas fait cette demande, ignorez cet email."
    )

    if not settings.smtp_enabled:
        logger.info("Password reset URL (SMTP off): %s", reset_url)
        return EmailSendResult(sent=False, provider="log", message=f"SMTP non configuré. URL de reset : {reset_url}")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        _smtp_send(msg, email)
        return EmailSendResult(sent=True, provider=f"smtp://{settings.smtp_host}", message=f"Email de reset envoyé à {email}.")
    except Exception as exc:
        logger.error("Reset email send failed for %s: %s", email, exc)
        return EmailSendResult(sent=False, provider="error", message=str(exc))
