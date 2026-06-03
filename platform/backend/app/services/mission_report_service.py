"""
Mission Report Service — generates a complete professional report for a mission.
Aggregates: tender context, Go/No-Go summary, requirements, agent actions,
deliverables (approved). Returns print-ready HTML.
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.agent import AgentAction, AgentAssignment, AgentProfile
from app.models.deliverable import Deliverable
from app.models.opportunity import Opportunity
from app.models.organization import Organization
from app.models.tender import Tender, TenderRequirement
from app.models.tender_governance import ComplianceMatrixItem, GoNoGoCriterion


def _md_to_html_simple(md: str) -> str:
    """Minimal Markdown → HTML for report embedding."""
    import re
    lines = md.split("\n")
    out = []
    in_ul = False
    for line in lines:
        if line.startswith("### "):
            if in_ul: out.append("</ul>"); in_ul = False
            out.append(f"<h4>{line[4:]}</h4>")
        elif line.startswith("## "):
            if in_ul: out.append("</ul>"); in_ul = False
            out.append(f"<h3>{line[3:]}</h3>")
        elif line.startswith("# "):
            if in_ul: out.append("</ul>"); in_ul = False
            out.append(f"<h2>{line[2:]}</h2>")
        elif line.startswith("- ") or line.startswith("* "):
            if not in_ul: out.append("<ul>"); in_ul = True
            text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", line[2:])
            out.append(f"<li>{text}</li>")
        elif line.strip() == "":
            if in_ul: out.append("</ul>"); in_ul = False
            out.append("<br>")
        else:
            if in_ul: out.append("</ul>"); in_ul = False
            text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", line)
            out.append(f"<p>{text}</p>")
    if in_ul: out.append("</ul>")
    return "\n".join(out)


def generate_mission_report(db: Session, tender_id: int) -> str:
    """Return full print-ready HTML for a mission report."""
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise ValueError(f"Tender {tender_id} not found")

    # Context
    opportunity = (
        db.query(Opportunity).filter(Opportunity.id == tender.opportunity_id).first()
        if tender.opportunity_id else None
    )
    org = None
    if opportunity and opportunity.organization_id:
        org = db.query(Organization).filter(Organization.id == opportunity.organization_id).first()

    requirements = db.query(TenderRequirement).filter(TenderRequirement.tender_id == tender_id).all()
    criteria = db.query(GoNoGoCriterion).filter(GoNoGoCriterion.tender_id == tender_id).all()
    compliance = db.query(ComplianceMatrixItem).filter(ComplianceMatrixItem.tender_id == tender_id).all()

    # Assignments linked to tender
    assignments = db.query(AgentAssignment).filter(AgentAssignment.tender_id == tender_id).all()
    all_actions = []
    for a in assignments:
        agent = db.query(AgentProfile).filter(AgentProfile.id == a.agent_id).first()
        actions = db.query(AgentAction).filter(AgentAction.assignment_id == a.id).all()
        all_actions.append((agent, a, actions))

    # Approved deliverables
    deliverables = (
        db.query(Deliverable)
        .filter(Deliverable.tender_id == tender_id, Deliverable.status == "approved")
        .order_by(Deliverable.approved_at.desc())
        .all()
    )

    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    score_total = sum((c.score or 0) * (c.weight or 1) for c in criteria)
    max_score = sum(10 * (c.weight or 1) for c in criteria) or 1
    score_pct = round(score_total / max_score * 100, 1)

    # Status colors
    decision_color = {"Go": "#166534", "No-Go": "#991b1b"}.get(tender.go_no_go_decision or "", "#92400e")
    decision_bg = {"Go": "#dcfce7", "No-Go": "#fee2e2"}.get(tender.go_no_go_decision or "", "#fef3c7")

    # Build HTML
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport de Mission — {tender.reference or tender.title}</title>
<style>
:root{{--primary:#1e3a5f;--accent:#facc15;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;}}
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.65;color:var(--text);background:#fff;}}
.page{{max-width:900px;margin:0 auto;padding:48px 56px;}}
/* Header */
.doc-header{{border-bottom:4px solid var(--primary);padding-bottom:28px;margin-bottom:36px;}}
.brand{{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}}
.doc-title{{font-size:28px;font-weight:800;color:var(--primary);margin-bottom:10px;}}
.doc-meta{{display:flex;flex-wrap:wrap;gap:20px;font-size:12px;color:var(--muted);}}
.badge{{display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;}}
/* Sections */
.section{{margin-bottom:36px;}}
.section-title{{font-size:16px;font-weight:800;color:var(--primary);border-bottom:2px solid var(--accent);padding-bottom:8px;margin-bottom:16px;display:flex;align-items:center;gap:10px;}}
.section-num{{background:var(--primary);color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;}}
/* Stat cards */
.stat-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}}
.stat-card{{background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:14px 16px;}}
.stat-card .value{{font-size:22px;font-weight:800;color:var(--primary);}}
.stat-card .label{{font-size:11px;color:var(--muted);margin-top:4px;}}
/* Score bar */
.score-bar{{height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:6px 0 3px;}}
.score-fill{{height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:99px;}}
/* Tables */
table{{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0;}}
th{{background:var(--primary);color:#fff;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;}}
td{{padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:top;}}
tr:nth-child(even) td{{background:#f8fafc;}}
/* Deliverable */
.deliverable-card{{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:10px 0;}}
.deliverable-card h4{{color:#166534;font-size:14px;margin-bottom:6px;}}
/* Content blocks */
h2{{font-size:16px;font-weight:700;color:var(--primary);margin:18px 0 8px;}}
h3{{font-size:14px;font-weight:700;margin:14px 0 6px;color:#1e293b;}}
h4{{font-size:13px;font-weight:600;margin:10px 0 5px;color:#334155;}}
p{{margin-bottom:8px;color:#334155;}}
ul{{padding-left:18px;margin-bottom:8px;}}
li{{margin-bottom:3px;}}
strong{{font-weight:700;}}
/* Footer */
.doc-footer{{margin-top:48px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:11px;color:var(--muted);}}
/* Print / toolbar */
.toolbar{{position:fixed;top:0;left:0;right:0;background:#0f172a;padding:10px 24px;display:flex;gap:16px;align-items:center;z-index:999;}}
.btn-print{{margin-left:auto;padding:7px 18px;border-radius:8px;border:none;cursor:pointer;background:var(--accent);color:#0f172a;font-weight:700;font-size:12px;}}
.spacer{{height:44px;}}
@media print{{.toolbar,.spacer{{display:none;}} .page{{padding:15mm 18mm;max-width:100%;}} h2{{page-break-after:avoid;}} table{{page-break-inside:avoid;}}}}
</style>
</head>
<body>
<div class="toolbar">
  <span style="color:#facc15;font-weight:800;font-size:12px;letter-spacing:.1em;">DATASPHERE INNOVATION</span>
  <span style="color:#64748b;font-size:12px;">Rapport de mission — {tender.reference or tender.title}</span>
  <button class="btn-print" onclick="window.print()">🖨 Imprimer / PDF</button>
</div>
<div class="spacer"></div>
<div class="page">

<!-- HEADER -->
<div class="doc-header">
  <div class="brand">DataSphere Innovation — Rapport de Mission Confidentiel</div>
  <div class="doc-title">{tender.title}</div>
  <div class="doc-meta">
    <span>📋 Réf. {tender.reference or 'N/A'}</span>
    <span>🏢 {org.name if org else tender.buyer_name or '?'}</span>
    <span>📅 Généré le {today}</span>
    <span><span class="badge" style="background:{decision_bg};color:{decision_color};">{tender.go_no_go_decision or 'Non qualifié'}</span></span>
    {f'<span>🎯 Score : {score_pct}%</span>' if criteria else ''}
  </div>
</div>

<!-- KPI CARDS -->
<div class="stat-grid">
  <div class="stat-card">
    <div class="value">{len(requirements)}</div>
    <div class="label">Exigences analysées</div>
  </div>
  <div class="stat-card">
    <div class="value">{len(compliance)}</div>
    <div class="label">Items conformité</div>
  </div>
  <div class="stat-card">
    <div class="value">{sum(len(a[2]) for a in all_actions)}</div>
    <div class="label">Actions agents</div>
  </div>
  <div class="stat-card">
    <div class="value">{len(deliverables)}</div>
    <div class="label">Livrables approuvés</div>
  </div>
</div>

{'<!-- SCORE BAR --><div class="section"><div class="section-title"><span class="section-num">0</span>Score Go/No-Go</div><div style="max-width:400px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Score pondéré</span><strong>' + str(score_pct) + '%</strong></div><div class="score-bar"><div class="score-fill" style="width:' + str(score_pct) + '%;"></div></div></div></div>' if criteria else ''}

<!-- CONTEXT -->
<div class="section">
  <div class="section-title"><span class="section-num">1</span>Contexte de la mission</div>
  {'<p><strong>Opportunité :</strong> ' + opportunity.title + '</p><p><strong>Pays :</strong> ' + (opportunity.country or '?') + ' · <strong>Secteur :</strong> ' + (opportunity.sector or '?') + '</p>' if opportunity else ''}
  {'<p><strong>Acheteur :</strong> ' + (tender.buyer_name or '?') + '</p>'}
  {'<p><strong>Résumé :</strong> ' + (tender.summary or 'Non renseigné.') + '</p>'}
  {'<p><strong>Date limite :</strong> ' + tender.submission_deadline.strftime('%d/%m/%Y') + '</p>' if tender.submission_deadline else ''}
</div>

<!-- REQUIREMENTS -->
{_requirements_section(requirements) if requirements else ''}

<!-- COMPLIANCE -->
{_compliance_section(compliance) if compliance else ''}

<!-- AGENT ACTIONS -->
{_actions_section(all_actions) if all_actions else ''}

<!-- DELIVERABLES -->
{_deliverables_section(deliverables) if deliverables else ''}

<div class="doc-footer">
  <span>DataSphere Innovation · Rapport confidentiel · {today}</span>
  <span>Généré automatiquement par la plateforme IA</span>
</div>
</div>
</body>
</html>"""

    return html


