"""
Scheduler Service — APScheduler with 4 autonomous background jobs.

Jobs:
  auto_execute  — every N min: execute auto_ready actions without human intervention
  auto_plan     — every N min: auto-plan new assignments that have no actions yet
  auto_draft    — every N min: auto-generate deliverable drafts from completed actions
  daily_report  — daily 07:00: log pipeline statistics

Human validation gate:
  Actions with requires_human_approval=True and no approved_by are NEVER executed
  automatically. They appear in the pending-approvals inbox for human review.
"""

from __future__ import annotations

import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scheduler instance (module-level singleton)
# ---------------------------------------------------------------------------

_scheduler = BackgroundScheduler(
    jobstores={"default": MemoryJobStore()},
    job_defaults={
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 120,
    },
)


def get_scheduler() -> BackgroundScheduler:
    return _scheduler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(db, job_id: str, job_name: str, status: str, count: int, error: str | None, started: datetime) -> None:
    from app.crud.scheduler_log import create_log
    finished = datetime.utcnow()
    ms = int((finished - started).total_seconds() * 1000)
    create_log(
        db,
        job_id=job_id,
        job_name=job_name,
        status=status,
        items_processed=count,
        error_message=error,
        started_at=started,
        finished_at=finished,
        duration_ms=ms,
    )


# ---------------------------------------------------------------------------
# Job 1 — Execute pending auto_ready actions
# ---------------------------------------------------------------------------

def _execute_pending_actions_job() -> None:
    """
    Execute all auto_ready actions that do NOT require human approval,
    plus actions that have already been approved.
    Human-approval-required actions without approval are skipped.
    """
    from app.db.session import SessionLocal
    from app.models.agent import AgentAction
    from app.crud.agent import mark_action_executed
    from app.services.agent_executor import execute_action

    settings = get_settings()
    db = SessionLocal()
    started = datetime.utcnow()
    count = 0
    error_msg = None

    try:
        eligible = (
            db.query(AgentAction)
            .filter(
                AgentAction.status.in_(["auto_ready", "approved"]),
                AgentAction.executed_at.is_(None),
            )
            .filter(
                # Either approval not required OR already approved
                (AgentAction.requires_human_approval == False) |  # noqa: E712
                (AgentAction.approved_by.isnot(None))
            )
            .limit(settings.scheduler_max_actions_per_run)
            .all()
        )

        for action in eligible:
            try:
                result, next_step = execute_action(db, action)
                mark_action_executed(db, action, result, next_step)
                count += 1
                logger.info("Scheduler executed action #%d [%s]", action.id, action.action_type)
            except Exception as exc:
                action.status = "failed"
                action.result_summary = f"Erreur scheduler : {exc}"
                db.add(action)
                db.commit()
                logger.error("Action #%d failed in scheduler: %s", action.id, exc)

        status = "success"
    except Exception as exc:
        error_msg = str(exc)
        status = "error"
        logger.error("Job auto_execute failed: %s", exc)
    finally:
        _log(db, "auto_execute", "Exécution actions automatiques", status, count, error_msg, started)
        db.close()


# ---------------------------------------------------------------------------
# Job 2 — Auto-plan new assignments
# ---------------------------------------------------------------------------

def _auto_plan_assignments_job() -> None:
    """
    Find assignments in 'planned' status with no actions and auto-plan them.
    """
    from app.db.session import SessionLocal
    from app.models.agent import AgentAction, AgentAssignment
    from app.crud.agent import create_action
    from app.services.agent_action_engine import build_default_actions_for_assignment

    db = SessionLocal()
    started = datetime.utcnow()
    count = 0
    error_msg = None

    try:
        # Subquery: assignment IDs that already have actions
        has_actions = db.query(AgentAction.assignment_id).distinct().subquery()

        unplanned = (
            db.query(AgentAssignment)
            .filter(
                AgentAssignment.status == "planned",
                AgentAssignment.id.notin_(has_actions),
            )
            .limit(5)
            .all()
        )

        for assignment in unplanned:
            actions_to_create = build_default_actions_for_assignment(assignment)
            for action_payload in actions_to_create:
                create_action(db, action_payload)
            assignment.status = "in_progress"
            db.add(assignment)
            db.commit()
            count += 1
            logger.info("Scheduler auto-planned assignment #%d", assignment.id)

        status = "success"
    except Exception as exc:
        error_msg = str(exc)
        status = "error"
        logger.error("Job auto_plan failed: %s", exc)
    finally:
        _log(db, "auto_plan", "Auto-planification des affectations", status, count, error_msg, started)
        db.close()


