"""
PDF Export — DataSphere Innovation
Génère un PDF professionnel depuis le Markdown d'un livrable.

Stack : Markdown → HTML → WeasyPrint → PDF bytes
Design : en-tête DataSphere, styles data/conseil, pied de page numéroté
"""

from __future__ import annotations
import re
import logging
from datetime import datetime

log = logging.getLogger("datasphere.pdf_export")

# ── CSS styles ─────────────────────────────────────────────────────────────────

_CSS = """
@page {
  size: A4;
  margin: 2.5cm 2cm 2.5cm 2cm;
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-size: 8pt;
    color: #94a3b8;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
  @bottom-right {
    content: "CONFIDENTIEL — DataSphere Innovation";
    font-size: 7pt;
    color: #dc2626;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.6;
  color: #1e293b;
}

/* Cover page */
.cover {
  height: 25cm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3cm 2cm;
  break-after: page;
}

.cover .brand {
  font-size: 11pt;
  font-weight: 700;
  color: #b45309;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.5cm;
}

.cover .title {
  font-size: 24pt;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.2;
  margin: 0.5cm 0 0.8cm;
}

.cover .subtitle {
  font-size: 12pt;
  color: #1e40af;
  font-weight: 600;
  margin-bottom: 1.5cm;
}

.cover .meta-table {
  border-top: 2px solid #e2e8f0;
  padding-top: 0.5cm;
  font-size: 9pt;
  color: #64748b;
}

.cover .meta-table .row {
  display: flex;
  margin-bottom: 0.2cm;
}

.cover .meta-table .label {
  width: 4cm;
  font-weight: 700;
  color: #475569;
}

/* Headings */
h1 {
  font-size: 18pt;
  font-weight: 900;
  color: #0f172a;
  margin: 1cm 0 0.3cm;
  padding-bottom: 0.15cm;
  border-bottom: 2px solid #1e40af;
  break-after: avoid;
}

h2 {
  font-size: 14pt;
  font-weight: 800;
  color: #1e40af;
  margin: 0.8cm 0 0.2cm;
  break-after: avoid;
}

h3 {
  font-size: 11pt;
  font-weight: 700;
  color: #0f172a;
  margin: 0.5cm 0 0.2cm;
  break-after: avoid;
}

h4 {
  font-size: 10pt;
  font-weight: 700;
  color: #334155;
  margin: 0.4cm 0 0.1cm;
}

/* Paragraphs */
p { margin: 0.2cm 0; }

/* Lists */
ul, ol {
  margin: 0.2cm 0 0.2cm 0.8cm;
  padding: 0;
}

li { margin: 0.1cm 0; }

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.4cm 0;
  font-size: 9pt;
  break-inside: avoid;
}

thead tr {
  background: #1e40af;
  color: white;
}

thead th {
  padding: 0.2cm 0.3cm;
  text-align: left;
  font-weight: 700;
}

tbody tr:nth-child(even) {
  background: #f8fafc;
}

tbody td {
  padding: 0.15cm 0.3cm;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

/* Code blocks */
pre, code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 8.5pt;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 0.1cm 0.2cm;
}

pre {
  padding: 0.3cm;
  margin: 0.3cm 0;
  border-left: 3px solid #1e40af;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Blockquotes */
blockquote {
  margin: 0.3cm 0 0.3cm 0.5cm;
  padding: 0.2cm 0.5cm;
  border-left: 3px solid #facc15;
  background: #fffbeb;
  color: #78350f;
  font-style: italic;
}

/* Strong */
strong { font-weight: 800; color: #0f172a; }

/* Horizontal rule */
hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 0.5cm 0;
}

/* TOC placeholder */
.toc-title {
  font-size: 14pt;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.5cm;
}
"""


# ── Markdown → HTML ───────────────────────────────────────────────────────────

