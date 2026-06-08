from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    reference = Column(String(120), nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    buyer_name = Column(String(255), nullable=True, index=True)
    publication_date = Column(DateTime, nullable=True)
    submission_deadline = Column(DateTime, nullable=True, index=True)
    source_url = Column(String(800), nullable=True)
    summary = Column(Text, nullable=True)
    go_no_go_score = Column(Integer, nullable=True)
    go_no_go_decision = Column(String(50), nullable=True, index=True)
    status = Column(String(80), nullable=False, default="draft", index=True)

    # ── AI suggestion fields ─────────────────────────────────────────────────
    source = Column(String(50), nullable=False, default="manual", index=True)
    validation_status = Column(String(20), nullable=False, default="validated", index=True)
    confidence_score = Column(Float, nullable=True)
    ai_notes = Column(Text, nullable=True)
    validated_by = Column(String(255), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    # ────────────────────────────────────────────────────────────────────────

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    workspace_id     = Column(Integer, ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_email = Column(String(255), nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    opportunity = relationship("Opportunity")
    requirements = relationship("TenderRequirement", back_populates="tender", cascade="all, delete-orphan")


class TenderRequirement(Base):
    __tablename__ = "tender_requirements"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="CASCADE"), nullable=False, index=True)
    requirement_code = Column(String(120), nullable=True, index=True)
    section = Column(String(255), nullable=True)
    description = Column(Text, nullable=False)
    requirement_type = Column(String(120), nullable=True, index=True)
    response_strategy = Column(Text, nullable=True)
    proof_or_deliverable = Column(Text, nullable=True)
    owner_name = Column(String(255), nullable=True)
    status = Column(String(80), nullable=False, default="to_analyze", index=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tender = relationship("Tender", back_populates="requirements")
