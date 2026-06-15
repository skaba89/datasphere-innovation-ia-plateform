"""Tests unitaires — Invoice Service (devis & factures)"""
import pytest
from unittest.mock import patch, MagicMock


# ── generate_quote_html ───────────────────────────────────────────────────────

def test_generate_quote_html_basic():
    from app.services.invoice_service import generate_quote_html
    quote = {
        "reference": "DEV-2026-001",
        "title": "Mission Data Engineering",
        "client_name": "SACEM",
        "client_email": "achat@sacem.fr",
        "amount_ht": 15000.0,
        "tva_rate": 20.0,
        "amount_ttc": 18000.0,
        "status": "draft",
        "daily_rate": 750.0,
        "days_count": 20.0,
        "issued_at": "2026-06-15",
        "valid_until": "2026-07-15",
    }
    html = generate_quote_html(quote)
    assert "DEV-2026-001" in html
    assert "SACEM" in html
    assert "DEVIS" in html
    assert "DataSphere" in html
    assert "15" in html  # montant HT
    assert "18" in html  # montant TTC


def test_generate_quote_html_with_line_items():
    from app.services.invoice_service import generate_quote_html
    quote = {
        "reference": "DEV-2026-002",
        "title": "Audit Data",
        "client_name": "Thales",
        "amount_ht": 5000.0,
        "tva_rate": 0.0,
        "amount_ttc": 5000.0,
        "status": "sent",
    }
    items = [
        {"description": "Audit architecture", "detail": "3 jours", "quantity": 3, "unit_price": 1000, "total": 3000},
        {"description": "Rapport synthèse",   "detail": "2 jours", "quantity": 2, "unit_price": 1000, "total": 2000},
    ]
    html = generate_quote_html(quote, line_items=items)
    assert "Audit architecture" in html
    assert "Rapport synthèse" in html
    assert "Thales" in html


def test_generate_invoice_html_basic():
    from app.services.invoice_service import generate_invoice_html
    invoice = {
        "reference": "FAC-2026-001",
        "title": "Mission Data Engineering — Janvier",
        "client_name": "Accor",
        "amount_ht": 10000.0,
        "tva_rate": 20.0,
        "amount_ttc": 12000.0,
        "status": "sent",
        "payment_terms": "30 jours net",
        "due_date": "2026-07-15",
        "created_at": "2026-06-15T10:00:00",
    }
    html = generate_invoice_html(invoice)
    assert "FAC-2026-001" in html
    assert "FACTURE" in html
    assert "Accor" in html
    assert "30 jours net" in html


def test_invoice_status_labels():
    from app.services.invoice_service import generate_invoice_html
    for status in ["draft", "sent", "paid", "overdue", "cancelled"]:
        invoice = {
            "reference": f"FAC-TEST-{status}", "title": "Test", "client_name": "Test",
            "amount_ht": 1000, "tva_rate": 20, "amount_ttc": 1200, "status": status,
            "payment_terms": "30j", "created_at": "2026-06-15",
        }
        html = generate_invoice_html(invoice)
        assert "FAC-TEST-" in html


def test_fmteur():
    from app.services.invoice_service import _fmteur
    assert "1" in _fmteur(1000)
    assert "€" in _fmteur(5000)
    assert "0" in _fmteur(0)


def test_calc_ttc():
    """Vérifier le calcul TTC."""
    # 1000 HT à 20% = 1200 TTC
    ht = 1000.0
    tva = 20.0
    ttc = round(ht * (1 + tva / 100), 2)
    assert ttc == 1200.0

    # 1000 HT à 0% = 1000 TTC
    ttc_zero = round(ht * (1 + 0 / 100), 2)
    assert ttc_zero == 1000.0


def test_next_reference_format():
    from app.services.invoice_service import next_reference
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar.return_value = 5

    ref = next_reference(mock_db, "DEV")
    assert ref.startswith("DEV-")
    assert "2026" in ref
    assert ref.endswith("-006")

    ref_fac = next_reference(mock_db, "FAC")
    assert ref_fac.startswith("FAC-")


def test_next_reference_first():
    from app.services.invoice_service import next_reference
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar.return_value = 0

    ref = next_reference(mock_db, "DEV")
    assert ref.endswith("-001")


def test_html_to_pdf_without_weasyprint():
    from app.services.invoice_service import html_to_pdf
    with patch.dict("sys.modules", {"weasyprint": None}):
        with pytest.raises((RuntimeError, ImportError)):
            html_to_pdf("<html><body>Test</body></html>")
