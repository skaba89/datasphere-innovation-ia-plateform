from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class WorkItem(Base):
    __tablename__ = "work_items"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    assignment_id = Column(Integer, ForeignKey("agent_assignments.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="CASCADE"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    category = Column(String(120), nullable=False, default="analysis", index=True)
    objective = Column(Text, nullable=False)
    input_context = Column(Text, nullable=True)
    expected_output = Column(Text, nullable=True)
    recommended_next_step = Column(Text, nullable=True)
    result_summary = Column(Text, nullable=True)

    priority = Column(String(80), nullable=False, default="Moyenne", index=True)
    status = Column(String(80), nullable=False, default="draft", index=True)
    needs_review = Column(Boolean, nullable=False, default=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    due_at = Column(DateTime, nullable=True)
    created_by = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