def _requirements_section(requirements: list) -> str:
    rows = ""
    for r in requirements:
        badge_color = {"Obligatoire": "#fee2e2", "Souhaitable": "#fef9c3"}.get(r.requirement_type or "", "#f1f5f9")
        text_color = {"Obligatoire": "#991b1b", "Souhaitable": "#92400e"}.get(r.requirement_type or "", "#334155")
        rows += f"""<tr>
          <td style="font-weight:700;color:#1e3a5f;">{r.requirement_code or '-'}</td>
          <td><span class="badge" style="background:{badge_color};color:{text_color};">{r.requirement_type or 'N/A'}</span></td>
          <td>{r.description[:200] if r.description else ''}</td>
          <td><span style="font-size:11px;color:#64748b;">{r.status or 'à traiter'}</span></td>
        </tr>"""
    return f"""<div class="section">
  <div class="section-title"><span class="section-num">2</span>Exigences de l'appel d'offres</div>
  <table><thead><tr><th>Réf.</th><th>Type</th><th>Description</th><th>Statut</th></tr></thead>
  <tbody>{rows}</tbody></table>
</div>"""


def _compliance_section(compliance: list) -> str:
    conf = sum(1 for c in compliance if c.compliance_status == "conforme")
    pct = round(conf / len(compliance) * 100) if compliance else 0
    rows = ""
    for c in compliance:
        status_colors = {
            "conforme": ("#dcfce7", "#166534"),
            "partiel": ("#fef9c3", "#92400e"),
            "non_conforme": ("#fee2e2", "#991b1b"),
        }
        bg, fg = status_colors.get(c.compliance_status or "", ("#f1f5f9", "#64748b"))
        rows += f"""<tr>
          <td style="font-weight:600;">{c.requirement_code or '-'}</td>
          <td>{(c.requirement_summary or '')[:80]}</td>
          <td><span class="badge" style="background:{bg};color:{fg};">{c.compliance_status or '?'}</span></td>
          <td style="font-size:11px;color:#64748b;">{(c.evidence or '')[:60]}</td>
        </tr>"""
    return f"""<div class="section">
  <div class="section-title"><span class="section-num">3</span>Matrice de conformité ({pct}% conforme)</div>
  <table><thead><tr><th>Réf.</th><th>Exigence</th><th>Statut</th><th>Preuve</th></tr></thead>
  <tbody>{rows}</tbody></table>
</div>"""


