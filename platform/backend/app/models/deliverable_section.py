from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class DeliverableSection(Base):
    __tablename__ = "deliverable_sections"

    id = Column(Integer, primary_key=True, index=True)
    deliverable_id = Column(Integer, ForeignKey("deliverables.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    section_key = Column(String(120), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=1)
    status = Column(String(80), nullable=False, default="draft", index=True)
    content_markdown = Column(Text, nullable=False, default="")
    version = Column(Integer, nullable=False, default=1)
    owner_agent_id = Column(Integer, ForeignKey("agent_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    reviewed_by = Column(String(255), nullable=True)
    approved_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AgentContribution(Base):
    __tablename__ = "agent_contributions"

    id = Column(Integer, primary_key=True, index=True)
    deliverable_id = Column(Integer, ForeignKey("deliverables.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("deliverable_sections.id", ondelete="CASCADE"), nullable=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    action_id = Column(Integer, ForeignKey("agent_actions.id", ondelete="SET NULL"), nullable=True, index=True)
    contribution_type = Column(String(120), nullable=False, default="section_draft", index=True)
    summary = Column(Text, nullable=True)
    content_markdown = Column(Text, nullable=False, default="")
    status = Column(String(80), nullable=False, default="proposed", index=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
