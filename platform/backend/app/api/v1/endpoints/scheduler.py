from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.scheduler_log import count_pending_approvals, list_logs
from app.db.session import get_db
from app.schemas.scheduler import JobInfo, SchedulerLogRead, SchedulerStatus
from app.services import scheduler_service

router = APIRouter(
    prefix="/scheduler",
    tags=["scheduler"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/status", response_model=SchedulerStatus)
def get_scheduler_status(db: Session = Depends(get_db)):
    """Return scheduler running state, job list and pending approvals count."""
    sched = scheduler_service.get_scheduler()
    jobs = []
    for job in sched.get_jobs():
        jobs.append(
            JobInfo(
                id=job.id,
                name=job.name,
                next_run_time=job.next_run_time,
                trigger=str(job.trigger),
            )
        )
    return SchedulerStatus(
        running=sched.running,
        jobs=jobs,
        pending_approvals_count=count_pending_approvals(db),
        timezone=str(sched.timezone) if sched.running else "Europe/Paris",
    )


@router.post("/pause", status_code=status.HTTP_204_NO_CONTENT)
def pause_scheduler():
    """Pause all scheduled jobs."""
    sched = scheduler_service.get_scheduler()
    if not sched.running:
        raise HTTPException(status_code=400, detail="Scheduler is not running")
    sched.pause()


@router.post("/resume", status_code=status.HTTP_204_NO_CONTENT)
def resume_scheduler():
    """Resume all scheduled jobs."""
    sched = scheduler_service.get_scheduler()
    if not sched.running:
        raise HTTPException(status_code=400, detail="Scheduler is not running")
    sched.resume()


@router.post("/jobs/{job_id}/trigger", status_code=status.HTTP_202_ACCEPTED)
def trigger_job(job_id: str):
    """Trigger a specific job immediately."""
    triggered = scheduler_service.trigger_job(job_id)
    if not triggered:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found",
        )
    return {"message": f"Job '{job_id}' triggered", "job_id": job_id}


@router.get("/logs", response_model=list[SchedulerLogRead])
def get_scheduler_logs(job_id: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    """Return recent scheduler execution logs."""
    return list_logs(db, job_id=job_id, limit=limit)
