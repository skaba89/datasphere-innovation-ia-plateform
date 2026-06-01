from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Audit log ────────────────────────────────────────────────────────────────

class AuditLogRead(BaseModel):
    id: int
    user_email: str | None = None
    actor_name: str | None = None
    action: str
    resource_type: str
    resource_id: int | None = None
    resource_label: str | None = None
    detail: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Pipeline analytics ────────────────────────────────────────────────────────

class OpportunityStats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    high_priority: int
    won: int
    lost: int
    pipeline_value: float       # sum(potential_value * probability / 100)
    total_potential: float      # sum(potential_value)
    avg_probability: float


class TenderStats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_decision: dict[str, int]
    go_count: int
    no_go_count: int
    avg_go_score: float
    deadlines_this_week: int


class AgentStats(BaseModel):
    total_profiles: int
    total_assignments: int
    total_actions: int
    actions_done: int
    actions_pending: int        # auto_ready or planned not yet executed
    actions_failed: int
    actions_pending_approval: int
    completion_rate: float


class DeliverableStats(BaseModel):
    total: int
    by_status: dict[str, int]
    draft: int
    in_review: int
    approved: int
    approval_rate: float


class SchedulerStats(BaseModel):
    running: bool
    jobs_count: int
    last_execution: datetime | None
    executions_today: int
    errors_today: int


class NotificationItem(BaseModel):
    type: str          # pending_approval | deadline_approaching | review_needed
    priority: str      # high | medium | low
    title: str
    detail: str
    resource_type: str
    resource_id: int
    created_at: datetime


class PipelineAnalytics(BaseModel):
    opportunities: OpportunityStats
    tenders: TenderStats
    agents: AgentStats
    deliverables: DeliverableStats
    scheduler: SchedulerStats
    notifications: list[NotificationItem]
    computed_at: datetime
