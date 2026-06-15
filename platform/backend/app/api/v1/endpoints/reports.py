"""
Reports endpoints — Weekly report, stats export
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/weekly/preview")
def preview_weekly_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preview the weekly HTML report (for testing)."""
    from app.services.weekly_report import generate_weekly_report_html
    from fastapi.responses import HTMLResponse
    html = generate_weekly_report_html(db)
    return HTMLResponse(content=html)


@router.post("/weekly/send")
def send_weekly_report_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually trigger the weekly report (admin only)."""
    if current_user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    from app.services.weekly_report import send_weekly_report
    return send_weekly_report(db)


@router.post("/deadline-alert")
def send_deadline_alert_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Envoie manuellement les alertes deadline (admin only)."""
    if current_user.role != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    from app.services.weekly_report import send_deadline_alerts
    return send_deadline_alerts(db)
