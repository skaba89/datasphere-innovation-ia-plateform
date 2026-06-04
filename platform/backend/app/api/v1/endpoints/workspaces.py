"""
Workspaces endpoint — multi-tenant workspace management.

GET    /workspaces              — list workspaces accessible to current user
POST   /workspaces              — create a workspace
GET    /workspaces/{id}         — get workspace details
PATCH  /workspaces/{id}         — update workspace
GET    /workspaces/{id}/members — list members
POST   /workspaces/{id}/members — invite a member
DELETE /workspaces/{id}/members/{user_id} — remove a member
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

router = APIRouter(
    prefix="/workspaces",
    tags=["workspaces"],
    dependencies=[Depends(get_current_user)],
)


# ── Schemas ────────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    plan: str = "free"


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class WorkspaceRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    plan: str
    is_active: bool
    member_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class MemberInvite(BaseModel):
    user_id: int
    role: str = "member"


class MemberRead(BaseModel):
    id: int
    user_id: int
    workspace_id: int
    role: str
    joined_at: datetime
    invited_by: str | None

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_workspace(db: Session, workspace_id: int) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace introuvable")
    return ws


def _require_admin(db: Session, workspace_id: int, user: User) -> None:
    """Check user is workspace owner or admin."""
    if user.role == "admin":
        return  # Platform admin can do anything
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Droits admin requis pour cette action.",
        )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkspaceRead]:
    """List workspaces accessible to the current user."""
    if current_user.role == "admin":
        workspaces = db.query(Workspace).filter(Workspace.is_active == True).all()  # noqa
    else:
        # Return workspaces where user is a member
        member_ws_ids = db.query(WorkspaceMember.workspace_id).filter(
            WorkspaceMember.user_id == current_user.id
        ).subquery()
        workspaces = db.query(Workspace).filter(
            Workspace.id.in_(member_ws_ids),
            Workspace.is_active == True,  # noqa
        ).all()

    result = []
    for ws in workspaces:
        count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
        result.append(WorkspaceRead(
            id=ws.id, name=ws.name, slug=ws.slug, description=ws.description,
            plan=ws.plan, is_active=ws.is_active, member_count=count,
            created_at=ws.created_at,
        ))
    return result


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceRead:
    """Create a new workspace. Creator becomes owner."""
    # Check slug uniqueness
    if db.query(Workspace).filter(Workspace.slug == payload.slug).first():
        raise HTTPException(status_code=409, detail=f"Le slug '{payload.slug}' est déjà utilisé.")

    ws = Workspace(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        plan=payload.plan,
        owner_id=current_user.id,
    )
    db.add(ws)
    db.flush()  # Get ID without commit

    # Auto-add creator as owner member
    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=current_user.id,
        role="owner",
        invited_by="self",
    )
    db.add(member)
    db.commit()
    db.refresh(ws)

    return WorkspaceRead(
        id=ws.id, name=ws.name, slug=ws.slug, description=ws.description,
        plan=ws.plan, is_active=ws.is_active, member_count=1,
        created_at=ws.created_at,
    )


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceRead:
    ws = _get_workspace(db, workspace_id)
    count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
    return WorkspaceRead(
        id=ws.id, name=ws.name, slug=ws.slug, description=ws.description,
        plan=ws.plan, is_active=ws.is_active, member_count=count,
        created_at=ws.created_at,
    )


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
def update_workspace(
    workspace_id: int,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceRead:
    _require_admin(db, workspace_id, current_user)
    ws = _get_workspace(db, workspace_id)
    if payload.name is not None:
        ws.name = payload.name
    if payload.description is not None:
        ws.description = payload.description
    if payload.is_active is not None:
        ws.is_active = payload.is_active
    db.add(ws)
    db.commit()
    db.refresh(ws)
    count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
    return WorkspaceRead(
        id=ws.id, name=ws.name, slug=ws.slug, description=ws.description,
        plan=ws.plan, is_active=ws.is_active, member_count=count,
        created_at=ws.created_at,
    )


@router.get("/{workspace_id}/members", response_model=list[MemberRead])
def list_members(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MemberRead]:
    _get_workspace(db, workspace_id)
    return db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id
    ).all()


@router.post("/{workspace_id}/members", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
def invite_member(
    workspace_id: int,
    payload: MemberInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MemberRead:
    _require_admin(db, workspace_id, current_user)
    _get_workspace(db, workspace_id)

    # Check user exists
    user = db.query(User).filter(User.id == payload.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Check not already member
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == payload.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Cet utilisateur est déjà membre.")

    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=payload.user_id,
        role=payload.role,
        invited_by=current_user.email,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_member(
    workspace_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_admin(db, workspace_id, current_user)
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Impossible de retirer le propriétaire.")
    db.delete(member)
    db.commit()
    return {"removed": True, "user_id": user_id, "workspace_id": workspace_id}


# ── Plan limits ────────────────────────────────────────────────────────────────

PLAN_LIMITS = {
    "free":       {"max_members": 3,  "max_tenders": 10,  "ai_actions_month": 50,  "label": "Gratuit"},
    "starter":    {"max_members": 10, "max_tenders": 50,  "ai_actions_month": 500, "label": "Starter"},
    "pro":        {"max_members": 25, "max_tenders": 200, "ai_actions_month": 2000,"label": "Pro"},
    "enterprise": {"max_members": -1, "max_tenders": -1,  "ai_actions_month": -1,  "label": "Entreprise"},
}


@router.get("/{workspace_id}/plan")
def get_workspace_plan(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return workspace plan details and current usage vs limits."""
    from app.models.tender import Tender
    from app.models.agent import AgentAction
    from datetime import datetime, timedelta, timezone

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    limits = PLAN_LIMITS.get(ws.plan, PLAN_LIMITS["free"])
    member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).count()

    # For now usage is platform-wide (single tenant) — Phase 2 will scope by workspace
    tender_count = db.query(Tender).count()
    since = datetime.now(timezone.utc) - timedelta(days=30)
    action_count = db.query(AgentAction).filter(AgentAction.created_at >= since).count()

    def pct(used: int, limit: int) -> int | None:
        if limit < 0:
            return None
        return min(100, round(used / max(limit, 1) * 100))

    return {
        "workspace_id": workspace_id,
        "plan": ws.plan,
        "plan_label": limits["label"],
        "limits": limits,
        "usage": {
            "members":       {"used": member_count,  "limit": limits["max_members"],      "pct": pct(member_count,  limits["max_members"])},
            "tenders":       {"used": tender_count,   "limit": limits["max_tenders"],      "pct": pct(tender_count,   limits["max_tenders"])},
            "ai_actions_30d":{"used": action_count,   "limit": limits["ai_actions_month"], "pct": pct(action_count,   limits["ai_actions_month"])},
        },
        "upgrade_url": "https://datasphere-innovation.fr/pricing" if ws.plan == "free" else None,
    }
