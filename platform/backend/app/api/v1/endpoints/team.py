"""
Team management — admin-only user lifecycle: create, list, update role, deactivate.
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.user import (
    change_password,
    create_user,
    deactivate_user,
    get_user,
    get_user_by_email,
    list_users,
    update_user,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import ROLES, UserChangePassword, UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/team", tags=["team"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


@router.get("", response_model=list[UserRead], dependencies=[Depends(get_current_user)])
def list_team_members(
    role: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List all team members. Any authenticated user can see the team."""
    return list_users(db, role=role, skip=skip, limit=limit)


@router.get("/roles", dependencies=[Depends(get_current_user)])
def get_roles():
    """Return available roles (authenticated users only)."""
    return {
        "roles": [
            {"key": "admin",      "label": "Administrateur",  "description": "Accès complet, gestion équipe"},
            {"key": "manager",    "label": "Manager",          "description": "Gestion missions et livrables"},
            {"key": "consultant", "label": "Consultant",       "description": "Création et soumission de livrables"},
            {"key": "viewer",     "label": "Observateur",      "description": "Lecture seule"},
        ]
    }


@router.post("/invite", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def invite_team_member(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Invite a new team member (admin only)."""
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{payload.email}' already exists",
        )
    if payload.role not in ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {ROLES}",
        )
    from app.crud.audit_log import write_log
    from app.services.email_service import EmailType, send_typed_email
    import threading

    user = create_user(db, payload)
    write_log(
        db, action="INVITE", resource_type="user",
        resource_id=user.id, resource_label=user.email,
        actor_name=admin.email,
        detail=f"role={user.role}",
    )

    # Send welcome email asynchronously (fire-and-forget)
    def _send_welcome():
        send_typed_email(
            to=user.email,
            email_type=EmailType.TEAM_INVITE,
            params={
                "inviter_name": f"{admin.first_name} {admin.last_name}".strip() or admin.email,
                "workspace_name": "DataSphere Innovation IA Platform",
                "invite_url": "https://datasphere-innovation.fr",
            },
        )
    threading.Thread(target=_send_welcome, daemon=True).start()

    return user


@router.get("/{user_id}", response_model=UserRead, dependencies=[Depends(get_current_user)])
def get_team_member(user_id: int, db: Session = Depends(get_db)):
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_team_member(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Update role or activation status (admin only)."""
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.role and payload.role not in ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {ROLES}",
        )
    # Prevent removing the last admin
    if payload.role and payload.role != "admin" and user.role == "admin":
        from app.crud.user import list_users
        admins = list_users(db, role="admin")
        if len(admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last admin",
            )
    return update_user(db, user, **payload.model_dump(exclude_unset=True))


@router.post("/{user_id}/deactivate", response_model=UserRead)
def deactivate_team_member(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Deactivate a team member (admin only). Does not delete data."""
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself",
        )
    from app.crud.audit_log import write_log
    result = deactivate_user(db, user)
    write_log(
        db, action="DEACTIVATE", resource_type="user",
        resource_id=user.id, resource_label=user.email,
        actor_name=admin.email,
    )
    return result


@router.post("/me/change-password", response_model=UserRead)
def self_change_password(
    payload: UserChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change your own password (self-service, no admin required)."""
    return change_password(db, current_user, payload.new_password)


@router.post("/{user_id}/change-password", response_model=UserRead)
def admin_change_password(
    user_id: int,
    payload: UserChangePassword,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Change a user's password (admin only, or self via /team/me/change-password)."""
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return change_password(db, user, payload.new_password)


# ── Profile /me ───────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    first_name:   str | None = None
    last_name:    str | None = None
    bio:          str | None = None
    phone:        str | None = None
    linkedin_url: str | None = None
    avatar_url:   str | None = None
    tjm:          int | None = None          # Taux journalier moyen (€)
    skills:       list[str] | None = None    # Liste de compétences
    location:     str | None = None
    availability: str | None = None          # "immediate" | "2weeks" | "1month"


@router.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Return the current user's full profile."""
    import json as _json
    extra = {}
    try:
        extra = _json.loads(current_user.extra_data or "{}") if hasattr(current_user, "extra_data") and current_user.extra_data else {}
    except Exception:
        pass
    return {
        "id":           current_user.id,
        "email":        current_user.email,
        "first_name":   current_user.first_name,
        "last_name":    current_user.last_name,
        "role":         current_user.role,
        "is_active":    current_user.is_active,
        "created_at":   current_user.created_at.isoformat() if current_user.created_at else None,
        # Extended profile from extra_data
        "bio":          extra.get("bio"),
        "phone":        extra.get("phone"),
        "linkedin_url": extra.get("linkedin_url"),
        "avatar_url":   extra.get("avatar_url"),
        "tjm":          extra.get("tjm"),
        "skills":       extra.get("skills", []),
        "location":     extra.get("location"),
        "availability": extra.get("availability"),
    }


@router.patch("/me")
def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile."""
    import json as _json

    # Update core fields
    if payload.first_name is not None:
        current_user.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        current_user.last_name = payload.last_name.strip()

    # Update extra_data for extended fields
    extra = {}
    try:
        extra = _json.loads(current_user.extra_data or "{}") if hasattr(current_user, "extra_data") and current_user.extra_data else {}
    except Exception:
        pass

    patch_fields = {
        "bio": payload.bio, "phone": payload.phone,
        "linkedin_url": payload.linkedin_url, "avatar_url": payload.avatar_url,
        "tjm": payload.tjm, "skills": payload.skills,
        "location": payload.location, "availability": payload.availability,
    }
    for key, val in patch_fields.items():
        if val is not None:
            extra[key] = val

    if hasattr(current_user, "extra_data"):
        current_user.extra_data = _json.dumps(extra)

    db.commit()
    db.refresh(current_user)

    # Add to audit log
    try:
        from app.crud.audit_log import create_audit_log
        create_audit_log(db, user_id=current_user.id, action="profile.update",
                         entity_type="user", entity_id=current_user.id,
                         details={"fields_updated": [k for k, v in patch_fields.items() if v is not None]})
    except Exception:
        pass

    return {"success": True, "message": "Profil mis à jour"}
