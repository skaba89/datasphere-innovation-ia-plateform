from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    contacts = relationship("Contact", back_populates="organization", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="organization", cascade="all, delete-orphan")
