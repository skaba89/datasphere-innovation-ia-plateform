from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class Deliverable(Base):
    __tablename__ = "deliverables"

    id = Column(Integer, primary_key=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="SET NULL"), nullable=True, index=True)
    assignment_id = Column(Integer, ForeignKey("agent_assignments.id", ondelete="SET NULL"), nullable=True, index=True)
    action_id = Column(Integer, ForeignKey("agent_actions.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    deliverable_type = Column(String(120), nullable=False, default="note_cadrage", index=True)
    status = Column(String(80), nullable=False, default="draft", index=True)
    version = Column(Integer, nullable=False, default=1)
    language = Column(String(20), nullable=False, default="fr")
    audience = Column(String(120), nullable=True)
    summary = Column(Text, nullable=True)
    content_markdown = Column(Text, nullable=False)
    tags = Column(String(500), nullable=True)

    generated_by = Column(String(255), nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    approved_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    workspace_id     = Column(Integer, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_email = Column(String(255), nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
