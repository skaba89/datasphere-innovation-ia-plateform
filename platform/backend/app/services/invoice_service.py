"""
Service Devis & Facturation — DataSphere Innovation

Génère des devis et factures PDF professionnels via WeasyPrint.
Numérotation automatique, TVA, export PDF.
"""
from __future__ import annotations
import logging
from datetime import date, datetime
from typing import Optional

log = logging.getLogger("datasphere.invoice")

# ── Templates HTML ─────────────────────────────────────────────────────────────

_COMPANY = {
    "name":    "DataSphere Innovation",
    "address": "Paris, France",
    "email":   "contact@datasphere.io",
    "siret":   "",
    "tva_num": "",
}

_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
.page { padding: 48px 56px; max-width: 800px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 28px; border-bottom: 2px solid #facc15; }
.logo-block { display: flex; flex-direction: column; gap: 4px; }
.logo-name { font-size: 22px; font-weight: 900; letter-spacing: -.04em; color: #0f172a; }
.logo-sub { font-size: 11px; color: #64748b; letter-spacing: .06em; text-transform: uppercase; }
.doc-type { font-size: 32px; font-weight: 900; letter-spacing: -.05em; color: #0f172a; text-align: right; }
.doc-ref { font-size: 13px; color: #64748b; text-align: right; margin-top: 4px; }
.doc-date { font-size: 12px; color: #94a3b8; text-align: right; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
.party-label { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
.party-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
.party-detail { font-size: 12px; color: #475569; line-height: 1.6; }
.title-block { background: #f8fafc; border-left: 4px solid #facc15; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 32px; }
.title-text { font-size: 16px; font-weight: 700; color: #0f172a; }
.title-sub { font-size: 12px; color: #64748b; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
thead th { background: #0f172a; color: #f8fafc; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
thead th:last-child { text-align: right; }
tbody tr:nth-child(even) { background: #f8fafc; }
tbody td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
tbody td:last-child { text-align: right; font-weight: 600; white-space: nowrap; }
.desc-main { font-weight: 600; color: #0f172a; }
.desc-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
.totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
.totals-box { width: 280px; }
.total-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; }
.total-row.separator { border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 12px; }
.total-row.final { font-size: 17px; font-weight: 900; color: #0f172a; border-top: 2px solid #facc15; padding-top: 12px; margin-top: 4px; }
.total-label { color: #475569; }
.total-value { font-weight: 600; }
.notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-bottom: 32px; }
.notes-title { font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.notes-text { font-size: 12px; color: #78350f; line-height: 1.6; }
.footer { border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
.footer-company { font-size: 11px; color: #94a3b8; line-height: 1.6; }
.footer-status { font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 99px; }
.status-draft     { background: #f1f5f9; color: #64748b; }
.status-sent      { background: #dbeafe; color: #1d4ed8; }
.status-accepted  { background: #dcfce7; color: #16a34a; }
.status-paid      { background: #dcfce7; color: #16a34a; }
.status-overdue   { background: #fee2e2; color: #dc2626; }
.watermark        { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(0,0,0,.03); letter-spacing: -.05em; pointer-events: none; white-space: nowrap; }
"""

def _fmteur(amount) -> str:
    try:
        return f"{float(amount):,.2f} €".replace(',', ' ')
    except Exception:
        return "0,00 €"

def _fmtdate(d) -> str:
    if not d:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d[:10])
        except Exception:
            return d
    return d.strftime("%d/%m/%Y")


def generate_quote_html(quote: dict, line_items: list[dict] | None = None) -> str:
    """Génère le HTML d'un devis."""
    items = line_items or []
    if not items and quote.get("daily_rate") and quote.get("days_count"):
        items = [{
            "description": quote.get("title", "Prestation"),
            "detail": f"TJM : {_fmteur(quote['daily_rate'])} × {quote['days_count']} jours",
            "quantity": float(quote["days_count"]),
            "unit_price": float(quote["daily_rate"]),
            "total": float(quote["amount_ht"]),
        }]

    lines_html = ""
    for item in items:
        lines_html += f"""
        <tr>
          <td>
            <div class="desc-main">{item.get('description','')}</div>
            {'<div class="desc-sub">' + item.get('detail','') + '</div>' if item.get('detail') else ''}
          </td>
          <td style="text-align:center">{item.get('quantity','')}</td>
          <td style="text-align:right">{_fmteur(item.get('unit_price',0))}</td>
          <td>{_fmteur(item.get('total',0))}</td>
        </tr>"""

    tva = float(quote.get("tva_rate", 20))
    ht  = float(quote.get("amount_ht", 0))
    ttc = float(quote.get("amount_ttc", ht * (1 + tva / 100)))
    tva_amt = ttc - ht

    status = quote.get("status", "draft")
    status_labels = {"draft":"BROUILLON","sent":"ENVOYÉ","accepted":"ACCEPTÉ","rejected":"REFUSÉ"}

    notes_html = ""
    if quote.get("notes"):
        notes_html = f"""<div class="notes"><div class="notes-title">Notes & conditions</div><div class="notes-text">{quote['notes']}</div></div>"""

    valid_html = f"Valable jusqu'au {_fmtdate(quote.get('valid_until'))}" if quote.get("valid_until") else ""

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>{_CSS}</style></head>
<body>
<div class="watermark">{status_labels.get(status,'')}</div>
<div class="page">
  <div class="header">
    <div class="logo-block">
      <div class="logo-name">DataSphere</div>
      <div class="logo-sub">Innovation · Data Engineering</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:8px">{_COMPANY['address']}<br>{_COMPANY['email']}</div>
    </div>
    <div>
      <div class="doc-type">DEVIS</div>
      <div class="doc-ref">{quote.get('reference','—')}</div>
      <div class="doc-date">Émis le {_fmtdate(quote.get('issued_at') or date.today())}</div>
      {f'<div class="doc-date">{valid_html}</div>' if valid_html else ''}
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Prestataire</div>
      <div class="party-name">{_COMPANY['name']}</div>
      <div class="party-detail">{_COMPANY['address']}<br>{_COMPANY['email']}</div>
    </div>
    <div>
      <div class="party-label">Client</div>
      <div class="party-name">{quote.get('client_name','—')}</div>
      <div class="party-detail">{(quote.get('client_address') or '').replace(chr(10),'<br>')}
        {f'<br>SIRET : {quote["client_siret"]}' if quote.get('client_siret') else ''}
        {f'<br>{quote["client_email"]}' if quote.get('client_email') else ''}
      </div>
    </div>
  </div>

  <div class="title-block">
    <div class="title-text">{quote.get('title','Prestation de conseil')}</div>
    {f'<div class="title-sub">{quote.get("description","")}</div>' if quote.get('description') else ''}
  </div>

  <table>
    <thead><tr><th>Prestation</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unitaire</th><th style="text-align:right">Total HT</th></tr></thead>
    <tbody>{lines_html}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row"><span class="total-label">Montant HT</span><span class="total-value">{_fmteur(ht)}</span></div>
      <div class="total-row"><span class="total-label">TVA ({tva:.0f}%)</span><span class="total-value">{_fmteur(tva_amt)}</span></div>
      <div class="total-row final"><span>TOTAL TTC</span><span>{_fmteur(ttc)}</span></div>
    </div>
  </div>

  {notes_html}

  <div class="footer">
    <div class="footer-company">
      {_COMPANY['name']} · {_COMPANY['address']}<br>
      {f'SIRET : {_COMPANY["siret"]} · ' if _COMPANY.get('siret') else ''}
      {f'N° TVA : {_COMPANY["tva_num"]}' if _COMPANY.get('tva_num') else ''}
    </div>
    <div class="footer-status status-{status}">{status_labels.get(status, status.upper())}</div>
  </div>
</div>
</body></html>"""


def generate_invoice_html(invoice: dict, line_items: list[dict] | None = None) -> str:
    """Génère le HTML d'une facture."""
    items = line_items or []

    lines_html = ""
    for item in items:
        lines_html += f"""
        <tr>
          <td><div class="desc-main">{item.get('description','')}</div>
            {'<div class="desc-sub">' + item.get('detail','') + '</div>' if item.get('detail') else ''}
          </td>
          <td style="text-align:center">{item.get('quantity','')}</td>
          <td style="text-align:right">{_fmteur(item.get('unit_price',0))}</td>
          <td>{_fmteur(item.get('total',0))}</td>
        </tr>"""

    tva     = float(invoice.get("tva_rate", 20))
    ht      = float(invoice.get("amount_ht", 0))
    ttc     = float(invoice.get("amount_ttc", ht * (1 + tva / 100)))
    tva_amt = ttc - ht

    status = invoice.get("status", "draft")
    status_labels = {"draft":"BROUILLON","sent":"ÉMISE","paid":"PAYÉE","overdue":"EN RETARD","cancelled":"ANNULÉE"}
    due_html = f"À régler avant le {_fmtdate(invoice.get('due_date'))}" if invoice.get("due_date") else ""

    notes_html = ""
    if invoice.get("notes"):
        notes_html = f"""<div class="notes"><div class="notes-title">Conditions de paiement</div><div class="notes-text">{invoice['notes']}</div></div>"""

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>{_CSS}</style></head>
<body>
<div class="watermark">{status_labels.get(status,'')}</div>
<div class="page">
  <div class="header">
    <div class="logo-block">
      <div class="logo-name">DataSphere</div>
      <div class="logo-sub">Innovation · Data Engineering</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:8px">{_COMPANY['address']}<br>{_COMPANY['email']}</div>
    </div>
    <div>
      <div class="doc-type">FACTURE</div>
      <div class="doc-ref">{invoice.get('reference','—')}</div>
      <div class="doc-date">Émise le {_fmtdate(invoice.get('created_at'))}</div>
      {f'<div class="doc-date" style="color:#ef4444;font-weight:700">{due_html}</div>' if due_html else ''}
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Prestataire</div>
      <div class="party-name">{_COMPANY['name']}</div>
      <div class="party-detail">{_COMPANY['address']}<br>{_COMPANY['email']}</div>
    </div>
    <div>
      <div class="party-label">Client</div>
      <div class="party-name">{invoice.get('client_name','—')}</div>
      <div class="party-detail">{(invoice.get('client_address') or '').replace(chr(10),'<br>')}
        {f'<br>SIRET : {invoice["client_siret"]}' if invoice.get('client_siret') else ''}
        {f'<br>{invoice["client_email"]}' if invoice.get('client_email') else ''}
      </div>
    </div>
  </div>

  <div class="title-block">
    <div class="title-text">{invoice.get('title','Prestation de conseil')}</div>
    <div class="title-sub">Conditions : {invoice.get('payment_terms','30 jours net')}</div>
  </div>

  <table>
    <thead><tr><th>Prestation</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unitaire</th><th style="text-align:right">Total HT</th></tr></thead>
    <tbody>{lines_html}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row"><span class="total-label">Montant HT</span><span class="total-value">{_fmteur(ht)}</span></div>
      <div class="total-row"><span class="total-label">TVA ({tva:.0f}%)</span><span class="total-value">{_fmteur(tva_amt)}</span></div>
      <div class="total-row final"><span>TOTAL TTC</span><span>{_fmteur(ttc)}</span></div>
    </div>
  </div>

  {notes_html}

  <div class="footer">
    <div class="footer-company">
      {_COMPANY['name']} · {_COMPANY['address']}<br>
      {f'SIRET : {_COMPANY["siret"]} · ' if _COMPANY.get('siret') else ''}
      {f'N° TVA : {_COMPANY["tva_num"]}' if _COMPANY.get('tva_num') else ''}
    </div>
    <div class="footer-status status-{status}">{status_labels.get(status, status.upper())}</div>
  </div>
</div>
</body></html>"""


def html_to_pdf(html: str) -> bytes:
    """Convertit HTML → PDF via WeasyPrint."""
    try:
        from weasyprint import HTML as WHTML
        return WHTML(string=html).write_pdf()
    except ImportError:
        raise RuntimeError("WeasyPrint non disponible — pip install weasyprint")


def next_reference(db, doc_type: str = "DEV") -> str:
    """Génère la prochaine référence auto : DEV-2026-001."""
    from sqlalchemy import text
    year = datetime.now().year
    table = "quotes" if doc_type == "DEV" else "invoices"
    try:
        row = db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE reference LIKE :prefix"),
                         {"prefix": f"{doc_type}-{year}-%"}).scalar()
        num = (row or 0) + 1
    except Exception:
        num = 1
    return f"{doc_type}-{year}-{num:03d}"
