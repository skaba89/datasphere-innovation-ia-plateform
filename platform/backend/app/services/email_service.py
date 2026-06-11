"""
Service d'email pour DataSphere Innovation IA Platform.

Fonctionnalités :
  - Templates HTML branded DataSphere (confirmation, relance, bienvenue)
  - Envoi SMTP avec retry
  - Séquences de relance automatique (J+3, J+7, J+14)
  - Tracking d'ouverture (pixel 1×1)
  - Mode dry-run si SMTP non configuré (log uniquement)
"""
from __future__ import annotations

import hashlib
import logging
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

log = logging.getLogger("datasphere.email")


# ── Email types ────────────────────────────────────────────────────────────────

class EmailType(str, Enum):
    WELCOME          = "welcome"
    OPPORTUNITY_CREATED = "opportunity_created"
    TENDER_MATCH     = "tender_match"
    DELIVERABLE_REVIEW = "deliverable_review"
    DELIVERABLE_APPROVED = "deliverable_approved"
    RELANCE_J3       = "relance_j3"
    RELANCE_J7       = "relance_j7"
    RELANCE_J14      = "relance_j14"
    SUBSCRIPTION_UPGRADE = "subscription_upgrade"
    TEAM_INVITE      = "team_invite"


# ── Brand constants ───────────────────────────────────────────────────────────

BRAND = {
    "name":    "DataSphere Innovation",
    "tagline": "La plateforme IA pour les consultants Data",
    "primary": "#facc15",
    "bg":      "#07111f",
    "url":     "https://datasphere-innovation.fr",
    "support": "hello@datasphere-innovation.fr",
}


# ── Base HTML template ────────────────────────────────────────────────────────

