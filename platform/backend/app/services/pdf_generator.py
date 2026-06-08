"""
Service de génération PDF — DataSphere Innovation IA Platform

Convertit les livrables HTML en PDF professionnels via WeasyPrint.
Utilisé pour :
  - Export livrable en PDF (mémoire technique, propale, bilan...)
  - Rapport de mission PDF
  - CV consultant PDF

WeasyPrint nécessite des polices système.
En production Docker : installer avec fonts-liberation ou fonts-noto.
"""

from __future__ import annotations

import logging
import io
from typing import TYPE_CHECKING

log = logging.getLogger("datasphere.pdf_gen")


def html_to_pdf(html: str, base_url: str = "https://datasphere-innovation.fr") -> bytes:
    """
    Convert HTML string to PDF bytes using WeasyPrint.

    Args:
        html:     Complete HTML document string
        base_url: Base URL for resolving relative assets

    Returns:
        PDF bytes ready to send as response

    Raises:
        RuntimeError: If WeasyPrint is not installed or conversion fails
    """
    try:
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration
    except ImportError as e:
        raise RuntimeError(
            "WeasyPrint non disponible. Installer : pip install weasyprint"
        ) from e

    try:
        font_config = FontConfiguration()

        # Extra CSS for PDF rendering (page breaks, margins, etc.)
        pdf_css = CSS(string="""
            @page {
                margin: 20mm 18mm;
                @bottom-right {
                    content: "Page " counter(page) " / " counter(pages);
                    font-size: 10px;
                    color: #64748b;
                }
                @bottom-left {
                    content: "DataSphere Innovation IA Platform";
                    font-size: 10px;
                    color: #64748b;
                }
            }
            @media print {
                .no-print { display: none !important; }
                a { text-decoration: none; }
                h1, h2, h3 { page-break-after: avoid; }
                table, pre { page-break-inside: avoid; }
            }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        """, font_config=font_config)

        doc = HTML(string=html, base_url=base_url)
        pdf_bytes = doc.write_pdf(stylesheets=[pdf_css], font_config=font_config)

        log.info("PDF generated: %d bytes", len(pdf_bytes))
        return pdf_bytes

    except Exception as e:
        log.error("PDF generation failed: %s", e)
        raise RuntimeError(f"Erreur génération PDF : {e}") from e


def deliverable_to_pdf(deliverable, db=None) -> bytes:
    """
    Generate a PDF for a Deliverable model instance.
    Uses the same HTML template as the HTML export, optimised for print.
    """
    from app.api.v1.endpoints.export import (
        export_html as _export_html_fn,
        _md_to_html, _TYPE_LABELS, _STATUS_LABELS,
    )
    from datetime import datetime, timezone

    type_label   = _TYPE_LABELS.get(deliverable.deliverable_type, deliverable.deliverable_type)
    status_label = _STATUS_LABELS.get(deliverable.status, deliverable.status)
    exported_at  = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
    body_html    = _md_to_html(deliverable.content_markdown or "")

    approval_block = ""
    if deliverable.status == "approved":
        approved_date = ""
        if getattr(deliverable, "approved_at", None):
            approved_date = f"le {deliverable.approved_at.strftime('%d/%m/%Y')}"
        approval_block = f"""
        <div style="margin:24px 0;padding:16px 20px;background:#f0fdf4;border:2px solid #86efac;
                    border-radius:8px;color:#166534;font-weight:600">
          ✅ Livrable approuvé par <strong>{deliverable.approved_by or '?'}</strong> {approved_date}
        </div>"""

    # Sections if any
    sections_html = ""
    if db:
        from app.crud.deliverable_section import list_sections
        sections = list_sections(db, deliverable.id)
        if sections:
            for sec in sorted(sections, key=lambda s: s.order_index):
                sec_body = _md_to_html(sec.content_markdown or "")
                sections_html += f"""
                <div style="margin:28px 0">
                  <h2 style="font-size:1.1rem;color:#1e40af;border-bottom:1px solid #e2e8f0;
                              padding-bottom:8px;margin-bottom:16px">{sec.title}</h2>
                  {sec_body}
                </div>"""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{deliverable.title} — DataSphere</title>
