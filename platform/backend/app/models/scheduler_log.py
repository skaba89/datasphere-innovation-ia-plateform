from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.session import Base


class SchedulerLog(Base):
    __tablename__ = "scheduler_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(120), nullable=False, index=True)
    job_name = Column(String(255), nullable=False)
    status = Column(String(80), nullable=False, default="success", index=True)  # success | error | skipped
    items_processed = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
