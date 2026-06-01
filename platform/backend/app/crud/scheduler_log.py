from datetime import datetime

from sqlalchemy.orm import Session

from app.models.scheduler_log import SchedulerLog


def create_log(
    db: Session,
    job_id: str,
    job_name: str,
    status: str,
    items_processed: int = 0,
    error_message: str | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
    duration_ms: int | None = None,
) -> SchedulerLog:
    log = SchedulerLog(
        job_id=job_id,
        job_name=job_name,
        status=status,
        items_processed=items_processed,
        error_message=error_message,
        started_at=started_at or datetime.utcnow(),
        finished_at=finished_at,
        duration_ms=duration_ms,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def list_logs(db: Session, job_id: str | None = None, limit: int = 50) -> list[SchedulerLog]:
    query = db.query(SchedulerLog).order_by(SchedulerLog.started_at.desc())
    if job_id:
        query = query.filter(SchedulerLog.job_id == job_id)
    return query.limit(limit).all()


def count_pending_approvals(db: Session) -> int:
    from app.models.agent import AgentAction
    return (
        db.query(AgentAction)
        .filter(
            AgentAction.requires_human_approval == True,  # noqa: E712
            AgentAction.approved_by.is_(None),
            AgentAction.status != "done",
            AgentAction.status != "failed",
        )
        .count()
    )