<style>
  :root {{ --primary:#1e40af; --accent:#facc15; --text:#0f172a; --muted:#64748b; --border:#e2e8f0; }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ font-family:'Segoe UI',system-ui,sans-serif; font-size:13px; line-height:1.75; color:var(--text); background:white; }}
  .page {{ max-width:820px; margin:0 auto; padding:40px 48px; }}
  .doc-header {{ border-bottom:3px solid var(--primary); padding-bottom:20px; margin-bottom:28px; display:flex; justify-content:space-between; align-items:flex-start; }}
  .doc-brand {{ font-size:1.2rem; font-weight:900; color:var(--primary); letter-spacing:-.02em; }}
  .doc-brand span {{ color:#64748b; font-size:.75rem; font-weight:400; display:block; margin-top:2px; }}
  .doc-meta {{ text-align:right; font-size:.75rem; color:#64748b; }}
  .doc-title {{ font-size:1.6rem; font-weight:900; color:#0f172a; margin:0 0 8px; line-height:1.15; }}
  .doc-subtitle {{ font-size:.85rem; color:#64748b; display:flex; gap:16px; flex-wrap:wrap; }}
  .badge {{ display:inline-block; padding:2px 10px; border-radius:99px; font-size:.72rem; font-weight:700; }}
  .badge-blue {{ background:#dbeafe; color:#1d4ed8; }}
  .badge-green {{ background:#dcfce7; color:#166534; }}
  .badge-gray  {{ background:#f1f5f9; color:#475569; }}
  .content {{ margin:24px 0; }}
  .content h1 {{ font-size:1.3rem; color:#1e40af; margin:24px 0 12px; }}
  .content h2 {{ font-size:1.1rem; color:#1e40af; margin:20px 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; }}
  .content h3 {{ font-size:.95rem; font-weight:700; margin:16px 0 8px; }}
  .content p  {{ margin-bottom:12px; }}
  .content ul, .content ol {{ margin:10px 0 12px 20px; }}
  .content li {{ margin-bottom:4px; }}
  .content table {{ border-collapse:collapse; width:100%; margin:16px 0; }}
  .content th {{ background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 12px; text-align:left; font-size:.82rem; }}
  .content td {{ border:1px solid #e2e8f0; padding:8px 12px; font-size:.82rem; }}
  .content pre {{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:14px; font-size:.78rem; overflow-x:auto; }}
  .content code {{ background:#f1f5f9; border-radius:3px; padding:1px 5px; font-size:.82rem; }}
  .footer {{ margin-top:48px; padding-top:16px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:.72rem; color:#94a3b8; }}
</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div>
      <div class="doc-brand">DataSphere Innovation<span>IA Platform — Document de travail</span></div>
    </div>
    <div class="doc-meta">
      Exporté le {exported_at}<br>
      Confidentiel
    </div>
  </div>

  <h1 class="doc-title">{deliverable.title}</h1>
  <div class="doc-subtitle" style="margin-top:12px;margin-bottom:24px">
    <span class="badge badge-blue">{type_label}</span>
    <span class="badge {'badge-green' if deliverable.status == 'approved' else 'badge-gray'}">{status_label}</span>
    {'<span>Révisé par : ' + deliverable.reviewed_by + '</span>' if getattr(deliverable,'reviewed_by',None) else ''}
    {'<span>Approuvé par : ' + deliverable.approved_by + '</span>' if getattr(deliverable,'approved_by',None) else ''}
  </div>

  {approval_block}

  <div class="content">
    {body_html}
    {sections_html}
  </div>

  <div class="footer">
    <span>DataSphere Innovation IA Platform — {datetime.now(timezone.utc).strftime('%Y')}</span>
    <span>Document généré automatiquement — {deliverable.title[:50]}</span>
  </div>
</div>
</body>
</html>"""

    return html_to_pdf(html)
