from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class AgentProfile(Base):
    __tablename__ = "agent_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(120), unique=True, nullable=False, index=True)
    domain = Column(String(120), nullable=False, index=True)
    seniority = Column(String(80), nullable=False, default="senior", index=True)
    languages = Column(String(255), nullable=False, default="fr,en")
    mission_types = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=False)
    tools = Column(Text, nullable=True)
    governance_rules = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assignments = relationship("AgentAssignment", back_populates="agent", cascade="all, delete-orphan")


class AgentAssignment(Base):
    __tablename__ = "agent_assignments"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="CASCADE"), nullable=True, index=True)
    assignment_type = Column(String(120), nullable=False, default="analysis", index=True)
    objective = Column(Text, nullable=False)
    expected_deliverable = Column(Text, nullable=True)
    priority = Column(String(80), nullable=False, default="Moyenne", index=True)
    status = Column(String(80), nullable=False, default="planned", index=True)
    human_reviewer = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    agent = relationship("AgentProfile", back_populates="assignments")
