"""
Excel export endpoints — download .xlsx reports.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.services.excel_export_service import (
    export_actions,
    export_deliverables,
    export_full_report,
    export_pipeline,
    export_tenders,
)

router = APIRouter(
    prefix="/export/excel",
    tags=["export-excel"],
    dependencies=[Depends(get_current_user)],
)

_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([data]),
        media_type=_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pipeline")
def download_pipeline(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Download pipeline commercial as .xlsx"""
    from datetime import datetime, timezone
    fn = f"pipeline_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_pipeline(db), fn)


@router.get("/tenders")
def download_tenders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Download all tenders + Go/No-Go scores as .xlsx"""
    from datetime import datetime, timezone
    fn = f"appels_offres_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_tenders(db), fn)


@router.get("/actions")
def download_actions(db: Session = Depends(get_db)):
    """Download agent actions report as .xlsx"""
    from datetime import datetime, timezone
    fn = f"actions_agents_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_actions(db), fn)


@router.get("/deliverables")
def download_deliverables(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Download deliverables status report as .xlsx"""
    from datetime import datetime, timezone
    fn = f"livrables_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_deliverables(db), fn)


@router.get("/full-report")
def download_full_report(db: Session = Depends(get_db)):
    """Download complete multi-sheet report as .xlsx"""
    from datetime import datetime, timezone
    fn = f"datasphere_rapport_complet_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_full_report(db), fn)


# ── CRM CSV exports ──────────────────────────────────────────────────────────

@router.get("/contacts/csv")
def export_contacts_csv(db: Session = Depends(get_db)):
    """Export all contacts as CSV."""
    import csv
    import io
    from datetime import datetime, timezone

    from fastapi.responses import Response

    from app.models.contact import Contact
    from app.models.organization import Organization

    rows = (
        db.query(Contact, Organization.name)
        .join(Organization, Contact.organization_id == Organization.id, isouter=True)
        .order_by(Contact.last_name)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Prénom", "Nom", "Email", "Téléphone",
        "Poste", "Organisation", "Source", "Notes",
    ])
    for contact, org_name in rows:
        writer.writerow([
            contact.id,
            contact.first_name or "",
            contact.last_name or "",
            contact.professional_email or "",
            "",  # phone — field not in current model
            contact.job_title or "",
            org_name or "",
            contact.source or "",
            (contact.notes or "")[:120],
        ])

    filename = f"contacts_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/opportunities/csv")
def export_opportunities_csv(db: Session = Depends(get_db)):
    """Export all opportunities as CSV."""
    import csv
    import io
    from datetime import datetime, timezone

    from fastapi.responses import Response

    from app.models.opportunity import Opportunity
    from app.models.organization import Organization

    rows = (
        db.query(Opportunity, Organization.name)
        .join(Organization, Opportunity.organization_id == Organization.id, isouter=True)
        .order_by(Opportunity.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Titre", "Organisation", "Statut", "Priorité",
        "Valeur €", "Probabilité %", "Secteur", "Pays",
        "Responsable", "Source", "Créée le",
    ])
    for opp, org_name in rows:
        writer.writerow([
            opp.id, opp.title, org_name or "",
            opp.status or "", opp.priority or "",
            float(opp.potential_value) if opp.potential_value else "",
            opp.probability or 0,
            opp.sector or "", opp.country or "",
            opp.owner_name or "", opp.source or "",
            opp.created_at.strftime("%d/%m/%Y") if opp.created_at else "",
        ])

    filename = f"opportunites_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/tenders/csv")
def export_tenders_csv(db: Session = Depends(get_db)):
    """Export all validated tenders as CSV."""
    from app.models.tender import Tender
    import csv, io
    from fastapi.responses import StreamingResponse
    items = db.query(Tender).filter(Tender.validation_status == "validated").order_by(Tender.created_at.desc()).limit(1000).all()
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["ID", "Titre", "Acheteur", "Statut", "Go/No-Go", "Score", "Deadline", "Référence", "Créé"])
    for t in items:
        w.writerow([t.id, t.title, t.buyer_name or "", t.status, t.go_no_go_decision or "",
                    t.go_no_go_score or "",
                    t.submission_deadline.strftime("%Y-%m-%d") if t.submission_deadline else "",
                    t.reference or "",
                    t.created_at.strftime("%Y-%m-%d") if t.created_at else ""])
    output.seek(0)
    from datetime import datetime as _dt, timezone as _tz
    fn = f"appels_offres_{_dt.now(_tz.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f"attachment; filename={fn}"})


@router.get("/deliverables/csv")
def export_deliverables_csv(db: Session = Depends(get_db)):
    """Export all deliverables as CSV."""
    from app.models.deliverable import Deliverable
    import csv, io
    from fastapi.responses import StreamingResponse
    items = db.query(Deliverable).order_by(Deliverable.created_at.desc()).limit(1000).all()
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["ID", "Titre", "Type", "Statut", "Version", "AO ID", "Créé", "Modifié"])
    for d in items:
        w.writerow([d.id, d.title, d.deliverable_type, d.status, d.version or 1,
                    d.tender_id or "",
                    d.created_at.strftime("%Y-%m-%d") if d.created_at else "",
                    d.updated_at.strftime("%Y-%m-%d") if d.updated_at else ""])
    output.seek(0)
    from datetime import datetime as _dt, timezone as _tz
    fn = f"livrables_{_dt.now(_tz.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f"attachment; filename={fn}"})
