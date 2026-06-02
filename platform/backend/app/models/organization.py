from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    country = Column(String(120), nullable=True, index=True)
    sector = Column(String(120), nullable=True, index=True)
    organization_type = Column(String(120), nullable=True, index=True)
    website = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # ── AI suggestion fields ─────────────────────────────────────────────────
    source = Column(String(50), nullable=False, default="manual", index=True)
    # "manual" | "ai_suggested" | "imported" | "boamp" | "ted"
    validation_status = Column(String(20), nullable=False, default="validated", index=True)
    # "pending" | "validated" | "rejected"
    confidence_score = Column(Float, nullable=True)     # 0.0–1.0, set by agent
    source_url = Column(String(800), nullable=True)     # URL where org was found
    ai_notes = Column(Text, nullable=True)              # Agent rationale
    validated_by = Column(String(255), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    # ────────────────────────────────────────────────────────────────────────

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    contacts = relationship("Contact", back_populates="organization", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="organization", cascade="all, delete-orphan")
