from datetime import datetime

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def write_log(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: int | None = None,
    resource_label: str | None = None,
    user_email: str | None = None,
    actor_name: str | None = None,
    detail: str | None = None,
    status: str = "success",
) -> AuditLog:
    log = AuditLog(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_label=resource_label,
        user_email=user_email,
        actor_name=actor_name,
        detail=detail,
        status=status,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def list_audit_logs(
    db: Session,
    resource_type: str | None = None,
    resource_id: int | None = None,
    action: str | None = None,
    limit: int = 100,
    skip: int = 0,
) -> list[AuditLog]:
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id is not None:
        query = query.filter(AuditLog.resource_id == resource_id)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.offset(skip).limit(limit).all()
