"""
Workspace model — multi-tenant isolation unit.

Each workspace groups organizations, opportunities, tenders,
deliverables, and users under one isolated context.
A user can belong to multiple workspaces with different roles.

This is the foundational model for multi-tenancy.
Full isolation (FK constraints on every entity) is Phase 2.
Phase 1 (this file): model + membership + basic API.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship

from app.db.session import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Billing / plan (Phase 2: Stripe)
    plan = Column(String(50), nullable=False, default="free")
    # "free" | "starter" | "pro" | "enterprise"

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    """Many-to-many: User ↔ Workspace with a role."""

    __tablename__ = "workspace_members"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, default="member")
    # "owner" | "admin" | "member" | "viewer"
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    invited_by = Column(String(255), nullable=True)

    workspace = relationship("Workspace", back_populates="members")
