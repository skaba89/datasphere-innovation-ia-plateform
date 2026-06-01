"""
Export endpoint — Download deliverables as Markdown or print-ready HTML.
No extra dependencies required (no PDF library).
The HTML export uses @media print CSS so the browser can save as PDF directly.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.deliverable import get_deliverable
from app.db.session import get_db

router = APIRouter(
    prefix="/deliverables",
    tags=["export"],
    dependencies=[Depends(get_current_user)],
)

# ── Deliverable type labels ──────────────────────────────────────────────────
_TYPE_LABELS: dict[str, str] = {
    "note_cadrage": "Note de cadrage",
    "memoire_technique": "Mémoire technique",
    "plan_action": "Plan d'action",
    "synthese_contexte": "Synthèse de contexte",
    "rapport_conformite": "Rapport de conformité",
    "offre_commerciale": "Offre commerciale",
    "bilan_mission": "Bilan de mission",
}

_STATUS_LABELS: dict[str, str] = {
    "draft": "Brouillon",
    "in_review": "En révision",
    "approved": "Approuvé ✓",
}


# ── Markdown renderer (basic: headers, bold, lists, code) ────────────────────
def _md_to_html(md: str) -> str:
    """Minimal Markdown → HTML converter (no external library)."""
    import re
    lines = md.split("\n")
    html_lines = []
    in_ul = False
    in_code = False

    for line in lines:
        # Code fence
        if line.startswith("```"):
            if in_code:
                html_lines.append("</code></pre>")
                in_code = False
            else:
                if in_ul:
                    html_lines.append("</ul>")
                    in_ul = False
                html_lines.append("<pre><code>")
                in_code = True
            continue

        if in_code:
            html_lines.append(line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            continue

        # Close list if needed
        if not line.startswith("- ") and not line.startswith("* ") and in_ul:
            html_lines.append("</ul>")
            in_ul = False

        # Headers
        if line.startswith("#### "):
            html_lines.append(f"<h4>{_inline(line[5:])}</h4>")
        elif line.startswith("### "):
            html_lines.append(f"<h3>{_inline(line[4:])}</h3>")
        elif line.startswith("## "):
            html_lines.append(f"<h2>{_inline(line[3:])}</h2>")
        elif line.startswith("# "):
            html_lines.append(f"<h1>{_inline(line[2:])}</h1>")
        # Unordered list
        elif line.startswith("- ") or line.startswith("* "):
            if not in_ul:
                html_lines.append("<ul>")
                in_ul = True
            html_lines.append(f"<li>{_inline(line[2:])}</li>")
        # Horizontal rule
        elif line.strip() in ("---", "***", "___"):
            html_lines.append("<hr>")
        # Empty line
        elif line.strip() == "":
            html_lines.append("<br>")
        # Paragraph
        else:
            html_lines.append(f"<p>{_inline(line)}</p>")

    if in_ul:
        html_lines.append("</ul>")
    if in_code:
        html_lines.append("</code></pre>")

    return "\n".join(html_lines)


def _inline(text: str) -> str:
    """Process inline markdown: **bold**, *italic*, `code`, links."""
    import re
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', text)
    return text


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{deliverable_id}/export/markdown", response_class=PlainTextResponse)
def export_markdown(deliverable_id: int, db: Session = Depends(get_db)):
    """Download deliverable content as a Markdown file."""
    d = get_deliverable(db, deliverable_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    filename = f"{d.deliverable_type}_{d.id}.md"
    header = f"""# {d.title}

