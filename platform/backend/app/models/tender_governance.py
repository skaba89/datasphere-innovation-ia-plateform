from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class GoNoGoCriterion(Base):
    __tablename__ = "go_no_go_criteria"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    score = Column(Integer, nullable=False, default=0)
    weight = Column(Integer, nullable=False, default=1)
    max_score = Column(Integer, nullable=False, default=5)
    rationale = Column(Text, nullable=True)
    recommendation = Column(String(80), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tender = relationship("Tender")


class ComplianceMatrixItem(Base):
    __tablename__ = "compliance_matrix_items"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="CASCADE"), nullable=False, index=True)
    requirement_id = Column(Integer, ForeignKey("tender_requirements.id", ondelete="SET NULL"), nullable=True, index=True)
    requirement_code = Column(String(120), nullable=True, index=True)
    requirement_summary = Column(Text, nullable=False)
    compliance_status = Column(String(80), nullable=False, default="to_review", index=True)
    response_location = Column(String(255), nullable=True)
    evidence = Column(Text, nullable=True)
    gap = Column(Text, nullable=True)
    action_plan = Column(Text, nullable=True)
    owner_name = Column(String(255), nullable=True)
    due_date = Column(DateTime, nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tender = relationship("Tender")
    requirement = relationship("TenderRequirement")
