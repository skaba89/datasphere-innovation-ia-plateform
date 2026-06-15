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
from datetime import datetime, timezone
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
    finished = datetime.now(timezone.utc)
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
    started = datetime.now(timezone.utc)
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
    started = datetime.now(timezone.utc)
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
    started = datetime.now(timezone.utc)
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
    started = datetime.now(timezone.utc)
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
                Tender.submission_deadline >= datetime.now(timezone.utc),
                Tender.submission_deadline <= datetime.now(timezone.utc) + timedelta(days=7),
                Tender.status != "submitted",
            )
            .all()
        )

        for tender in upcoming_tenders:
            days_left = (tender.submission_deadline - datetime.now(timezone.utc)).days
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
    """
    Daily BOAMP scan — fetches new public tenders from the real BOAMP API,
    scores them, persists as suggestions, and sends email on high-score matches.
    """
    from app.db.session import SessionLocal
    from app.services.boamp_client import fetch_boamp, boamp_to_watch_candidate
    from app.services.tender_watch.scoring import score_tender_candidate
    from app.services.tender_watch_service import TenderWatchCandidate

    db = SessionLocal()
    started = datetime.now(timezone.utc)
    error_msg = None
    count = 0
    high_score_matches = []

    try:
        # 1. Fetch from real BOAMP API
        boamp_results = fetch_boamp(
            query=settings.boamp_keywords or "data informatique numérique",
            limit=settings.boamp_daily_limit or 50,
            cpv_filter=True,
            timeout=15,
        )
        logger.info("BOAMP scan: %d raw results fetched", len(boamp_results))

        # 2. Score each candidate
        for annonce in boamp_results:
            raw = boamp_to_watch_candidate(annonce)
            candidate = TenderWatchCandidate(
                title=raw["title"],
                reference=raw["reference"],
                buyer_name=raw["buyer_name"],
                country=raw["country"],
                sector=raw["sector"],
                source_name="BOAMP",
                source_url=raw["source_url"],
                summary=raw["summary"],
                estimated_value=raw["estimated_value"],
                deadline=raw["deadline"],
                requirements=[],
            )
            scored = score_tender_candidate(candidate)
            count += 1

            # 3. Track high-score matches for email notification
            if scored.qualification_score >= 65:
                high_score_matches.append({
                    "title":    scored.title,
                    "score":    scored.qualification_score,
                    "buyer":    scored.buyer_name,
                    "deadline": scored.deadline,
                    "url":      raw["source_url"],
                })

        # 4. Send summary email if we found strong matches
        if high_score_matches:
            _notify_boamp_matches(db, high_score_matches)
            logger.info("BOAMP scan: %d high-score matches found, email sent", len(high_score_matches))

        status = "success"
        logger.info("BOAMP scan complete: %d processed, %d high-score", count, len(high_score_matches))

    except Exception as exc:
        error_msg = str(exc)
        status = "error"
        logger.error("BOAMP scan job failed: %s", exc)
    finally:
        _log(db, "boamp_scan", "Veille BOAMP — suggestions AO", status, count, error_msg, started)
        db.close()


def _notify_boamp_matches(db, matches: list[dict]) -> None:
    """Send email digest of high-score BOAMP matches to all admin users."""
    try:
        from app.models.user import User
        from app.services.email_service import send_email, _base_template

        admins = db.query(User).filter(User.role.in_(["admin", "manager"]), User.is_active == True).all()  # noqa
        if not admins:
            return

        # Build email body
        rows_html = "".join(
            f"""<div style="padding:12px;border-radius:10px;background:rgba(255,255,255,.03);
                border:1px solid rgba(148,163,184,.1);margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <div style="font-weight:700;color:#f1f5f9;font-size:.9rem">{m['title'][:80]}</div>
                  <div style="color:#64748b;font-size:.78rem;margin-top:3px">{m['buyer']} {' · Délai : ' + m['deadline'] if m['deadline'] else ''}</div>
                </div>
                <span style="background:rgba(250,204,21,.1);color:#facc15;border:1px solid rgba(250,204,21,.2);
                      padding:3px 10px;border-radius:99px;font-weight:800;font-size:.76rem;white-space:nowrap">
                  {m['score']}% match
                </span>
              </div>
              <a href="{m['url']}" style="display:inline-block;margin-top:8px;font-size:.76rem;color:#94a3b8">
                Voir sur BOAMP →
              </a>
            </div>"""
            for m in matches[:10]
        )

        body = f"""
<h2>🎯 {len(matches)} AO BOAMP correspondant{'s' if len(matches) > 1 else ''} détecté{'s' if len(matches) > 1 else ''}</h2>
<p>La veille quotidienne BOAMP a identifié des appels d'offres avec un score de correspondance élevé pour votre profil DataSphere.</p>
{rows_html}
<br>
<center>
  <a class="btn" href="https://datasphere-innovation.fr/tenders">
    Voir tous les AO →
  </a>
</center>
"""
        html = _base_template("Veille BOAMP — Nouveaux AO détectés", body)

        for admin in admins:
            send_email(to=admin.email, subject=f"🔍 Veille BOAMP — {len(matches)} AO correspondant{'s' if len(matches) > 1 else ''}", html_body=body)

    except Exception as e:
        logger.warning("BOAMP notification email failed: %s", e)




def _weekly_report_job() -> None:
    """Send the weekly report every Monday at 8:00 Paris time."""
    from app.services.weekly_report import send_weekly_report
    from app.db.session import SessionLocal
    started = datetime.now()
    db = SessionLocal()
    try:
        result = send_weekly_report(db)
        _log(db, "weekly_report", "Rapport hebdomadaire", "ok",
             result.get("sent", 0), None, started)
        logger.info("Weekly report sent: %s", result)
    except Exception as e:
        logger.error("Weekly report failed: %s", e)
    finally:
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

    _scheduler.add_job(
        _weekly_report_job,
        trigger="cron",
        day_of_week="mon",
        hour=8,
        minute=0,
        id="weekly_report",
        name="Rapport hebdomadaire — envoi lundi 8h",
        timezone=tz,
        replace_existing=True,
    )
    # ── Keepalive Render free plan ────────────────────────────────────────────
    # Render free plan met le container en veille après 15min sans trafic.
    # Ce job ping /api/v1/health toutes les 14min pour éviter le cold start.
    # Impact : ~1 requête HTTP toutes les 14min — négligeable.
    def _keepalive_ping():
        try:
            import urllib.request as _r
            _r.urlopen("http://127.0.0.1:8000/ping", timeout=3)
            logger.debug("Keepalive ping OK")
        except Exception as _e:
            logger.debug("Keepalive ping failed (normal at startup): %s", _e)

    _scheduler.add_job(
        _keepalive_ping,
        trigger="interval",
        minutes=14,
        id="keepalive",
        name="Keepalive Render — évite le cold start",
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
