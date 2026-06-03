"""
Email Preview Service — generates a client-ready HTML email from an approved deliverable.
No SMTP required: the preview is displayed in-app and can be copied to any email client.
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.deliverable import Deliverable
from app.models.opportunity import Opportunity
from app.models.organization import Organization
from app.models.tender import Tender
from app.schemas.commercial import EmailPreview

_TYPE_LABELS: dict[str, str] = {
    "note_cadrage": "Note de cadrage",
    "memoire_technique": "Mémoire technique",
    "plan_action": "Plan d'action",
    "synthese_contexte": "Synthèse de contexte",
    "rapport_conformite": "Rapport de conformité",
    "offre_commerciale": "Offre commerciale",
    "bilan_mission": "Bilan de mission",
}


def _resolve_context(db: Session, d: Deliverable) -> dict:
    ctx = {
        "org_name": "Client",
        "opp_title": "",
        "tender_ref": "",
        "buyer_name": "",
        "contact_first_name": "",
    }
    if d.tender_id:
        tender = db.query(Tender).filter(Tender.id == d.tender_id).first()
        if tender:
            ctx["tender_ref"] = tender.reference or ""
            ctx["buyer_name"] = tender.buyer_name or ""
    if d.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == d.opportunity_id).first()
        if opp:
            ctx["opp_title"] = opp.title or ""
            if opp.organization_id:
                org = db.query(Organization).filter(Organization.id == opp.organization_id).first()
                if org:
                    ctx["org_name"] = org.name
    return ctx


def generate_email_preview(db: Session, deliverable_id: int) -> EmailPreview:
    d = db.query(Deliverable).filter(Deliverable.id == deliverable_id).first()
    if not d:
        raise ValueError(f"Deliverable {deliverable_id} not found")

    ctx = _resolve_context(db, d)
    type_label = _TYPE_LABELS.get(d.deliverable_type, d.deliverable_type)
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    org = ctx["org_name"]
    ref = ctx["tender_ref"]
    ref_str = f" — Réf. {ref}" if ref else ""

    subject = f"{type_label} DataSphere Innovation{ref_str} — {d.title}"

    text_body = f"""\
Madame, Monsieur,

Veuillez trouver ci-joint notre {type_label.lower()}{f' concernant l\'appel d\'offres {ref}' if ref else ''}.

Ce document a été préparé par l'équipe DataSphere Innovation et validé en interne avant transmission.

**Document joint :** {d.title}
**Type :** {type_label}
**Statut :** Approuvé ✓
**Date :** {today}
**Version :** {d.version}
{f"**Audience :** {d.audience}" if d.audience else ""}

{f'**Résumé :** {d.summary}' if d.summary else ''}

Nous restons à votre disposition pour toute question ou demande de complément d'information.

Bien cordialement,