**Type :** {_TYPE_LABELS.get(d.deliverable_type, d.deliverable_type)}
**Statut :** {_STATUS_LABELS.get(d.status, d.status)}
**Version :** {d.version}
**Langue :** {d.language}
**Généré par :** {d.generated_by or "DataSphere Platform"}
**Exporté le :** {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC

---

"""
    content = header + (d.content_markdown or "")
    return PlainTextResponse(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{deliverable_id}/export/html", response_class=HTMLResponse)
def export_html(deliverable_id: int, db: Session = Depends(get_db)):
    """
    Return a print-ready HTML page for the deliverable.
    Open in browser → Ctrl+P → Save as PDF.
    """
    d = get_deliverable(db, deliverable_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    type_label = _TYPE_LABELS.get(d.deliverable_type, d.deliverable_type)
    status_label = _STATUS_LABELS.get(d.status, d.status)
    exported_at = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
    body_html = _md_to_html(d.content_markdown or "")
    approved_block = ""
    if d.status == "approved":
        approved_block = f"""
        <div class="approval-banner">
            ✅ Livrable approuvé par <strong>{d.approved_by or "?"}</strong>
            {f"le {d.approved_at.strftime('%d/%m/%Y') if d.approved_at else ''}" }
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{d.title} — DataSphere</title>
<style>
  :root {{
    --primary: #1e40af;
    --accent: #facc15;
    --text: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --bg: #f8fafc;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text);
    background: white;
    padding: 0;
  }}
  .page {{
    max-width: 820px;
    margin: 0 auto;
    padding: 48px 56px;
  }}
  /* Header */
  .doc-header {{
    border-bottom: 3px solid var(--primary);
    padding-bottom: 24px;
    margin-bottom: 32px;
  }}
  .doc-brand {{
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .15em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }}
  .doc-title {{ font-size: 26px; font-weight: 800; color: var(--primary); margin-bottom: 14px; }}
  .doc-meta {{
    display: flex; flex-wrap: wrap; gap: 20px;
    font-size: 12px; color: var(--muted);
  }}
  .doc-meta span {{ display: flex; align-items: center; gap: 6px; }}
  .badge {{
    display: inline-block;
    padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700;
    background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;
  }}
  .badge.draft {{ background: #fef9c3; color: #854d0e; border-color: #fde047; }}
  .badge.in_review {{ background: #dbeafe; color: #1e40af; border-color: #93c5fd; }}
  /* Approval banner */
  .approval-banner {{
    margin-bottom: 28px;
    padding: 12px 18px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    font-size: 13px;
    color: #166534;
  }}
  /* Content */
  h1 {{ font-size: 22px; font-weight: 800; margin: 28px 0 12px; color: var(--primary); }}
  h2 {{ font-size: 17px; font-weight: 700; margin: 24px 0 10px; color: var(--text);
        border-bottom: 1px solid var(--border); padding-bottom: 6px; }}
  h3 {{ font-size: 14px; font-weight: 700; margin: 18px 0 8px; color: var(--text); }}
  h4 {{ font-size: 13px; font-weight: 600; margin: 14px 0 6px; color: var(--muted); }}
  p {{ margin-bottom: 10px; }}
  ul {{ padding-left: 20px; margin-bottom: 10px; }}
  li {{ margin-bottom: 4px; }}
  code {{
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: 12px;
    background: #f1f5f9;
    padding: 2px 5px;
    border-radius: 4px;
    color: #0f172a;
  }}
  pre {{
    background: #0f172a; color: #e2e8f0;
    padding: 16px; border-radius: 8px;
    overflow-x: auto; margin: 12px 0;
  }}
  pre code {{ background: none; color: inherit; padding: 0; font-size: 12px; }}
  hr {{ border: none; border-top: 1px solid var(--border); margin: 20px 0; }}
  strong {{ font-weight: 700; }}
  em {{ font-style: italic; }}
  a {{ color: var(--primary); }}
  br {{ display: block; height: 6px; }}
  /* Footer */
  .doc-footer {{
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between;
    font-size: 11px; color: var(--muted);
  }}
  /* Print */
  @media print {{
    body {{ font-size: 12px; }}
    .page {{ padding: 20mm 22mm; max-width: 100%; }}
    .no-print {{ display: none !important; }}
    h2 {{ page-break-after: avoid; }}
    pre {{ page-break-inside: avoid; }}
  }}
  /* Screen toolbar */
  .toolbar {{
    position: fixed; top: 0; left: 0; right: 0;
    background: #0f172a; padding: 10px 24px;
    display: flex; align-items: center; gap: 16px;
    z-index: 999;
  }}
  .toolbar-brand {{ font-size: 12px; font-weight: 700; color: #facc15; letter-spacing: .1em; }}
  .btn-print {{
    margin-left: auto;
    padding: 7px 18px; border-radius: 8px; border: none; cursor: pointer;
    background: #facc15; color: #0f172a; font-weight: 700; font-size: 12px;
  }}
  @media print {{ .toolbar {{ display: none; }} }}
  .spacer {{ height: 52px; }}
</style>
</head>
<body>
<div class="toolbar no-print">
  <span class="toolbar-brand">DataSphere Innovation</span>
  <span style="font-size:12px;color:#64748b;">{d.title}</span>
  <button class="btn-print" onclick="window.print()">🖨 Imprimer / Enregistrer PDF</button>
</div>
<div class="spacer no-print"></div>

<div class="page">
  <div class="doc-header">
    <div class="doc-brand">DataSphere Innovation — Document interne</div>
    <div class="doc-title">{d.title}</div>
    <div class="doc-meta">
      <span>📄 {type_label}</span>
      <span><span class="badge {d.status}">{status_label}</span></span>
      <span>Version {d.version}</span>
      <span>Langue : {d.language.upper()}</span>
      <span>Exporté le {exported_at}</span>
      {f'<span>Audience : {d.audience}</span>' if d.audience else ''}
    </div>
  </div>

  {approved_block}

  {f'<div style="margin-bottom:24px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569;font-style:italic;">{d.summary}</div>' if d.summary else ''}

  <div class="doc-body">
{body_html}
  </div>

  <div class="doc-footer">
    <span>DataSphere Innovation IA Platform · {exported_at} UTC</span>
    <span>Généré par {d.generated_by or "DataSphere Platform"}</span>
  </div>
</div>
</body>
</html>"""

    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f'inline; filename="{d.deliverable_type}_{d.id}.html"'},
    )
