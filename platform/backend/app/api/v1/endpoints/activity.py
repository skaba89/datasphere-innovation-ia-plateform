"""
Activity feed — recent actions across the entire platform.
Aggregates audit logs + scheduler logs + deliverable approvals
into a unified timeline for the dashboard.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(
    prefix="/activity",
    tags=["activity"],
    dependencies=[Depends(get_current_user)],
)

_TYPE_ICONS = {
    "CREATE":     "➕",
    "UPDATE":     "✏️",
    "DELETE":     "🗑️",
    "APPROVE":    "✅",
    "PLAN":       "📋",
    "EXECUTE":    "⚡",
    "INVITE":     "👤",
    "DEACTIVATE": "🚫",
    "snapshot":   "📷",
    "scheduler":  "🤖",
    "login":      "🔐",
}

_TYPE_COLORS = {
    "APPROVE": "#22c55e",
    "EXECUTE": "#8b5cf6",
    "PLAN":    "#3b82f6",
    "CREATE":  "#facc15",
    "INVITE":  "#06b6d4",
    "scheduler": "#64748b",
}


@router.get("/feed")
def activity_feed(
    limit: int = 30,
    days: int = 7,
    db: Session = Depends(get_db),
):
    """
    Return a unified activity feed for the last N days.
    Combines audit_logs + scheduler_logs + deliverable events.
    """
    from app.models.audit_log import AuditLog
    from app.models.scheduler_log import SchedulerLog
    from app.models.deliverable import Deliverable

    since = datetime.now(timezone.utc) - timedelta(days=days)
    items = []

    # Audit logs
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.created_at >= since)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    for log in audit_logs:
        items.append({
            "id": f"audit-{log.id}",
            "source": "audit",
            "action": log.action,
            "icon": _TYPE_ICONS.get(log.action, "📌"),
            "color": _TYPE_COLORS.get(log.action, "#94a3b8"),
            "title": _audit_title(log),
            "detail": log.detail or "",
            "actor": log.actor_name or log.user_email or "Système",
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "timestamp": log.created_at.isoformat(),
            "status": log.status,
        })

    # Scheduler executions (success only, capped)
    sched_logs = (
        db.query(SchedulerLog)
        .filter(
            SchedulerLog.started_at >= since,
            SchedulerLog.status == "success",
            SchedulerLog.items_processed > 0,
        )
        .order_by(SchedulerLog.started_at.desc())
        .limit(10)
        .all()
    )
    for log in sched_logs:
        items.append({
            "id": f"sched-{log.id}",
            "source": "scheduler",
            "action": "scheduler",
            "icon": "🤖",
            "color": "#64748b",
            "title": f"Scheduler — {log.job_name}",
            "detail": f"{log.items_processed} élément(s) traité(s) en {log.duration_ms or 0}ms",
            "actor": "APScheduler",
            "resource_type": "scheduler_job",
            "resource_id": None,
            "timestamp": log.started_at.isoformat(),
            "status": "success",
        })

    # Recent deliverable approvals
    approved = (
        db.query(Deliverable)
        .filter(
            Deliverable.approved_at >= since,
            Deliverable.status == "approved",
        )
        .order_by(Deliverable.approved_at.desc())
        .limit(10)
        .all()
    )
    for d in approved:
        items.append({
            "id": f"deliv-{d.id}",
            "source": "deliverable",
            "action": "APPROVE",
            "icon": "✅",
            "color": "#22c55e",
            "title": f"Livrable approuvé — {d.title}",
            "detail": f"Type : {d.deliverable_type} · v{d.version}",
            "actor": d.approved_by or "Admin",
            "resource_type": "deliverable",
            "resource_id": d.id,
            "timestamp": d.approved_at.isoformat(),
            "status": "success",
        })

    # Sort by timestamp descending
    items.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "items": items[:limit],
        "total": len(items),
        "days": days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _audit_title(log) -> str:
    labels = {
        "organization": "Organisation",
        "opportunity": "Opportunité",
        "tender": "Appel d'offres",
        "deliverable": "Livrable",
        "agent_action": "Action agent",
        "agent_assignment": "Affectation",
        "user": "Utilisateur",
        "contact": "Contact",
    }
    resource = labels.get(log.resource_type, log.resource_type)
    label = log.resource_label or f"#{log.resource_id}" if log.resource_id else ""
    action_labels = {
        "CREATE": "Création",
        "UPDATE": "Modification",
        "DELETE": "Suppression",
        "APPROVE": "Approbation",
        "PLAN": "Planification",
        "EXECUTE": "Exécution",
        "INVITE": "Invitation équipe",
        "DEACTIVATE": "Désactivation",
    }
    action = action_labels.get(log.action, log.action)
    return f"{action} · {resource} {label}".strip()
