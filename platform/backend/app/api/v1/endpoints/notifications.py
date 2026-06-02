from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.notification import (
    count_unread,
    list_notifications,
    mark_all_read,
    mark_read,
    push,
)
from app.db.session import get_db
from app.models.user import User

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(get_current_user)],
)


class NotificationRead(BaseModel):
    id: int
    type: str
    priority: str
    title: str
    body: str | None = None
    resource_type: str | None = None
    resource_id: int | None = None
    action_url: str | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime
    expires_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationCreate(BaseModel):
    type: str = "system"
    priority: str = "medium"
    title: str
    body: str | None = None
    resource_type: str | None = None
    resource_id: int | None = None
    action_url: str | None = None
    ttl_hours: int | None = 72


@router.get("", response_model=list[NotificationRead])
def get_notifications(
    unread_only: bool = False,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notifications for the current user (broadcast + user-specific)."""
    return list_notifications(db, user_id=current_user.id, unread_only=unread_only, limit=limit)


@router.get("/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get unread notification count — optimized for polling."""
    return {"unread": count_unread(db, user_id=current_user.id)}


@router.post("", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a broadcast notification (admin use)."""
    return push(db, **payload.model_dump())


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    n = mark_read(db, notification_id)
    if n is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    return n


@router.post("/read-all", status_code=status.HTTP_200_OK)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for current user."""
    count = mark_all_read(db, user_id=current_user.id)
    return {"marked_read": count}
