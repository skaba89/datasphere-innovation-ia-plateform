"""
Endpoints Devis & Facturation — DataSphere Innovation

GET  /invoices/quotes              → liste devis
POST /invoices/quotes              → créer devis
GET  /invoices/quotes/{id}         → détail devis
PATCH /invoices/quotes/{id}        → mettre à jour
POST /invoices/quotes/{id}/export  → export PDF
POST /invoices/quotes/{id}/convert → convertir en facture

GET  /invoices/invoices            → liste factures
POST /invoices/invoices            → créer facture
GET  /invoices/invoices/{id}       → détail facture
PATCH /invoices/invoices/{id}/status → changer statut
POST /invoices/invoices/{id}/export  → export PDF

GET  /invoices/stats               → KPIs facturation
"""
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin, get_db
from app.models.user import User
from app.services.invoice_service import (
    generate_quote_html, generate_invoice_html, html_to_pdf, next_reference
)

router = APIRouter(prefix="/invoices", tags=["invoices"])


# ── Schémas ───────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description: str
    detail:      str | None = None
    quantity:    float = 1
    unit_price:  float = 0
    total:       float = 0

class QuoteCreate(BaseModel):
    title:          str
    client_name:    str
    client_email:   str | None = None
    client_address: str | None = None
    client_siret:   str | None = None
    tender_id:      int | None = None
    description:    str | None = None
    notes:          str | None = None
    daily_rate:     float | None = None
    days_count:     float | None = None
    amount_ht:      float = 0
    tva_rate:       float = 20.0
    valid_until:    str | None = None
    line_items:     list[LineItem] = []

class QuoteUpdate(BaseModel):
    title:          str | None = None
    client_name:    str | None = None
    client_email:   str | None = None
    client_address: str | None = None
    client_siret:   str | None = None
    status:         str | None = None
    amount_ht:      float | None = None
    tva_rate:       float | None = None
    daily_rate:     float | None = None
    days_count:     float | None = None
    description:    str | None = None
    notes:          str | None = None
    valid_until:    str | None = None

class InvoiceCreate(BaseModel):
    title:          str
    client_name:    str
    client_email:   str | None = None
    client_address: str | None = None
    client_siret:   str | None = None
    quote_id:       int | None = None
    amount_ht:      float = 0
    tva_rate:       float = 20.0
    payment_terms:  str = "30 jours net"
    due_date:       str | None = None
    notes:          str | None = None
    line_items:     list[LineItem] = []

class StatusUpdate(BaseModel):
    status: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def _row(db, table: str, id: int) -> dict:
    row = db.execute(text(f"SELECT * FROM {table} WHERE id = :id"), {"id": id}).fetchone()
    if not row:
        raise HTTPException(404, f"Document #{id} non trouvé")
    return dict(row._mapping)

def _list_rows(db, table: str, limit: int = 50, offset: int = 0) -> list[dict]:
    rows = db.execute(text(f"SELECT * FROM {table} ORDER BY created_at DESC LIMIT :lim OFFSET :off"),
                      {"lim": limit, "off": offset}).fetchall()
    return [dict(r._mapping) for r in rows]

def _calc_ttc(ht: float, tva_rate: float) -> float:
    return round(ht * (1 + tva_rate / 100), 2)

# ── Devis ─────────────────────────────────────────────────────────────────────