def _md_to_html_body(md: str) -> str:
    """Convert Markdown to clean HTML body content."""
    lines = md.split('\n')
    html_lines = []
    in_code = False
    in_table = False
    table_rows: list[list[str]] = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Code blocks
        if line.strip().startswith('```'):
            if in_code:
                html_lines.append('</pre>')
                in_code = False
            else:
                html_lines.append('<pre><code>')
                in_code = True
            i += 1
            continue

        if in_code:
            html_lines.append(_escape(line))
            i += 1
            continue

        # Tables
        if line.strip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if not all(re.match(r'^[-:]+$', c) for c in cells if c):
                table_rows.append(cells)
            if not in_table:
                in_table = True
            i += 1
            if i >= len(lines) or not lines[i].strip().startswith('|'):
                html_lines.append(_render_table(table_rows))
                table_rows = []
                in_table = False
            continue

        # Headings
        if   line.startswith('#### '): html_lines.append(f'<h4>{_inline(line[5:])}</h4>')
        elif line.startswith('### '):  html_lines.append(f'<h3>{_inline(line[4:])}</h3>')
        elif line.startswith('## '):   html_lines.append(f'<h2>{_inline(line[3:])}</h2>')
        elif line.startswith('# '):    html_lines.append(f'<h1>{_inline(line[2:])}</h1>')
        elif line.startswith('> '):    html_lines.append(f'<blockquote><p>{_inline(line[2:])}</p></blockquote>')
        elif line.startswith('- ') or line.startswith('* '): html_lines.append(f'<ul><li>{_inline(line[2:])}</li></ul>')
        elif re.match(r'^\d+\. ', line): html_lines.append(f'<ol><li>{_inline(re.sub(r"^\d+\. ", "", line))}</li></ol>')
        elif line.strip() in ('---', '***'):  html_lines.append('<hr>')
        elif line.strip(): html_lines.append(f'<p>{_inline(line)}</p>')
        else:              html_lines.append('<br>')

        i += 1

    return '\n'.join(html_lines)


def _escape(text: str) -> str:
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _inline(text: str) -> str:
    """Parse inline markdown: bold, italic, code, links."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*',     r'<em>\1</em>', text)
    text = re.sub(r'`(.+?)`',       r'<code>\1</code>', text)
    text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)
    return text


def _render_table(rows: list[list[str]]) -> str:
    if not rows:
        return ''
    html = ['<table>']
    for r_idx, row in enumerate(rows):
        tag = 'th' if r_idx == 0 else 'td'
        section = '<thead><tr>' if r_idx == 0 else '<tbody><tr>' if r_idx == 1 else '<tr>'
        close   = '</tr></thead>' if r_idx == 0 else '</tr></tbody>' if r_idx == len(rows) - 1 else '</tr>'
        cells = ''.join(f'<{tag}>{_inline(c)}</{tag}>' for c in row)
        html.append(f'{section}{cells}{close}')
    html.append('</table>')
    return '\n'.join(html)


# ── Main function ─────────────────────────────────────────────────────────────

def markdown_to_pdf(
    title: str,
    content_markdown: str,
    author: str = "DataSphere Innovation",
    buyer_name: str | None = None,
    version: int = 1,
    confidential: bool = True,
) -> bytes:
    """
    Convert deliverable Markdown to a professional PDF.
    Returns raw bytes ready for HTTP response.
    """
    # WeasyPrint optionnel — fallback HTML si absent (Render free sans Cairo/Pango)
    _weasyprint_available = True
    try:
        from weasyprint import HTML as WHP, CSS as WCSS
    except (ImportError, OSError):
        _weasyprint_available = False
        log.warning("WeasyPrint non disponible — fallback HTML")

    date_str = datetime.now().strftime('%d/%m/%Y')

    cover_html = f"""
<div class="cover">
  <div class="brand">DataSphere Innovation — Cabinet de conseil Data & IA</div>
  <div class="title">{_escape(title)}</div>
  {'<div class="subtitle">À l\'attention de : ' + _escape(buyer_name) + '</div>' if buyer_name else ''}
  <div class="meta-table">
    <div class="row"><span class="label">Auteur :</span><span>{_escape(author)}</span></div>
    <div class="row"><span class="label">Date :</span><span>{date_str}</span></div>
    <div class="row"><span class="label">Version :</span><span>v{version}.0</span></div>
    {'<div class="row"><span class="label">Statut :</span><span style="color:#dc2626;font-weight:700;">CONFIDENTIEL</span></div>' if confidential else ''}
  </div>
</div>
"""

    body_html = _md_to_html_body(content_markdown)

    full_html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>{_escape(title)}</title>
</head>
<body>
  {cover_html}
  {body_html}
</body>
</html>"""

    if _weasyprint_available:
        try:
            pdf_bytes = WHP(string=full_html).write_pdf(
                stylesheets=[WCSS(string=_CSS)]
            )
            log.info("PDF generated: %s (%d bytes)", title[:50], len(pdf_bytes))
            return pdf_bytes
        except Exception as e:
            log.warning("WeasyPrint failed (%s) — fallback HTML", e)

    # Fallback HTML — retourne le document comme HTML téléchargeable
    log.info("Returning HTML fallback for: %s", title[:50])
    return full_html.encode("utf-8")
