"""
Rapport hebdomadaire — DataSphere Innovation

Envoyé chaque lundi matin à 8h00 (Paris) aux admins et managers.

Contenu :
  📊 Pipeline : AOs détectés, décisions Go/No-Go
  📝 Livrables : générés, approuvés cette semaine
  🤖 Agents IA : actions exécutées, taux de succès
  ⚡ Providers LLM : utilisation, provider principal
  📅 À venir : AOs avec deadline dans les 14 prochains jours
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone

log = logging.getLogger("datasphere.weekly_report")


def generate_weekly_report_html(db, week_start: datetime | None = None) -> str:
    """Generate the full HTML report for the past week."""
    from app.models.tender import Tender
    from app.models.deliverable import Deliverable
    from app.models.workflow import WorkflowInstance, WorkflowStep
    from app.models.agent import AgentAction

    if week_start is None:
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=7)

    # ── Collect stats ─────────────────────────────────────────────────────────

    # AOs this week
    tenders_this_week = db.query(Tender).filter(
        Tender.created_at >= week_start
    ).all()
    tenders_go    = [t for t in tenders_this_week if t.status == "go"]
    tenders_no_go = [t for t in tenders_this_week if t.status == "no_go"]

    # AOs with upcoming deadlines (next 14 days)
    upcoming_deadline = datetime.now(timezone.utc) + timedelta(days=14)
    upcoming_tenders  = db.query(Tender).filter(
        Tender.submission_deadline != None,
        Tender.submission_deadline <= upcoming_deadline,
        Tender.submission_deadline >= datetime.now(timezone.utc),
        Tender.status.in_(["go", "draft"]),
    ).order_by(Tender.submission_deadline).limit(5).all()

    # Livrables this week
    deliverables_total    = db.query(Deliverable).filter(
        Deliverable.created_at >= week_start).count()
    deliverables_approved = db.query(Deliverable).filter(
        Deliverable.created_at >= week_start,
        Deliverable.status == "approved"
    ).count()

    # Workflow steps done this week
    steps_done = db.query(WorkflowStep).filter(
        WorkflowStep.updated_at >= week_start,
        WorkflowStep.status == "done"
    ).count()

    # Agent actions this week
    agent_actions_total = db.query(AgentAction).filter(
        AgentAction.created_at >= week_start
    ).count()
    agent_actions_done = db.query(AgentAction).filter(
        AgentAction.created_at >= week_start,
        AgentAction.status == "done"
    ).count()

    success_rate = (
        round(agent_actions_done / agent_actions_total * 100)
        if agent_actions_total > 0 else 0
    )

    # Provider used this week
    from app.services.llm_service import provider_label
    current_provider = provider_label()

    week_label = week_start.strftime("%d/%m/%Y")

    # ── Build HTML ────────────────────────────────────────────────────────────

    upcoming_html = ""
    for t in upcoming_tenders:
        days_left = (t.submission_deadline - datetime.now(timezone.utc)).days
        badge = "🔴" if days_left <= 3 else "🟠" if days_left <= 7 else "🟡"
        upcoming_html += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">{badge} {t.title[:50]}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">{t.buyer_name or '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:{'#dc2626' if days_left<=3 else '#d97706'}">{days_left}j</td>
        </tr>"""

    if not upcoming_html:
        upcoming_html = '<tr><td colspan="3" style="padding:12px;color:#64748b;text-align:center">Aucun AO avec deadline dans les 14 prochains jours</td></tr>'

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:640px;margin:0 auto">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px 16px 0 0;padding:32px;color:white">
      <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">
        DataSphere Innovation
      </div>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800">
        📊 Rapport hebdomadaire
      </h1>
      <p style="margin:0;color:#94a3b8;font-size:14px">
        Semaine du {week_label} — généré le {datetime.now().strftime("%d/%m/%Y à %H:%M")}
      </p>
    </div>

    <!-- KPIs -->
    <div style="background:white;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:24px">
      <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#0f172a">Cette semaine</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px">
          <div style="font-size:28px;font-weight:900;color:#16a34a">{len(tenders_this_week)}</div>
          <div style="font-size:12px;color:#15803d;margin-top:4px">AOs détectés</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">GO: {len(tenders_go)} · No-Go: {len(tenders_no_go)}</div>
        </div>

        <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:16px">
          <div style="font-size:28px;font-weight:900;color:#1d4ed8">{deliverables_total}</div>
          <div style="font-size:12px;color:#1e40af;margin-top:4px">Livrables créés</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">Approuvés: {deliverables_approved}</div>
        </div>

        <div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:16px">
          <div style="font-size:28px;font-weight:900;color:#ca8a04">{steps_done}</div>
          <div style="font-size:12px;color:#a16207;margin-top:4px">Étapes workflow</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">Validées automatiquement</div>
        </div>

        <div style="background:#fdf4ff;border:1px solid #e879f9;border-radius:12px;padding:16px">
          <div style="font-size:28px;font-weight:900;color:#a21caf">{success_rate}%</div>
          <div style="font-size:12px;color:#86198f;margin-top:4px">Succès agents IA</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">{agent_actions_done}/{agent_actions_total} actions · {current_provider}</div>
        </div>

      </div>
    </div>

    <!-- Upcoming deadlines -->
    <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:24px">
      <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#0f172a">
        📅 Deadlines dans les 14 prochains jours
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px">AO</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px">Acheteur</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px">J restants</th>
          </tr>
        </thead>
        <tbody>{upcoming_html}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:0 0 16px 16px;padding:24px;text-align:center">
      <a href="https://datasphere-frontend-n1mb.onrender.com"
         style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);color:#0f172a;
                font-weight:800;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">
        Ouvrir la plateforme →
      </a>
      <p style="margin:12px 0 0;color:#475569;font-size:12px">
        Vous recevez ce rapport car vous êtes admin ou manager sur DataSphere Innovation.
      </p>
    </div>

  </div>
</body>
</html>"""


def send_weekly_report(db) -> dict:
    """Generate and send the weekly report to all admins and managers."""
    from app.models.user import User
    from app.services.email_service import send_html_email

    # Get recipients
    recipients = db.query(User).filter(
        User.is_active == True,
        User.role.in_(["admin", "manager"]),
    ).all()

    if not recipients:
        log.warning("No recipients for weekly report")
        return {"sent": 0, "error": "No recipients"}

    html = generate_weekly_report_html(db)
    subject = f"📊 Rapport hebdomadaire DataSphere — {datetime.now().strftime('%d/%m/%Y')}"

    sent = 0
    errors = []
    for user in recipients:
        try:
            send_html_email(to=user.email, subject=subject, html=html)
            sent += 1
        except Exception as e:
            errors.append(f"{user.email}: {e}")
            log.error(f"Failed to send weekly report to {user.email}: {e}")

    log.info(f"Weekly report sent to {sent}/{len(recipients)} recipients")
    return {"sent": sent, "total": len(recipients), "errors": errors}
