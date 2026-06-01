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
def download_pipeline(db: Session = Depends(get_db)):
    """Download pipeline commercial as .xlsx"""
    from datetime import datetime
    fn = f"pipeline_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_pipeline(db), fn)


@router.get("/tenders")
def download_tenders(db: Session = Depends(get_db)):
    """Download all tenders + Go/No-Go scores as .xlsx"""
    from datetime import datetime
    fn = f"appels_offres_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_tenders(db), fn)


@router.get("/actions")
def download_actions(db: Session = Depends(get_db)):
    """Download agent actions report as .xlsx"""
    from datetime import datetime
    fn = f"actions_agents_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_actions(db), fn)


@router.get("/deliverables")
def download_deliverables(db: Session = Depends(get_db)):
    """Download deliverables status report as .xlsx"""
    from datetime import datetime
    fn = f"livrables_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_deliverables(db), fn)


@router.get("/full-report")
def download_full_report(db: Session = Depends(get_db)):
    """Download complete multi-sheet report as .xlsx"""
    from datetime import datetime
    fn = f"datasphere_rapport_complet_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return _xlsx_response(export_full_report(db), fn)
