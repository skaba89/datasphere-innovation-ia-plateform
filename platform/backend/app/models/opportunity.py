from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    opportunity_type = Column(String(120), nullable=True, index=True)
    country = Column(String(120), nullable=True, index=True)
    sector = Column(String(120), nullable=True, index=True)
    status = Column(String(120), nullable=False, default="Prospect identifie", index=True)
    priority = Column(String(50), nullable=False, default="Moyenne", index=True)
    potential_value = Column(Numeric(14, 2), nullable=True)
    probability = Column(Integer, nullable=False, default=20)
    next_action = Column(Text, nullable=True)
    next_action_date = Column(DateTime, nullable=True)
    owner_name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="opportunities")
