from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class DeliverableVersion(Base):
    """Immutable snapshot of a deliverable at a specific version number."""

    __tablename__ = "deliverable_versions"

    id = Column(Integer, primary_key=True, index=True)
    deliverable_id = Column(
        Integer,
        ForeignKey("deliverables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content_markdown = Column(Text, nullable=False)
    status = Column(String(80), nullable=False)
    summary = Column(Text, nullable=True)
    # Who created this version
    created_by = Column(String(255), nullable=True)
    change_note = Column(Text, nullable=True)         # Optional commit message
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
