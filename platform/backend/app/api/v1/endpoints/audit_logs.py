from app.models.user import User
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.audit_log import list_audit_logs, count_audit_logs
from app.db.session import get_db
from app.schemas.analytics import AuditLogRead

router = APIRouter(
    prefix="/audit-logs",
    tags=["audit-logs"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[AuditLogRead])
def read_audit_logs(
    resource_type: str | None = None,
    resource_id: int | None = None,
    action: str | None = None,
    user: str | None = Query(default=None, description="Filter by performed_by (partial match)"),
    date_from: str | None = Query(default=None, description="ISO date e.g. 2025-01-01"),
    date_to: str | None = Query(default=None, description="ISO date e.g. 2025-12-31"),
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
) -> list[AuditLogRead]:
    """
    Return audit logs with filters.
    Supports: resource_type, resource_id, action, user (partial), date range, pagination.
    """
    return list_audit_logs(
        db,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        user=user,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get("/count")
def count_logs(
    current_user: User = Depends(get_current_user),
    resource_type: str | None = None,
    action: str | None = None,
    user: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """Return total count of matching audit log entries."""
    total = count_audit_logs(
        db,
        resource_type=resource_type,
        action=action,
        user=user,
        date_from=date_from,
        date_to=date_to,
    )
    return {"total": total}


@router.get("/export/csv")
def export_audit_logs_csv(
    current_user: User = Depends(get_current_user),
    resource_type: str | None = None,
    action: str | None = None,
    user: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    """Export audit logs as CSV (max 2000 rows)."""
    import csv
    import io
    from datetime import datetime

    logs = list_audit_logs(
        db,
        resource_type=resource_type,
        action=action,
        user=user,
        date_from=date_from,
        date_to=date_to,
        skip=0,
        limit=2000,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Action", "Type ressource", "ID ressource", "Utilisateur", "Détails"])
    for log in logs:
        writer.writerow([
            log.id,
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "",
            log.action,
            log.resource_type or "",
            log.resource_id or "",
            log.performed_by or "",
            str(log.details or ""),
        ])

    filename = f"audit_log_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