def _base_template(title: str, body_html: str, tracking_id: str | None = None) -> str:
    pixel = ""
    if tracking_id:
        pixel = f'<img src="{BRAND["url"]}/api/v1/email/track/{tracking_id}" width="1" height="1" alt="" style="display:none"/>'

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ background:#0a1628; font-family:'Segoe UI',Arial,sans-serif; color:#e2e8f0; }}
  .wrap {{ max-width:600px; margin:0 auto; padding:32px 16px; }}
  .card {{ background:#0f1f38; border:1px solid rgba(148,163,184,.12); border-radius:16px; overflow:hidden; }}
  .header {{ background:linear-gradient(135deg,#0f2847,#07111f); padding:32px; text-align:center; border-bottom:1px solid rgba(250,204,21,.15); }}
  .logo {{ font-size:1.4rem; font-weight:900; color:#facc15; letter-spacing:-.03em; }}
  .tagline {{ font-size:.78rem; color:#64748b; margin-top:4px; }}
  .body {{ padding:32px; }}
  h2 {{ font-size:1.25rem; font-weight:800; margin-bottom:16px; color:#f1f5f9; }}
  p {{ color:#94a3b8; font-size:.9rem; line-height:1.7; margin-bottom:14px; }}
  .btn {{ display:inline-block; background:#facc15; color:#07111f; padding:12px 28px; border-radius:10px; font-weight:800; font-size:.9rem; text-decoration:none; margin:20px 0; }}
  .kpi-row {{ display:flex; gap:12px; margin:20px 0; flex-wrap:wrap; }}
  .kpi {{ flex:1; min-width:120px; background:rgba(255,255,255,.04); border:1px solid rgba(148,163,184,.1); border-radius:10px; padding:14px; text-align:center; }}
  .kpi-val {{ font-size:1.4rem; font-weight:900; color:#facc15; }}
  .kpi-lbl {{ font-size:.7rem; color:#64748b; margin-top:4px; }}
  .divider {{ border:none; border-top:1px solid rgba(148,163,184,.08); margin:24px 0; }}
  .footer {{ padding:20px 32px; text-align:center; font-size:.74rem; color:#334155; border-top:1px solid rgba(148,163,184,.06); }}
  .badge {{ display:inline-block; padding:3px 10px; border-radius:99px; font-size:.72rem; font-weight:700; }}
  .badge-gold {{ background:rgba(250,204,21,.1); color:#facc15; border:1px solid rgba(250,204,21,.2); }}
  .badge-green {{ background:rgba(34,197,94,.1); color:#86efac; border:1px solid rgba(34,197,94,.2); }}
  @media(max-width:480px) {{ .body{{padding:20px}} .kpi-row{{flex-direction:column}} }}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <div class="logo">DataSphere</div>
      <div class="tagline">{BRAND["tagline"]}</div>
    </div>
    <div class="body">
      {body_html}
    </div>
    <div class="footer">
      © {datetime.now().year} {BRAND["name"]} · <a href="{BRAND["url"]}/unsubscribe" style="color:#475569">Se désabonner</a>
      · <a href="{BRAND["url"]}/privacy" style="color:#475569">Confidentialité</a>
      {pixel}
    </div>
  </div>
</div>
</body>
</html>"""


# ── Template builders ─────────────────────────────────────────────────────────

def _build_welcome(first_name: str, login_url: str) -> tuple[str, str]:
    subject = f"Bienvenue sur DataSphere, {first_name} 🚀"
    body = f"""
<h2>Bienvenue, {first_name} !</h2>
<p>Votre compte DataSphere est activé. Vous pouvez maintenant gérer vos missions de conseil, répondre aux appels d'offres et générer vos livrables avec l'aide de l'IA.</p>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-val">CRM</div><div class="kpi-lbl">Clients & opportunités</div></div>
  <div class="kpi"><div class="kpi-val">AO</div><div class="kpi-lbl">Appels d'offres IA</div></div>
  <div class="kpi"><div class="kpi-val">PDF</div><div class="kpi-lbl">Import & analyse</div></div>
</div>
<center><a class="btn" href="{login_url}">Accéder à la plateforme →</a></center>
<hr class="divider">
<p style="font-size:.82rem">Besoin d'aide ? Répondez à cet email ou contactez <a href="mailto:{BRAND["support"]}" style="color:#facc15">{BRAND["support"]}</a></p>
"""
    return subject, body


def _build_opportunity_created(first_name: str, opp_title: str, org_name: str,
                                 probability: int, dashboard_url: str) -> tuple[str, str]:
    subject = f"Opportunité créée — {opp_title}"
    body = f"""
<h2>Nouvelle opportunité enregistrée</h2>
<p>Bonjour {first_name}, l'opportunité <strong style="color:#f1f5f9">{opp_title}</strong> a été ajoutée à votre pipeline commercial.</p>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-val">{org_name[:20]}</div><div class="kpi-lbl">Organisation</div></div>
  <div class="kpi"><div class="kpi-val">{probability}%</div><div class="kpi-lbl">Probabilité</div></div>
</div>
<p>Prochaines étapes recommandées : qualifiez l'opportunité, identifiez les décideurs et suivez les signaux d'achat.</p>
<center><a class="btn" href="{dashboard_url}">Voir l'opportunité →</a></center>
"""
    return subject, body


def _build_tender_match(first_name: str, tender_title: str, score: int,
                         match_url: str) -> tuple[str, str]:
    level = "excellent" if score >= 80 else "bon" if score >= 60 else "partiel"
    badge_cls = "badge-gold" if score >= 80 else "badge-green"
    subject = f"Match AO {score}% — {tender_title[:50]}"
    body = f"""
<h2>Nouvel appel d'offres correspondant</h2>
<p>Bonjour {first_name}, un AO avec un <span class="badge {badge_cls}">match {level} à {score}%</span> a été détecté pour votre profil.</p>
<p style="font-size:1rem;color:#f1f5f9;font-weight:700;margin:16px 0">{tender_title}</p>
<p>L'analyse IA recommande de répondre à cet appel d'offres. Consultez le détail du scoring et les exigences techniques.</p>
<center><a class="btn" href="{match_url}">Analyser l'AO →</a></center>
"""
    return subject, body


def _build_deliverable_review(first_name: str, deliverable_title: str,
                               reviewer: str, review_url: str) -> tuple[str, str]:
    subject = f"Livrable en révision — {deliverable_title[:50]}"
    body = f"""
<h2>Livrable soumis pour révision</h2>
<p>Bonjour {first_name}, le livrable <strong style="color:#f1f5f9">{deliverable_title}</strong> a été soumis à la révision par <strong>{reviewer}</strong>.</p>
<p>Veuillez l'examiner et valider ou demander des corrections.</p>
<center><a class="btn" href="{review_url}">Réviser le livrable →</a></center>
"""
    return subject, body


def _build_deliverable_approved(first_name: str, deliverable_title: str,
                                  approver: str) -> tuple[str, str]:
    subject = f"✅ Livrable approuvé — {deliverable_title[:50]}"
    body = f"""
<h2>Livrable approuvé !</h2>
<p>Bonjour {first_name}, excellente nouvelle — le livrable <strong style="color:#f1f5f9">{deliverable_title}</strong> a été <span class="badge badge-green">approuvé</span> par <strong>{approver}</strong>.</p>
<p>Il est maintenant disponible en export final (PDF, DOCX, HTML).</p>
<center><a class="btn" href="{BRAND["url"]}/deliverables">Voir les livrables →</a></center>
"""
    return subject, body


def _build_relance(first_name: str, contact_name: str, opp_title: str,
                   days: int, relance_url: str) -> tuple[str, str]:
    subject = f"Relance J+{days} — {contact_name} / {opp_title[:40]}"
    body = f"""
<h2>Rappel de relance — J+{days}</h2>
<p>Bonjour {first_name}, il est temps de relancer <strong style="color:#f1f5f9">{contact_name}</strong> concernant l'opportunité <strong>{opp_title}</strong>.</p>
<p>{'Après la réunion de découverte, une relance courte suffit.' if days == 3 else 'Un appel de 10 minutes peut débloquer la décision.' if days == 7 else 'Proposez un rendez-vous de bilan ou un devis définitif.'}</p>
<center><a class="btn" href="{relance_url}">Ouvrir l'opportunité →</a></center>
"""
    return subject, body


def _build_team_invite(inviter_name: str, workspace_name: str,
                        invite_url: str) -> tuple[str, str]:
    subject = f"Invitation à rejoindre {workspace_name} sur DataSphere"
    body = f"""
<h2>Vous êtes invité(e) !</h2>
<p><strong style="color:#f1f5f9">{inviter_name}</strong> vous invite à rejoindre le workspace <strong>{workspace_name}</strong> sur DataSphere Innovation IA Platform.</p>
<p>DataSphere est la plateforme de gestion de missions et d'appels d'offres pour les consultants Data &amp; Tech.</p>
<center><a class="btn" href="{invite_url}">Accepter l'invitation →</a></center>
<hr class="divider">
<p style="font-size:.78rem;color:#475569">Si vous n'attendiez pas cette invitation, ignorez simplement cet email.</p>
"""
    return subject, body


def _build_subscription_upgrade(first_name: str, plan: str,
                                  features: list[str]) -> tuple[str, str]:
    subject = f"Votre plan DataSphere {plan} est actif 🎉"
    features_html = "".join(f"<li style='margin:4px 0;color:#94a3b8'>✓ {f}</li>" for f in features[:6])
    body = f"""
<h2>Plan {plan} activé !</h2>
<p>Bonjour {first_name}, votre abonnement <span class="badge badge-gold">{plan}</span> est maintenant actif.</p>
<ul style="margin:16px 0;padding-left:0;list-style:none">{features_html}</ul>
<center><a class="btn" href="{BRAND["url"]}">Accéder à la plateforme →</a></center>
"""
    return subject, body


# ── Template dispatcher ───────────────────────────────────────────────────────

def build_email(email_type: EmailType, params: dict[str, Any]) -> tuple[str, str]:
    """Return (subject, html_body) for the given email type."""
    p = params
    if email_type == EmailType.WELCOME:
        return _build_welcome(p["first_name"], p.get("login_url", BRAND["url"]))
    if email_type == EmailType.OPPORTUNITY_CREATED:
        return _build_opportunity_created(p["first_name"], p["opp_title"], p["org_name"],
                                           p.get("probability", 50), p.get("url", BRAND["url"]))
    if email_type == EmailType.TENDER_MATCH:
        return _build_tender_match(p["first_name"], p["tender_title"],
                                    p.get("score", 75), p.get("url", BRAND["url"]))
    if email_type == EmailType.DELIVERABLE_REVIEW:
        return _build_deliverable_review(p["first_name"], p["deliverable_title"],
                                          p.get("reviewer", "L'équipe"), p.get("url", BRAND["url"]))
    if email_type == EmailType.DELIVERABLE_APPROVED:
        return _build_deliverable_approved(p["first_name"], p["deliverable_title"],
                                            p.get("approver", "L'équipe"))
    if email_type in (EmailType.RELANCE_J3, EmailType.RELANCE_J7, EmailType.RELANCE_J14):
        days = {"relance_j3": 3, "relance_j7": 7, "relance_j14": 14}[email_type.value]
        return _build_relance(p["first_name"], p["contact_name"], p["opp_title"],
                               days, p.get("url", BRAND["url"]))
    if email_type == EmailType.TEAM_INVITE:
        return _build_team_invite(p["inviter_name"], p["workspace_name"],
                                   p.get("invite_url", BRAND["url"]))
    if email_type == EmailType.SUBSCRIPTION_UPGRADE:
        return _build_subscription_upgrade(p["first_name"], p.get("plan", "Pro"),
                                            p.get("features", []))
    raise ValueError(f"Unknown email type: {email_type}")


# ── SMTP sender ───────────────────────────────────────────────────────────────

def send_email(
    to: str,
    subject: str,
    html_body: str,
    tracking_id: str | None = None,
    dry_run: bool = False,
) -> bool:
    """
    Send an email via SMTP.
    Returns True on success, False on failure.
    In dry_run mode (or if SMTP not configured), logs the email instead.
    """
    from app.core.config import get_settings
    settings = get_settings()

    full_html = _base_template(subject, html_body, tracking_id)

    if dry_run or not settings.smtp_enabled:
        log.info(
            "[EMAIL DRY-RUN] To: %s | Subject: %s | tracking_id: %s",
            to, subject, tracking_id
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"]    = settings.smtp_from
        msg["To"]      = to
        msg["Subject"] = subject
        msg["Message-ID"] = f"<{uuid.uuid4().hex}@datasphere-innovation.fr>"
        msg.attach(MIMEText(full_html, "html", "utf-8"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_tls:
                smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, [to], msg.as_bytes())

        log.info("Email sent → %s: %s", to, subject)
        return True

    except Exception as e:
        log.error("Email send failed → %s: %s — %s", to, subject, e)
        return False


def send_typed_email(
    to: str,
    email_type: EmailType,
    params: dict[str, Any],
    dry_run: bool = False,
) -> bool:
    """Build and send a typed email."""
    subject, body = build_email(email_type, params)
    tracking_id = hashlib.sha256(f"{to}{email_type}{datetime.utcnow().date()}".encode()).hexdigest()[:16]
    return send_email(to, subject, body, tracking_id=tracking_id, dry_run=dry_run)


# ── Sequence scheduler ────────────────────────────────────────────────────────

class RelanceSequence:
    """
    Schedule relance emails at J+3, J+7, J+14 for an opportunity.
    In production, these would be stored in a task queue (Celery/APScheduler).
    For now, returns the schedule for the caller to persist.
    """

    @staticmethod
    def plan(opportunity_id: int, contact_email: str,
             params: dict[str, Any]) -> list[dict]:
        now = datetime.now(timezone.utc)
        return [
            {"opportunity_id": opportunity_id, "contact_email": contact_email,
             "email_type": EmailType.RELANCE_J3.value,
             "scheduled_at": (now + timedelta(days=3)).isoformat(), "params": params},
            {"opportunity_id": opportunity_id, "contact_email": contact_email,
             "email_type": EmailType.RELANCE_J7.value,
             "scheduled_at": (now + timedelta(days=7)).isoformat(), "params": params},
            {"opportunity_id": opportunity_id, "contact_email": contact_email,
             "email_type": EmailType.RELANCE_J14.value,
             "scheduled_at": (now + timedelta(days=14)).isoformat(), "params": params},
        ]


# ── Workflow notifications ─────────────────────────────────────────────────────

def notify_approval_required(
    step_label: str,
    tender_title: str,
    tender_id: int,
    step_id: int,
    frontend_url: str = "",
) -> bool:
    """
    Send email when a workflow step requires human approval.
    Returns True if sent, False if SMTP not configured (dry-run).
    """
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.smtp_configured:
        import logging
        logging.getLogger("datasphere.email").info(
            "[DRY-RUN] Approval needed: %s — %s (step_id=%d)", tender_title, step_label, step_id
        )
        return False

    approve_url = f"{frontend_url}/tenders" if frontend_url else "/tenders"

    subject = f"⏳ Validation requise : {step_label} — {tender_title[:60]}"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#060e18;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#facc15;padding:20px 28px">
        <h1 style="margin:0;color:#060e18;font-size:1.2rem">⚡ DataSphere — Validation requise</h1>
      </div>
      <div style="padding:28px">
        <p style="color:#94a3b8;margin:0 0 16px">Une étape du workflow nécessite votre validation :</p>
        <div style="background:#0c1425;border:1px solid rgba(250,204,21,.2);border-radius:10px;padding:20px;margin-bottom:24px">
          <div style="font-size:.8rem;color:#475569;margin-bottom:4px">APPEL D'OFFRES</div>
          <div style="font-size:1.1rem;font-weight:700;color:#e2e8f0;margin-bottom:12px">{tender_title}</div>
          <div style="font-size:.8rem;color:#475569;margin-bottom:4px">ÉTAPE EN ATTENTE</div>
          <div style="font-size:1rem;font-weight:600;color:#facc15">{step_label}</div>
        </div>
        <a href="{approve_url}"
           style="display:inline-block;padding:12px 24px;background:#facc15;color:#060e18;border-radius:9px;text-decoration:none;font-weight:800;font-size:.9rem">
          Valider maintenant →
        </a>
        <p style="color:#334155;font-size:.75rem;margin-top:24px">
          DataSphere Innovation · <a href="{approve_url}" style="color:#475569">Ouvrir la plateforme</a>
        </p>
      </div>
    </div>
    """
    return send_typed_email(
        to_email=settings.smtp_from,
        subject=subject,
        html_body=html,
        plain_body=f"Validation requise : {step_label} — {tender_title}\nOuvrir : {approve_url}",
    )


def notify_workflow_completed(
    tender_title: str,
    tender_id: int,
    deliverable_id: int | None,
    frontend_url: str = "",
) -> bool:
    """Send email when the full workflow is completed and deliverable is ready."""
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.smtp_configured:
        import logging
        logging.getLogger("datasphere.email").info(
            "[DRY-RUN] Workflow completed: %s deliverable=%s", tender_title, deliverable_id
        )
        return False

    url = f"{frontend_url}/deliverables" if frontend_url else "/deliverables"
    subject = f"✅ Workflow terminé — {tender_title[:60]}"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#060e18;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#22c55e;padding:20px 28px">
        <h1 style="margin:0;color:white;font-size:1.2rem">✅ DataSphere — Workflow terminé</h1>
      </div>
      <div style="padding:28px">
        <p style="color:#94a3b8;margin:0 0 16px">Le workflow IA est terminé pour :</p>
        <div style="background:#0c1425;border:1px solid rgba(34,197,94,.2);border-radius:10px;padding:20px;margin-bottom:24px">
          <div style="font-size:1.1rem;font-weight:700;color:#e2e8f0;margin-bottom:8px">{tender_title}</div>
          {"<div style='color:#86efac;font-size:.9rem'>📄 Mémoire technique généré — Livrable #" + str(deliverable_id) + "</div>" if deliverable_id else ""}
        </div>
        <a href="{url}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:white;border-radius:9px;text-decoration:none;font-weight:800;font-size:.9rem">
          Voir le livrable →
        </a>
      </div>
    </div>
    """
    return send_typed_email(
        to_email=settings.smtp_from,
        subject=subject,
        html_body=html,
        plain_body=f"Workflow terminé : {tender_title}\nLivrable : {url}",
    )
