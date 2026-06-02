from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.db.session import Base


class UploadedFile(Base):
    """Stores metadata for files attached to tenders or deliverables."""

    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    resource_type = Column(String, nullable=False, index=True)   # "tender" | "deliverable"
    resource_id = Column(Integer, nullable=False, index=True)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False, unique=True)    # UUID-based filename on disk
    mime_type = Column(String)
    size_bytes = Column(Integer)
    uploaded_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