def _actions_section(all_actions: list) -> str:
    content = ""
    for agent, assignment, actions in all_actions:
        if not actions:
            continue
        agent_name = agent.name if agent else f"Agent #{assignment.agent_id}"
        done = sum(1 for a in actions if a.status == "done")
        content += f"""<div style="margin-bottom:16px;">
        <h3>👤 {agent_name} — {assignment.objective[:80]}</h3>
        <p style="font-size:12px;color:#64748b;">{done}/{len(actions)} actions terminées</p>"""
        for action in actions[:5]:
            if action.result_summary:
                content += f"""<div style="padding:8px 12px;background:#f8fafc;border-left:3px solid #1e3a5f;margin:6px 0;font-size:12px;">
            <strong>{action.action_type}</strong> — {(action.result_summary or '')[:150]}
          </div>"""
        content += "</div>"

    return f"""<div class="section">
  <div class="section-title"><span class="section-num">4</span>Actions des agents</div>
  {content}
</div>""" if content else ""


def _deliverables_section(deliverables: list) -> str:
    from app.api.v1.endpoints.export import _TYPE_LABELS
    cards = ""
    for d in deliverables:
        type_label = _TYPE_LABELS.get(d.deliverable_type, d.deliverable_type)
        approved_on = d.approved_at.strftime('%d/%m/%Y') if d.approved_at else '?'
        cards += f"""<div class="deliverable-card">
      <h4>✅ {d.title}</h4>
      <p style="font-size:12px;color:#64748b;">{type_label} · v{d.version} · Approuvé le {approved_on} par {d.approved_by or '?'}</p>
      {f'<p style="font-size:12px;margin-top:6px;">{d.summary}</p>' if d.summary else ''}
    </div>"""
    return f"""<div class="section">
  <div class="section-title"><span class="section-num">5</span>Livrables approuvés</div>
  {cards}
</div>"""