DataSphere Innovation
contact@datasphere-innovation.fr | +33 (0)1 XX XX XX XX
https://www.datasphere-innovation.fr
"""

    html_body = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Segoe UI',system-ui,sans-serif; background:#f1f5f9; padding:24px; }}
  .email-wrapper {{ max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }}
  .header {{ background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%); padding:32px 36px; }}
  .brand {{ color:#facc15; font-size:12px; font-weight:800; letter-spacing:.15em; text-transform:uppercase; margin-bottom:8px; }}
  .header h1 {{ color:#ffffff; font-size:22px; font-weight:700; line-height:1.3; }}
  .body {{ padding:32px 36px; }}
  .greeting {{ color:#374151; font-size:15px; margin-bottom:20px; }}
  .intro {{ color:#6b7280; font-size:14px; line-height:1.7; margin-bottom:24px; }}
  .doc-card {{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px 22px; margin-bottom:24px; }}
  .doc-card h3 {{ color:#1e40af; font-size:15px; font-weight:700; margin-bottom:14px; }}
  .doc-field {{ display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }}
  .doc-field:last-child {{ border-bottom:none; }}
  .doc-field .label {{ color:#6b7280; }}
  .doc-field .value {{ color:#111827; font-weight:600; }}
  .approved-badge {{ display:inline-flex; align-items:center; gap:6px; background:#dcfce7; color:#166534; padding:3px 10px; border-radius:99px; font-size:12px; font-weight:700; border:1px solid #bbf7d0; }}
  .summary-block {{ background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:14px 16px; margin-bottom:24px; font-size:13px; color:#1e40af; line-height:1.6; }}
  .cta {{ background:#1e40af; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px; display:inline-block; }}
  .footer {{ background:#f8fafc; border-top:1px solid #e2e8f0; padding:20px 36px; }}
  .footer p {{ color:#9ca3af; font-size:12px; line-height:1.6; }}
  .signature {{ margin-top:24px; padding-top:20px; border-top:2px solid #f3f4f6; font-size:13px; color:#374151; }}
  .sig-name {{ font-weight:700; color:#0f172a; font-size:14px; }}
  .sig-role {{ color:#6b7280; font-size:12px; margin-top:2px; }}
  .sig-contact {{ color:#6b7280; font-size:12px; margin-top:6px; }}
</style>
</head>
<body>
<div class="email-wrapper">
  <div class="header">
    <div class="brand">DataSphere Innovation</div>
    <h1>{type_label} — {org}</h1>
  </div>
  <div class="body">
    <p class="greeting">Madame, Monsieur{f', {ctx["contact_first_name"]}' if ctx.get("contact_first_name") else ''},</p>
    <p class="intro">
      Veuillez trouver ci-joint notre {type_label.lower()}{f" concernant l'appel d'offres <strong>{ref}</strong>" if ref else ''}.
      Ce document a été préparé par l'équipe DataSphere Innovation et validé en interne avant transmission.
    </p>

    <div class="doc-card">
      <h3>📄 Document joint</h3>
      <div class="doc-field"><span class="label">Titre</span><span class="value">{d.title}</span></div>
      <div class="doc-field"><span class="label">Type</span><span class="value">{type_label}</span></div>
      <div class="doc-field"><span class="label">Statut</span><span class="value"><span class="approved-badge">✓ Approuvé</span></span></div>
      <div class="doc-field"><span class="label">Date</span><span class="value">{today}</span></div>
      <div class="doc-field"><span class="label">Version</span><span class="value">v{d.version}</span></div>
      {f'<div class="doc-field"><span class="label">Audience</span><span class="value">{d.audience}</span></div>' if d.audience else ''}
      {f'<div class="doc-field"><span class="label">Référence AO</span><span class="value">{ref}</span></div>' if ref else ''}
    </div>

    {f'<div class="summary-block"><strong>📋 Résumé :</strong> {d.summary}</div>' if d.summary else ''}

    <p style="color:#6b7280;font-size:14px;line-height:1.7;margin-bottom:24px;">
      Nous restons à votre disposition pour toute question ou demande de complément d'information.
      N'hésitez pas à nous contacter pour organiser une présentation des conclusions.
    </p>

    <div class="signature">
      <div class="sig-name">Sekouna KABA</div>
      <div class="sig-role">Co-fondateur & Lead Data Architect — DataSphere Innovation</div>
      <div class="sig-contact">contact@datasphere-innovation.fr | +33 (0)1 XX XX XX XX</div>
      <div class="sig-contact">https://www.datasphere-innovation.fr</div>
    </div>
  </div>
  <div class="footer">
    <p>DataSphere Innovation · Cabinet de conseil Data, IA et transformation numérique</p>
    <p>Ce message est confidentiel et destiné uniquement à son destinataire. Toute diffusion non autorisée est interdite.</p>
  </div>
</div>
</body>
</html>"""

    return EmailPreview(
        deliverable_id=deliverable_id,
        subject=subject,
        to_name=org,
        to_email=f"contact@{org.lower().replace(' ', '-').replace('/', '-')}.com",
        from_name="Sekouna KABA — DataSphere Innovation",
        html_body=html_body,
        text_body=text_body,
        attachments_note=f"Pièce jointe : {d.title}.pdf (exporté depuis la plateforme)",
    )
