from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.db.session import Base


class SectorTemplate(Base):
    __tablename__ = "sector_templates"

    id = Column(Integer, primary_key=True, index=True)
    sector_key = Column(String(80), nullable=False, index=True)    # telecom | finance | public | energy | it_digital
    sector_label = Column(String(120), nullable=False)
    deliverable_type = Column(String(80), nullable=False, index=True)
    title_template = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)                      # what this template covers
    content_markdown = Column(Text, nullable=False)                # full template content
    tags = Column(String(255), nullable=True)                      # comma-separated tags
    is_builtin = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
