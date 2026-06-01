"""
Analytics Service — Single-pass pipeline KPIs.
Aggregates data from all tables into a unified dashboard payload.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.agent import AgentAction, AgentAssignment, AgentProfile
from app.models.deliverable import Deliverable
from app.models.opportunity import Opportunity
from app.models.scheduler_log import SchedulerLog
from app.models.tender import Tender
from app.schemas.analytics import (
    AgentStats,
    DeliverableStats,
    NotificationItem,
    OpportunityStats,
    PipelineAnalytics,
    SchedulerStats,
    TenderStats,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _counts_by(db: Session, model, column) -> dict[str, int]:
    rows = db.query(column, func.count(model.id)).group_by(column).all()
    return {str(k): v for k, v in rows if k is not None}


# ---------------------------------------------------------------------------
# Sub-aggregations
# ---------------------------------------------------------------------------

def _opportunity_stats(db: Session) -> OpportunityStats:
    opps = db.query(Opportunity).all()
    total = len(opps)
    by_status: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    pipeline_value = 0.0
    total_potential = 0.0
    prob_sum = 0

    for o in opps:
        by_status[o.status] = by_status.get(o.status, 0) + 1
        by_priority[o.priority] = by_priority.get(o.priority, 0) + 1
        if o.potential_value:
            val = float(o.potential_value)
            total_potential += val
            pipeline_value += val * (o.probability or 0) / 100
        prob_sum += o.probability or 0

    return OpportunityStats(
        total=total,
        by_status=by_status,
        by_priority=by_priority,
        high_priority=by_priority.get("Haute", 0),
        won=by_status.get("Gagnée", 0),
        lost=by_status.get("Perdue", 0),
        pipeline_value=round(pipeline_value, 2),
        total_potential=round(total_potential, 2),
        avg_probability=round(prob_sum / total, 1) if total else 0.0,
    )


def _tender_stats(db: Session) -> TenderStats:
    tenders = db.query(Tender).all()
    total = len(tenders)
    by_status: dict[str, int] = {}
    by_decision: dict[str, int] = {}
    scores = []
    now = datetime.utcnow()
    week_later = now + timedelta(days=7)
    deadlines_this_week = 0

    for t in tenders:
        by_status[t.status] = by_status.get(t.status, 0) + 1
        dec = t.go_no_go_decision or "Non qualifié"
        by_decision[dec] = by_decision.get(dec, 0) + 1
        if t.go_no_go_score is not None:
            scores.append(t.go_no_go_score)
        if t.submission_deadline and now <= t.submission_deadline <= week_later:
            deadlines_this_week += 1

    return TenderStats(
        total=total,
        by_status=by_status,
        by_decision=by_decision,
        go_count=by_decision.get("Go", 0),
        no_go_count=by_decision.get("No-Go", 0),
        avg_go_score=round(sum(scores) / len(scores), 1) if scores else 0.0,
        deadlines_this_week=deadlines_this_week,
    )


def _agent_stats(db: Session) -> AgentStats:
    total_profiles = db.query(AgentProfile).count()
    total_assignments = db.query(AgentAssignment).count()
    actions = db.query(AgentAction).all()
    total_actions = len(actions)

    done = sum(1 for a in actions if a.status == "done")
    failed = sum(1 for a in actions if a.status == "failed")
    pending_approval = sum(
        1 for a in actions
        if a.requires_human_approval and a.approved_by is None
        and a.status not in ("done", "failed")
    )
    pending = sum(
        1 for a in actions
        if a.status in ("auto_ready", "suggested", "approved")
        and a.executed_at is None
    )
    completion_rate = round(done / total_actions * 100, 1) if total_actions else 0.0

    return AgentStats(
        total_profiles=total_profiles,
        total_assignments=total_assignments,
        total_actions=total_actions,
        actions_done=done,
        actions_pending=pending,
        actions_failed=failed,
        actions_pending_approval=pending_approval,
        completion_rate=completion_rate,
    )


def _deliverable_stats(db: Session) -> DeliverableStats:
    deliverables = db.query(Deliverable).all()
    total = len(deliverables)
    by_status: dict[str, int] = {}

    for d in deliverables:
        by_status[d.status] = by_status.get(d.status, 0) + 1

    approved = by_status.get("approved", 0)
    approval_rate = round(approved / total * 100, 1) if total else 0.0

    return DeliverableStats(
        total=total,
        by_status=by_status,
        draft=by_status.get("draft", 0),
        in_review=by_status.get("in_review", 0),
        approved=approved,
        approval_rate=approval_rate,
    )


def _scheduler_stats(db: Session) -> SchedulerStats:
    from app.services.scheduler_service import get_scheduler

    sched = get_scheduler()
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    last_log = (
        db.query(SchedulerLog)
        .order_by(SchedulerLog.started_at.desc())
        .first()
    )
    executions_today = (
        db.query(SchedulerLog)
        .filter(SchedulerLog.started_at >= today)
        .count()
    )
    errors_today = (
        db.query(SchedulerLog)
        .filter(SchedulerLog.started_at >= today, SchedulerLog.status == "error")
        .count()
    )

    return SchedulerStats(
        running=sched.running,
        jobs_count=len(sched.get_jobs()),
        last_execution=last_log.started_at if last_log else None,
        executions_today=executions_today,
        errors_today=errors_today,
    )


def _notifications(db: Session) -> list[NotificationItem]:
    items: list[NotificationItem] = []
    now = datetime.utcnow()

    # 1. Actions en attente d'approbation humaine
    pending_actions = (
        db.query(AgentAction)
        .filter(
            AgentAction.requires_human_approval == True,  # noqa: E712
            AgentAction.approved_by.is_(None),
            AgentAction.status != "done",
            AgentAction.status != "failed",
        )
        .order_by(AgentAction.created_at.asc())
        .all()
    )
    for action in pending_actions[:5]:  # cap at 5
        items.append(NotificationItem(
            type="pending_approval",
            priority="high",
            title=f"Approbation requise — {action.title}",
            detail=f"Action #{action.id} · Assignment #{action.assignment_id}",
            resource_type="agent_action",
            resource_id=action.id,
            created_at=action.created_at,
        ))

    # 2. Livrables en attente de review
    pending_review = (
        db.query(Deliverable)
        .filter(Deliverable.status == "in_review")
        .order_by(Deliverable.updated_at.desc())
        .all()
    )
    for d in pending_review[:3]:
        items.append(NotificationItem(
            type="review_needed",
            priority="medium",
            title=f"Révision requise — {d.title}",
            detail=f"Livrable #{d.id} · {d.deliverable_type}",
            resource_type="deliverable",
            resource_id=d.id,
            created_at=d.updated_at,
        ))

    # 3. Deadlines AO dans les 7 prochains jours
    deadline_soon = (
        db.query(Tender)
        .filter(
            Tender.submission_deadline.isnot(None),
            Tender.submission_deadline >= now,
            Tender.submission_deadline <= now + timedelta(days=7),
            Tender.status != "submitted",
            Tender.status != "cancelled",
        )
        .order_by(Tender.submission_deadline.asc())
        .all()
    )
    for t in deadline_soon[:3]:
        days_left = (t.submission_deadline - now).days
        items.append(NotificationItem(
            type="deadline_approaching",
            priority="high" if days_left <= 2 else "medium",
            title=f"Deadline AO dans {days_left}j — {t.reference or t.title}",
            detail=f"AO #{t.id} · {t.buyer_name or '?'} · {t.submission_deadline.strftime('%d/%m/%Y')}",
            resource_type="tender",
            resource_id=t.id,
            created_at=t.created_at,
        ))

    # Sort: high priority first
    items.sort(key=lambda x: (0 if x.priority == "high" else 1, x.created_at))
    return items


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_pipeline_analytics(db: Session) -> PipelineAnalytics:
    return PipelineAnalytics(
        opportunities=_opportunity_stats(db),
        tenders=_tender_stats(db),
        agents=_agent_stats(db),
        deliverables=_deliverable_stats(db),
        scheduler=_scheduler_stats(db),
        notifications=_notifications(db),
        computed_at=datetime.utcnow(),
    )