# ---------------------------------------------------------------------------
# Job 3 — Auto-generate deliverable drafts
# ---------------------------------------------------------------------------

def _auto_generate_drafts_job() -> None:
    """
    For assignments where context_analysis is done but no deliverable exists,
    auto-generate a draft deliverable.
    """
    from app.db.session import SessionLocal
    from app.models.agent import AgentAction, AgentAssignment
    from app.models.deliverable import Deliverable
    from app.crud.deliverable import create_deliverable
    from app.schemas.deliverable import DeliverableCreate
    from app.services.deliverable_draft_engine import (
        build_context_label, build_draft_title, generate_draft_content,
    )

    db = SessionLocal()
    started = datetime.utcnow()
    count = 0
    error_msg = None

    try:
        # Assignments where context_analysis is done
        done_assignment_ids = (
            db.query(AgentAction.assignment_id)
            .filter(
                AgentAction.action_type == "context_analysis",
                AgentAction.status == "done",
            )
            .distinct()
            .subquery()
        )

        # Assignments that already have a deliverable
        has_deliverable_ids = (
            db.query(Deliverable.assignment_id)
            .filter(Deliverable.assignment_id.isnot(None))
            .distinct()
            .subquery()
        )

        eligible = (
            db.query(AgentAssignment)
            .filter(
                AgentAssignment.id.in_(done_assignment_ids),
                AgentAssignment.id.notin_(has_deliverable_ids),
            )
            .limit(3)
            .all()
        )

        for assignment in eligible:
            try:
                # Pick best deliverable type
                dtype = "memoire_technique" if assignment.tender_id else "note_cadrage"
                context_label = build_context_label(
                    db,
                    assignment.opportunity_id,
                    assignment.tender_id,
                    assignment.id,
                    None,
                )
                # Get agent slug for generated_by
                agent_slug = "scheduler"
                if assignment.agent_id:
                    from app.models.agent import AgentProfile
                    agent = db.query(AgentProfile).filter(AgentProfile.id == assignment.agent_id).first()
                    if agent:
                        agent_slug = f"scheduler/{agent.slug}"

                payload = DeliverableCreate(
                    assignment_id=assignment.id,
                    opportunity_id=assignment.opportunity_id,
                    tender_id=assignment.tender_id,
                    title=build_draft_title(dtype, context_label),
                    deliverable_type=dtype,
                    content_markdown=generate_draft_content(dtype, context_label),
                    generated_by=agent_slug,
                    summary=f"Brouillon auto-généré par le scheduler pour l'affectation #{assignment.id}.",
                    status="draft",
                )
                create_deliverable(db, payload)
                count += 1
                logger.info("Scheduler auto-generated draft for assignment #%d", assignment.id)
            except Exception as exc:
                logger.error("Draft generation failed for assignment #%d: %s", assignment.id, exc)

        status = "success"
    except Exception as exc:
        error_msg = str(exc)
        status = "error"
        logger.error("Job auto_draft failed: %s", exc)
    finally:
        _log(db, "auto_draft", "Génération automatique de livrables", status, count, error_msg, started)
        db.close()


# ---------------------------------------------------------------------------
# Job 4 — Daily pipeline report
# ---------------------------------------------------------------------------

