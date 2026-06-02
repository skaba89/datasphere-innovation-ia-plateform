from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    # Who it's for — None = broadcast to all
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    # Content
    type = Column(String(80), nullable=False, index=True)        # approval_required | deliverable_approved | deadline | system
    priority = Column(String(20), nullable=False, default="medium", index=True)  # high | medium | low
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    # Linked resource
    resource_type = Column(String(80), nullable=True)
    resource_id = Column(Integer, nullable=True)
    action_url = Column(String(500), nullable=True)              # frontend route hint
    # State
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    # Lifecycle
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=True)                 # auto-dismiss after this date
