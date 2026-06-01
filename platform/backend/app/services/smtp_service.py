"""
SMTP Service — send approved deliverables by email.
Falls back to preview-only when SMTP is not configured.
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
    exported_at = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
    
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
