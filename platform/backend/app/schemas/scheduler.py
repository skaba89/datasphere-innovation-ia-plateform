from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchedulerLogRead(BaseModel):
    id: int
    job_id: str
    job_name: str
    status: str
    items_processed: int
    error_message: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None

    model_config = ConfigDict(from_attributes=True)


class JobInfo(BaseModel):
    id: str
    name: str
    next_run_time: datetime | None = None
    trigger: str


class SchedulerStatus(BaseModel):
    running: bool
    jobs: list[JobInfo]
    pending_approvals_count: int
    timezone: str
