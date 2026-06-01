from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.audit_log import list_audit_logs
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
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Return audit logs with optional filters."""
    return list_audit_logs(
        db,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        skip=skip,
        limit=limit,
    )
