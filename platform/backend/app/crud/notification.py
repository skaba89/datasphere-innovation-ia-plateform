from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.notification import Notification


# ── Write ─────────────────────────────────────────────────────────────────────

def push(
    db: Session,
    type: str,
    title: str,
    body: str | None = None,
    priority: str = "medium",
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: int | None = None,
    action_url: str | None = None,
    ttl_hours: int | None = 72,
) -> Notification:
    """Create a new notification. ttl_hours=None means no expiry."""
    expires = datetime.now(timezone.utc) + timedelta(hours=ttl_hours) if ttl_hours else None
    n = Notification(
        user_id=user_id,
        type=type,
        priority=priority,
        title=title,
        body=body,
        resource_type=resource_type,
        resource_id=resource_id,
        action_url=action_url,
        expires_at=expires,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    # Real-time push via SSE
    try:
        from app.api.v1.endpoints.sse import push_notification_created
        push_notification_created(n.id, title, priority, user_id)
    except Exception:
        pass  # SSE failure never blocks notification creation
    return n


def push_approval_required(db: Session, action_id: int, action_title: str) -> Notification:
    return push(
        db,
        type="approval_required",
        priority="high",
        title=f"Approbation requise — {action_title}",
        body="Une action agent attend votre validation avant d'être exécutée.",
        resource_type="agent_action",
        resource_id=action_id,
        action_url=f"/operations?tab=approvals",
        ttl_hours=None,
    )


def push_deliverable_approved(db: Session, deliverable_id: int, title: str) -> Notification:
    return push(
        db,
        type="deliverable_approved",
        priority="medium",
        title=f"Livrable approuvé — {title}",
        body="Le livrable est validé et prêt pour transmission client.",
        resource_type="deliverable",
        resource_id=deliverable_id,
        action_url=f"/deliverables/{deliverable_id}",
        ttl_hours=48,
    )


def push_deadline_warning(db: Session, tender_id: int, tender_ref: str, days_left: int) -> Notification:
    priority = "high" if days_left <= 2 else "medium"
    return push(
        db,
        type="deadline",
        priority=priority,
        title=f"Deadline AO dans {days_left}j — {tender_ref}",
        body=f"La date limite de remise approche. Vérifiez l'état du dossier.",
        resource_type="tender",
        resource_id=tender_id,
        action_url=f"/tenders/{tender_id}",
        ttl_hours=days_left * 24 + 1,
    )


# ── Read ──────────────────────────────────────────────────────────────────────

def list_notifications(
    db: Session,
    user_id: int | None = None,
    unread_only: bool = False,
    limit: int = 30,
) -> list[Notification]:
    now = datetime.now(timezone.utc)
    q = (
        db.query(Notification)
        .filter(
            # Not expired
            (Notification.expires_at.is_(None)) | (Notification.expires_at > now),
        )
        .order_by(Notification.created_at.desc())
    )
    # Broadcast (user_id=None) OR user-specific
    if user_id is not None:
        q = q.filter(
            (Notification.user_id.is_(None)) | (Notification.user_id == user_id)
        )
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712
    return q.limit(limit).all()


def count_unread(db: Session, user_id: int | None = None) -> int:
    now = datetime.now(timezone.utc)
    q = db.query(Notification).filter(
        Notification.is_read == False,  # noqa: E712
        (Notification.expires_at.is_(None)) | (Notification.expires_at > now),
    )
    if user_id is not None:
        q = q.filter(
            (Notification.user_id.is_(None)) | (Notification.user_id == user_id)
        )
    return q.count()


def mark_read(db: Session, notification_id: int) -> Notification | None:
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n and not n.is_read:
        n.is_read = True
        n.read_at = datetime.now(timezone.utc)
        db.add(n)
        db.commit()
        db.refresh(n)
    return n


def mark_all_read(db: Session, user_id: int | None = None) -> int:
    q = db.query(Notification).filter(Notification.is_read == False)  # noqa: E712
    if user_id is not None:
        q = q.filter(
            (Notification.user_id.is_(None)) | (Notification.user_id == user_id)
        )
    count = q.count()
    q.update({"is_read": True, "read_at": datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return count
