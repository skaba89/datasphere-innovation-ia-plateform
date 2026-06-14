from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db

from app.api.v1.endpoints import (
    settings_admin,
    consultant_experiences,
    crm_automation,
    activity, agent_actions, agents, analytics, api_keys, audit_logs,
    csv_import,
    auth, billing, calculator, contact, contacts, data_mission, deliverables,
    cv_generator, email_api, linkedin_oauth, excel_export, export, reports,
    health_monitor, linkedin, notifications, opportunities, organizations, pdf_ao,
    providers, scheduler, search, sector_templates, sse,
    staffing, suggestions, team, tender_governance, tender_templates,
    setup, tender_watch, tenders, uploads, webhooks, workflow, workspaces,
)

router = APIRouter()

router.include_router(auth.router)
router.include_router(billing.router)
router.include_router(api_keys.router)
router.include_router(csv_import.router)
router.include_router(setup.router)
router.include_router(webhooks.router)
router.include_router(workflow.router)
router.include_router(calculator.router)
router.include_router(cv_generator.router)
router.include_router(linkedin_oauth.router)
router.include_router(reports.router)
router.include_router(email_api.router)
router.include_router(linkedin.router)
router.include_router(pdf_ao.router)
router.include_router(contact.router)
router.include_router(team.router)
router.include_router(organizations.router)
router.include_router(contacts.router)
router.include_router(opportunities.router)
router.include_router(tenders.router)
router.include_router(tender_governance.router)
router.include_router(tender_templates.router)
router.include_router(tender_watch.router)
router.include_router(staffing.router)
router.include_router(data_mission.router)
router.include_router(agents.router)
router.include_router(agent_actions.router)
router.include_router(deliverables.router)
router.include_router(scheduler.router)
router.include_router(analytics.router)
router.include_router(audit_logs.router)
router.include_router(export.router)
router.include_router(excel_export.router)
router.include_router(sector_templates.router)
router.include_router(search.router)
router.include_router(activity.router)
router.include_router(notifications.router)
router.include_router(crm_automation.router)
router.include_router(consultant_experiences.router)
router.include_router(settings_admin.router)
router.include_router(sse.router)
router.include_router(suggestions.router)
router.include_router(health_monitor.router)
router.include_router(providers.router)
router.include_router(uploads.router)
router.include_router(workspaces.router)


@router.get("/health", tags=["health"])
def health_check(db: Session = Depends(get_db)) -> dict:
    """Detailed system health — DB, LLM provider, scheduler, cache."""
    import time
    from app.services.cache_service import cache_stats

    # DB check
    db_ok = False
    db_latency_ms = None
    try:
        from sqlalchemy import text
        t0 = time.monotonic()
        db.execute(text("SELECT 1")).scalar()
        db_latency_ms = round((time.monotonic() - t0) * 1000, 1)
        db_ok = True
    except Exception as e:
        db_error = str(e)[:80]
    else:
        db_error = None

    # LLM provider
    provider_name = "simulation"
    provider_ok   = False
    try:
        from app.services.llm_service import provider_label
        provider_name = provider_label()
        provider_ok   = provider_name not in ("simulation", "none", "", None)
    except Exception:
        pass

    # Scheduler
    scheduler_ok = False
    try:
        from app.services.scheduler_service import get_scheduler
        sched = get_scheduler()
        scheduler_ok = sched.running
    except Exception:
        pass

    # Cache
    cache = cache_stats()

    overall = "ok" if db_ok else "degraded"

    return {
        "status":    overall,
        "version":   "2.3.0",
        "service":   "datasphere-platform-api",
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "components": {
            "database":  {"ok": db_ok,       "latency_ms": db_latency_ms, "error": db_error},
            "llm":       {"ok": provider_ok, "provider": provider_name},
            "scheduler": {"ok": scheduler_ok},
            "cache":     {"ok": True, **cache},
        },
    }


@router.get("/version", tags=["health"])
def version() -> dict[str, str]:
    return {"version": "2.3.0", "stage": "production-ready"}