def _daily_report_job() -> None:
    """Log daily pipeline statistics and push system notifications."""
    from app.db.session import SessionLocal
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender
    from app.models.deliverable import Deliverable
    from app.models.agent import AgentAction
    from app.crud.notification import push_approval_required, push_deadline_warning, count_unread

    db = SessionLocal()
    started = datetime.utcnow()
    error_msg = None

    try:
        opp_count = db.query(Opportunity).count()
        tender_count = db.query(Tender).count()
        deliverable_count = db.query(Deliverable).count()
        approved_deliverables = db.query(Deliverable).filter(Deliverable.status == "approved").count()

        # Pending approval actions — push one notification per unprocessed action
        pending_actions = (
            db.query(AgentAction)
            .filter(
                AgentAction.requires_human_approval == True,  # noqa: E712
                AgentAction.approved_by.is_(None),
                AgentAction.status.in_(["auto_ready", "suggested"]),
            )
            .all()
        )

        notif_pushed = 0
        for action in pending_actions:
            try:
                push_approval_required(db, action.id, action.title)
                notif_pushed += 1
            except Exception:
                pass

        # Deadline warnings — tenders with upcoming deadlines
        from datetime import timedelta
        from app.crud.notification import push_deadline_warning

        upcoming_tenders = (
            db.query(Tender)
            .filter(
                Tender.submission_deadline.isnot(None),
                Tender.submission_deadline >= datetime.utcnow(),
                Tender.submission_deadline <= datetime.utcnow() + timedelta(days=7),
                Tender.status != "submitted",
            )
            .all()
        )

        for tender in upcoming_tenders:
            days_left = (tender.submission_deadline - datetime.utcnow()).days
            try:
                push_deadline_warning(db, tender.id, tender.reference or tender.title, days_left)
            except Exception:
                pass

        failed_actions = db.query(AgentAction).filter(AgentAction.status == "failed").count()

        summary = (
            f"Pipeline : {opp_count} opportunités, {tender_count} AO, "
            f"{deliverable_count} livrables dont {approved_deliverables} approuvés. "
            f"Actions en attente : {len(pending_actions)} ({notif_pushed} notifs envoyées). "
            f"Deadlines proches : {len(upcoming_tenders)}. "
            f"Actions échouées : {failed_actions}."
        )
        logger.info("Daily report — %s", summary)
        status = "success"
    except Exception as exc:
        error_msg = str(exc)
        status = "error"
        logger.error("Daily report job failed: %s", exc)
    finally:
        _log(db, "daily_report", "Rapport journalier pipeline", status, 1, error_msg, started)
        db.close()


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def _boamp_scan_job() -> None:
    """Daily BOAMP scan — fetches new public tenders and creates pending suggestions."""
    from app.db.session import SessionLocal
    from app.services.suggestion_service import suggest_from_boamp

    db = SessionLocal()
    started = datetime.utcnow()
    error_msg = None
    count = 0
    try:
        result = suggest_from_boamp(db, days_back=2, max_results=15, min_score=0.4)
        count = result.get("created_tenders", 0)
        logger.info("BOAMP scan: %s", result)
        status = "success"
    except Exception as exc:
        error_msg = str(exc)
        status = "error"
        logger.error("BOAMP scan job failed: %s", exc)
    finally:
        _log(db, "boamp_scan", "Veille BOAMP — suggestions AO", status, count, error_msg, started)
        db.close()


def start() -> None:
    """Start the scheduler and register all jobs."""
    if _scheduler.running:
        return

    settings = get_settings()
    if not settings.scheduler_enabled:
        logger.info("Scheduler is disabled (SCHEDULER_ENABLED=false)")
        return

    tz = settings.scheduler_timezone

    _scheduler.add_job(
        _execute_pending_actions_job,
        trigger="interval",
        minutes=settings.scheduler_auto_execute_interval_minutes,
        id="auto_execute",
        name="Exécution actions automatiques",
        timezone=tz,
        replace_existing=True,
    )
    _scheduler.add_job(
        _auto_plan_assignments_job,
        trigger="interval",
        minutes=settings.scheduler_auto_plan_interval_minutes,
        id="auto_plan",
        name="Auto-planification des affectations",
        timezone=tz,
        replace_existing=True,
    )
    _scheduler.add_job(
        _auto_generate_drafts_job,
        trigger="interval",
        minutes=settings.scheduler_auto_draft_interval_minutes,
        id="auto_draft",
        name="Génération automatique de livrables",
        timezone=tz,
        replace_existing=True,
    )
    _scheduler.add_job(
        _daily_report_job,
        trigger="cron",
        hour=settings.scheduler_daily_report_hour,
        minute=0,
        id="daily_report",
        name="Rapport journalier pipeline",
        timezone=tz,
        replace_existing=True,
    )

    # BOAMP scan — daily at 6am (1 hour before the daily report)
    if getattr(settings, "boamp_scan_enabled", True):
        _scheduler.add_job(
            _boamp_scan_job,
            trigger="cron",
            hour=max(settings.scheduler_daily_report_hour - 1, 0),
            minute=0,
            id="boamp_scan",
            name="Veille BOAMP — suggestions AO",
            timezone=tz,
            replace_existing=True,
        )

    _scheduler.start()
    logger.info(
        "Scheduler started — %d jobs registered (provider: %s)",
        len(_scheduler.get_jobs()),
        __import__("app.services.llm_service", fromlist=["provider_label"]).provider_label(),
    )


def stop() -> None:
    """Stop the scheduler gracefully."""
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def trigger_job(job_id: str) -> bool:
    """Trigger a job manually. Returns True if the job was found and triggered."""
    job = _scheduler.get_job(job_id)
    if job is None:
        return False
    job.modify(next_run_time=datetime.now())
    return True
