"""
API Keys — gestion des clés d'API publique pour intégrations tierces.

GET    /api-keys          — lister les clés de l'utilisateur
POST   /api-keys          — créer une nouvelle clé (retourne le secret UNE SEULE FOIS)
DELETE /api-keys/{id}     — révoquer une clé
PATCH  /api-keys/{id}     — activer/désactiver, renommer
GET    /api-keys/scopes   — lister les scopes disponibles
POST   /api-keys/{id}/rotate — regénérer le secret d'une clé

Authentification des requêtes via clé API :
  Authorization: Bearer ds_live_xxxxxxxxxxxx
"""

from __future__ import annotations

import hashlib
import secrets
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.user import User

log = logging.getLogger("datasphere.api_keys")

router = APIRouter(
    prefix="/api-keys",
    tags=["api-keys"],
    dependencies=[Depends(get_current_user)],
)

# ── Scopes catalog ─────────────────────────────────────────────────────────────

AVAILABLE_SCOPES = {
    "read:all":           "Lecture de toutes les ressources (organisations, AO, livrables…)",
    "write:tenders":      "Créer et modifier des appels d'offres",
    "write:deliverables": "Créer et modifier des livrables",
    "write:opportunities":"Créer et modifier des opportunités",
    "write:contacts":     "Créer et modifier des contacts",
    "read:analytics":     "Accès aux métriques et analytics",
    "admin":              "Accès complet (admin uniquement)",
}

# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_key() -> tuple[str, str, str]:
    """Generate (raw_secret, prefix, key_hash)."""
    raw    = secrets.token_hex(32)       # 64-char hex secret
    prefix = f"ds_live_{secrets.token_hex(6)}"
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, prefix, hashed


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Schemas ────────────────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name:         str       = Field(..., min_length=1, max_length=100)
    scopes:       list[str] = Field(default=["read:all"])
    workspace_id: int | None = None
    expires_days: int | None = Field(None, ge=1, le=3650, description="Expiration en jours (null = jamais)")


class ApiKeyPatch(BaseModel):
    name:      str | None  = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


class ApiKeyRead(BaseModel):
    id:           int
    name:         str
    prefix:       str
    scopes:       str
    is_active:    bool
    last_used_at: str | None
    expires_at:   str | None
    created_at:   str

    class Config:
        from_attributes = True


class ApiKeyCreated(ApiKeyRead):
    secret: str  # Only returned once at creation


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/scopes")
def list_scopes():
    """List available API key scopes."""
    return {
        "scopes": [
            {"key": k, "description": v}
            for k, v in AVAILABLE_SCOPES.items()
        ]
    }


@router.get("", response_model=list[ApiKeyRead])
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all API keys for the current user."""
    keys = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.is_active == True,          # noqa
    ).order_by(ApiKey.created_at.desc()).all()

    return [
        ApiKeyRead(
            id=k.id, name=k.name, prefix=k.prefix, scopes=k.scopes,
            is_active=k.is_active,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
            created_at=k.created_at.isoformat(),
        )
        for k in keys
    ]


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new API key.

    ⚠️  The `secret` field is returned ONLY ONCE.
    Store it securely — it cannot be retrieved again.
    """
    # Validate scopes
    invalid = [s for s in payload.scopes if s not in AVAILABLE_SCOPES]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Scopes invalides : {', '.join(invalid)}. Valides : {', '.join(AVAILABLE_SCOPES)}",
        )

    # Admin-only scope check
    if "admin" in payload.scopes and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Scope 'admin' réservé aux administrateurs")

    raw, prefix, key_hash = _generate_key()

    expires_at = None
    if payload.expires_days:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=payload.expires_days)

    api_key = ApiKey(
        user_id=current_user.id,
        workspace_id=payload.workspace_id,
        name=payload.name,
        prefix=prefix,
        key_hash=key_hash,
        scopes=" ".join(payload.scopes),
        expires_at=expires_at,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    log.info("API key created: user=%s name=%s scopes=%s", current_user.email, payload.name, payload.scopes)

    return ApiKeyCreated(
        id=api_key.id, name=api_key.name, prefix=api_key.prefix,
        scopes=api_key.scopes, is_active=api_key.is_active,
        last_used_at=None, expires_at=expires_at.isoformat() if expires_at else None,
        created_at=api_key.created_at.isoformat(),
        secret=f"{prefix}_{raw}",   # full key: prefix_secret
    )


@router.patch("/{key_id}", response_model=ApiKeyRead)
def update_api_key(
    key_id: int,
    payload: ApiKeyPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename or activate/deactivate an API key."""
    key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="Clé API introuvable")

    if payload.name is not None:      key.name = payload.name
    if payload.is_active is not None: key.is_active = payload.is_active
    db.commit()
    db.refresh(key)

    return ApiKeyRead(
        id=key.id, name=key.name, prefix=key.prefix, scopes=key.scopes,
        is_active=key.is_active,
        last_used_at=key.last_used_at.isoformat() if key.last_used_at else None,
        expires_at=key.expires_at.isoformat() if key.expires_at else None,
        created_at=key.created_at.isoformat(),
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently revoke an API key."""
    key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="Clé API introuvable")

    db.delete(key)
    db.commit()
    log.info("API key revoked: user=%s key_id=%d", current_user.email, key_id)


@router.post("/{key_id}/rotate", response_model=ApiKeyCreated)
def rotate_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Rotate an API key — generates a new secret, invalidates the old one.
    The new secret is returned ONLY ONCE.
    """
    key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="Clé API introuvable")

    raw, prefix, key_hash = _generate_key()
    key.prefix   = prefix
    key.key_hash = key_hash
    db.commit()
    db.refresh(key)

    log.info("API key rotated: user=%s key_id=%d", current_user.email, key_id)

    return ApiKeyCreated(
        id=key.id, name=key.name, prefix=key.prefix, scopes=key.scopes,
        is_active=key.is_active,
        last_used_at=None,
        expires_at=key.expires_at.isoformat() if key.expires_at else None,
        created_at=key.created_at.isoformat(),
        secret=f"{prefix}_{raw}",
    )


# ── Auth middleware helper ─────────────────────────────────────────────────────

def authenticate_api_key(raw_key: str, db: Session) -> ApiKey | None:
    """
    Validate an API key from a Bearer token.
    Used in the dependency injection system for public API access.
    Returns the ApiKey instance if valid, None otherwise.
    """
    if not raw_key or not raw_key.startswith("ds_live_"):
        return None

    # Key format: ds_live_XXXXXX_SECRET
    # Hash the secret part
    parts = raw_key.split("_", 3)   # ds, live, prefix_hex, secret
    if len(parts) < 4:
        # Old format: hash the full key
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    else:
        # New format: prefix is in the key, hash the raw key after prefix_
        # Actually hash the entire raw string consistently
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    key = db.query(ApiKey).filter(
        ApiKey.key_hash == key_hash,
        ApiKey.is_active == True,      # noqa
    ).first()

    if not key:
        return None

    # Check expiry
    if key.expires_at and key.expires_at < datetime.utcnow():
        return None

    # Update last_used_at (non-blocking)
    try:
        key.last_used_at = datetime.utcnow()
        db.commit()
    except Exception:
        pass

    return key
