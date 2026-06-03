from datetime import datetime, timezone
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
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def _build_query(
    db: Session,
    resource_type: str | None = None,
    resource_id: int | None = None,
    action: str | None = None,
    user: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id is not None:
        query = query.filter(AuditLog.resource_id == resource_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if user:
        query = query.filter(
            (AuditLog.user_email.ilike(f"%{user}%"))
            | (AuditLog.actor_name.ilike(f"%{user}%"))
        )
    if date_from:
        try:
            query = query.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.filter(AuditLog.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass
    return query


def list_audit_logs(
    db: Session,
    resource_type: str | None = None,
    resource_id: int | None = None,
    action: str | None = None,
    user: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    skip: int = 0,
) -> list[AuditLog]:
    return _build_query(db, resource_type, resource_id, action, user, date_from, date_to).offset(skip).limit(limit).all()


def count_audit_logs(
    db: Session,
    resource_type: str | None = None,
    action: str | None = None,
    user: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> int:
    return _build_query(db, resource_type, None, action, user, date_from, date_to).count()

