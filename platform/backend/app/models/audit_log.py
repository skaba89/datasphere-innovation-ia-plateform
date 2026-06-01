from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    # Who
    user_email = Column(String(255), nullable=True, index=True)
    actor_name = Column(String(255), nullable=True)
    # What
    action = Column(String(120), nullable=False, index=True)   # e.g. CREATE, UPDATE, DELETE, APPROVE, EXECUTE
    resource_type = Column(String(120), nullable=False, index=True)  # e.g. opportunity, tender, deliverable
    resource_id = Column(Integer, nullable=True, index=True)
    resource_label = Column(String(255), nullable=True)        # human-readable name snapshot
    # Context
    detail = Column(Text, nullable=True)                       # JSON or freetext detail
    status = Column(String(80), nullable=False, default="success", index=True)  # success | error
    # When
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