@router.get("/quotes")
def list_quotes(limit: int = 50, offset: int = 0,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    return _list_rows(db, "quotes", limit, offset)


@router.post("/quotes", status_code=201)
def create_quote(payload: QuoteCreate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    ref   = next_reference(db, "DEV")
    ht    = payload.amount_ht or (payload.daily_rate or 0) * (payload.days_count or 0)
    ttc   = _calc_ttc(ht, payload.tva_rate)
    today = date.today().isoformat()
    db.execute(text("""
        INSERT INTO quotes (reference,title,client_name,client_email,client_address,client_siret,
            tender_id,status,amount_ht,tva_rate,amount_ttc,daily_rate,days_count,
            description,notes,valid_until,issued_at,owner_id,created_at,updated_at)
        VALUES (:ref,:title,:cn,:ce,:ca,:cs,:tid,'draft',:ht,:tva,:ttc,:dr,:dc,
                :desc,:notes,:vu,:today,:uid,:now,:now)
    """), {
        "ref": ref, "title": payload.title, "cn": payload.client_name,
        "ce": payload.client_email, "ca": payload.client_address, "cs": payload.client_siret,
        "tid": payload.tender_id, "ht": ht, "tva": payload.tva_rate, "ttc": ttc,
        "dr": payload.daily_rate, "dc": payload.days_count,
        "desc": payload.description, "notes": payload.notes,
        "vu": payload.valid_until, "today": today,
        "uid": current_user.id, "now": datetime.utcnow(),
    })
    db.commit()
    row = db.execute(text("SELECT * FROM quotes WHERE reference = :ref"), {"ref": ref}).fetchone()
    return dict(row._mapping)


@router.get("/quotes/{quote_id}")
def get_quote(quote_id: int, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    return _row(db, "quotes", quote_id)


@router.patch("/quotes/{quote_id}")
def update_quote(quote_id: int, payload: QuoteUpdate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    row = _row(db, "quotes", quote_id)
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "amount_ht" in updates or "tva_rate" in updates:
        ht  = updates.get("amount_ht", float(row["amount_ht"]))
        tva = updates.get("tva_rate", float(row["tva_rate"]))
        updates["amount_ttc"] = _calc_ttc(ht, tva)
    if not updates:
        return row
    sets = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = quote_id
    updates["now"] = datetime.utcnow()
    db.execute(text(f"UPDATE quotes SET {sets}, updated_at = :now WHERE id = :id"), updates)
    db.commit()
    return _row(db, "quotes", quote_id)


@router.post("/quotes/{quote_id}/export")
def export_quote_pdf(quote_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    quote = _row(db, "quotes", quote_id)
    html  = generate_quote_html(quote)
    try:
        pdf = html_to_pdf(html)
        return Response(content=pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="devis-{quote["reference"]}.pdf"'})
    except RuntimeError:
        # WeasyPrint absent → retourner HTML
        return Response(content=html, media_type="text/html")


@router.post("/quotes/{quote_id}/convert")
def convert_to_invoice(quote_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    """Convertit un devis accepté en facture."""
    quote = _row(db, "quotes", quote_id)
    if quote["status"] not in ("accepted", "draft"):
        raise HTTPException(400, "Seuls les devis en brouillon ou acceptés peuvent être convertis.")
    ref = next_reference(db, "FAC")
    db.execute(text("""
        INSERT INTO invoices (reference,quote_id,title,client_name,client_email,client_address,
            client_siret,status,amount_ht,tva_rate,amount_ttc,payment_terms,owner_id,created_at,updated_at)
        VALUES (:ref,:qid,:title,:cn,:ce,:ca,:cs,'draft',:ht,:tva,:ttc,'30 jours net',:uid,:now,:now)
    """), {
        "ref": ref, "qid": quote_id, "title": quote["title"],
        "cn": quote["client_name"], "ce": quote["client_email"],
        "ca": quote["client_address"], "cs": quote["client_siret"],
        "ht": quote["amount_ht"], "tva": quote["tva_rate"], "ttc": quote["amount_ttc"],
        "uid": current_user.id, "now": datetime.utcnow(),
    })
    # Marquer le devis comme converti
    db.execute(text("UPDATE quotes SET status='converted' WHERE id=:id"), {"id": quote_id})
    db.commit()
    row = db.execute(text("SELECT * FROM invoices WHERE reference=:ref"), {"ref": ref}).fetchone()
    return dict(row._mapping)


# ── Factures ──────────────────────────────────────────────────────────────────

@router.get("/invoices")
def list_invoices(limit: int = 50, offset: int = 0,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    return _list_rows(db, "invoices", limit, offset)


@router.post("/invoices", status_code=201)
def create_invoice(payload: InvoiceCreate,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    ref = next_reference(db, "FAC")
    ttc = _calc_ttc(payload.amount_ht, payload.tva_rate)
    db.execute(text("""
        INSERT INTO invoices (reference,quote_id,title,client_name,client_email,client_address,
            client_siret,status,amount_ht,tva_rate,amount_ttc,payment_terms,due_date,notes,
            owner_id,created_at,updated_at)
        VALUES (:ref,:qid,:title,:cn,:ce,:ca,:cs,'draft',:ht,:tva,:ttc,:pt,:due,:notes,
                :uid,:now,:now)
    """), {
        "ref": ref, "qid": payload.quote_id, "title": payload.title,
        "cn": payload.client_name, "ce": payload.client_email,
        "ca": payload.client_address, "cs": payload.client_siret,
        "ht": payload.amount_ht, "tva": payload.tva_rate, "ttc": ttc,
        "pt": payload.payment_terms, "due": payload.due_date, "notes": payload.notes,
        "uid": current_user.id, "now": datetime.utcnow(),
    })
    db.commit()
    row = db.execute(text("SELECT * FROM invoices WHERE reference=:ref"), {"ref": ref}).fetchone()
    return dict(row._mapping)


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    return _row(db, "invoices", invoice_id)


@router.patch("/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: int, payload: StatusUpdate,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    allowed = ("draft", "sent", "paid", "overdue", "cancelled")
    if payload.status not in allowed:
        raise HTTPException(400, f"Statut invalide. Valeurs autorisées : {allowed}")
    paid_at = date.today().isoformat() if payload.status == "paid" else None
    db.execute(text("""
        UPDATE invoices SET status=:status, paid_at=COALESCE(:paid,:paid_at), updated_at=:now
        WHERE id=:id
    """), {"status": payload.status, "paid": paid_at, "paid_at": None,
           "now": datetime.utcnow(), "id": invoice_id})
    db.commit()
    return _row(db, "invoices", invoice_id)


@router.post("/invoices/{invoice_id}/export")
def export_invoice_pdf(invoice_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    invoice = _row(db, "invoices", invoice_id)
    html = generate_invoice_html(invoice)
    try:
        pdf = html_to_pdf(html)
        return Response(content=pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="facture-{invoice["reference"]}.pdf"'})
    except RuntimeError:
        return Response(content=html, media_type="text/html")


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def invoice_stats(db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    try:
        quotes  = db.execute(text("SELECT COUNT(*),SUM(amount_ht) FROM quotes")).fetchone()
        pending = db.execute(text("SELECT COUNT(*),SUM(amount_ttc) FROM invoices WHERE status='sent'")).fetchone()
        paid    = db.execute(text("SELECT COUNT(*),SUM(amount_ttc) FROM invoices WHERE status='paid'")).fetchone()
        overdue = db.execute(text("SELECT COUNT(*) FROM invoices WHERE status='sent' AND due_date < CURRENT_DATE")).fetchone()
        return {
            "quotes_total":        quotes[0] or 0,
            "quotes_ht":           float(quotes[1] or 0),
            "invoices_pending":    pending[0] or 0,
            "invoices_pending_ttc":float(pending[1] or 0),
            "invoices_paid":       paid[0] or 0,
            "invoices_paid_ttc":   float(paid[1] or 0),
            "invoices_overdue":    overdue[0] or 0,
        }
    except Exception as e:
        return {"error": str(e)}
