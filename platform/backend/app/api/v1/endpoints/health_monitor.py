"""
Health Monitor — comprehensive system status check.
DB ping, scheduler state, LLM provider availability, disk/memory (where available).
"""

from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(
    prefix="/health",
    tags=["health"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/detailed")
def detailed_health(db: Session = Depends(get_db)):
    """Return detailed health status of all platform components."""
    from app.core.config import get_settings
    from app.services.scheduler_service import get_scheduler
    from app.services.llm_service import provider_label
    from app.models.user import User
    from app.models.opportunity import Opportunity
    from app.models.deliverable import Deliverable

    settings = get_settings()
    checks = {}
    overall = "healthy"

    # ── Database ─────────────────────────────────────────────────────────────
    try:
        user_count = db.query(User).count()
        opp_count = db.query(Opportunity).count()
        deliv_count = db.query(Deliverable).count()
        checks["database"] = {
            "status": "up",
            "users": user_count,
            "opportunities": opp_count,
            "deliverables": deliv_count,
        }
    except Exception as exc:
        checks["database"] = {"status": "error", "error": str(exc)}
        overall = "degraded"

    # ── Scheduler ────────────────────────────────────────────────────────────
    try:
        sched = get_scheduler()
        jobs = sched.get_jobs() if sched.running else []
        checks["scheduler"] = {
            "status": "running" if sched.running else "stopped",
            "jobs": len(jobs),
            "job_ids": [j.id for j in jobs],
            "enabled": settings.scheduler_enabled,
        }
        if settings.scheduler_enabled and not sched.running:
            overall = "degraded"
    except Exception as exc:
        checks["scheduler"] = {"status": "error", "error": str(exc)}

    # ── LLM Providers ────────────────────────────────────────────────────────
    from app.services.llm_service import list_providers as _list_providers
    all_providers = _list_providers()
    llm_mode = provider_label()
    configured_providers = [p for p in all_providers if p["configured"]]
    free_active = [p for p in configured_providers if p["tier"] in ("free", "near-free")]
    checks["llm"] = {
        "status": "simulation" if llm_mode == "simulation" else "live",
        "active_provider": llm_mode,
        "configured_count": len(configured_providers),
        "total_providers": len(all_providers),
        "free_providers_active": len(free_active),
        "fallback_chain": [p["name"] for p in configured_providers],
        "providers": [
            {
                "name": p["name"],
                "label": p["label"],
                "tier": p["tier"],
                "tier_label": p["tier_label"],
                "configured": p["configured"],
                "active_model": p["active_model"],
            }
            for p in all_providers
        ],
    }

    # ── SMTP ─────────────────────────────────────────────────────────────────
    checks["smtp"] = {
        "status": "configured" if settings.smtp_enabled else "preview_only",
        "host": settings.smtp_host or None,
        "port": settings.smtp_port if settings.smtp_enabled else None,
    }

    # ── Pending approvals (governance) ───────────────────────────────────────
    try:
        from app.crud.scheduler_log import count_pending_approvals
        pending = count_pending_approvals(db)
        checks["governance"] = {
            "status": "ok" if pending == 0 else "attention",
            "pending_approvals": pending,
        }
        if pending > 10:
            overall = "attention"
    except Exception:
        pass

    return {
        "overall": overall,
        "version": "1.6.0",
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
