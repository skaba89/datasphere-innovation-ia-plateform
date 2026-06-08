"""
Workspace scoping — multi-tenant isolation helpers.

How it works:
  - Every protected request optionally carries X-Workspace-ID header
    (or ?workspace_id query param as fallback)
  - get_workspace_scope() validates the user is a member of that workspace
  - Scoped CRUD functions filter queries by the resolved workspace

Phase 2 implementation:
  - All entity models will have created_by_workspace_id FK
  - All list/get endpoints will use get_workspace_scope()
  - Data created in workspace A is never visible in workspace B
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

log = logging.getLogger("datasphere.workspace_scope")


class WorkspaceContext:
    """Resolved workspace context for the current request."""

    def __init__(self, workspace: Workspace, member: WorkspaceMember | None, user: User):
        self.workspace = workspace
        self.member   = member
        self.user     = user
        self.is_admin = user.role in ("admin",)
        self.role     = member.role if member else ("admin" if self.is_admin else "viewer")

    @property
    def id(self) -> int:
        return self.workspace.id

    def __repr__(self) -> str:
        return f"WorkspaceContext(ws={self.workspace.id}, user={self.user.id}, role={self.role})"


def get_workspace_scope(
    workspace_id:   Optional[int] = Query(None, description="Workspace ID (optionnel)"),
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    db:             Session       = Depends(get_db),
    current_user:   User          = Depends(get_current_user),
) -> WorkspaceContext | None:
    """
    Resolve workspace context from request.

    Returns WorkspaceContext if a workspace is identified, None otherwise.
    System admins can access any workspace.
    Regular users must be members of the requested workspace.
    """
    # Resolve workspace_id from query param or header
    resolved_id = workspace_id or (int(x_workspace_id) if x_workspace_id else None)

    if not resolved_id:
        return None  # No workspace context — unscoped request

    workspace = db.query(Workspace).filter(
        Workspace.id == resolved_id,
        Workspace.is_active == True,   # noqa
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace #{resolved_id} not found or inactive",
        )

    # Admins can access any workspace
    if current_user.role == "admin":
        log.debug("Admin %s accessing workspace %d", current_user.email, resolved_id)
        return WorkspaceContext(workspace=workspace, member=None, user=current_user)

    # Regular users must be a member
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == resolved_id,
        WorkspaceMember.user_id      == current_user.id,
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Vous n'êtes pas membre du workspace #{resolved_id}",
        )

    return WorkspaceContext(workspace=workspace, member=member, user=current_user)


def require_workspace_scope(
    ctx: WorkspaceContext | None = Depends(get_workspace_scope),
) -> WorkspaceContext:
    """Like get_workspace_scope but raises 400 if no workspace is provided."""
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Workspace-ID header ou paramètre workspace_id requis",
        )
    return ctx


def require_workspace_admin(
    ctx: WorkspaceContext = Depends(require_workspace_scope),
) -> WorkspaceContext:
    """Require workspace admin role (owner/admin) or system admin."""
    if not ctx.is_admin and ctx.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission refusée — rôle admin ou owner requis dans ce workspace",
        )
    return ctx
