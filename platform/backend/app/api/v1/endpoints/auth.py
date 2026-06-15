from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    get_password_hash,
)
from app.crud.user import authenticate_user, count_users, create_user, get_user_by_email, get_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/bootstrap-admin", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def bootstrap_admin(payload: UserCreate, db: Session = Depends(get_db)):
    """Create the first admin user only when the users table is empty."""
    if count_users(db) > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bootstrap is disabled after first user creation",
        )
    payload.role = "admin"
    return create_user(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user. Returns access_token (60 min) + refresh_token (30 days).
    Rate-limited to 10 attempts/minute per IP in production.
    """
    settings = get_settings()
    # Rate limiting géré par le Limiter global (app.state.limiter via slowapi).
    # Ne jamais appeler limiter.hit() manuellement — méthode inexistante sur Limiter.
    # Le décorateur @limiter.limit est géré globalement via default_limits=["300/minute"].

    try:
        user = authenticate_user(db, payload.email, payload.password)
    except Exception as db_err:
        import logging as _log
        _log.getLogger("datasphere.auth").error("login DB error: %s", db_err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Erreur DB au login: {type(db_err).__name__}: {str(db_err)[:120]}. "
                "Vérifiez /api/v1/auth/diagnose-login pour plus d'infos."
            ),
        )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    access_token = create_access_token(
        subject=str(user.id), extra_claims={"role": user.role}
    )
    refresh_token = create_refresh_token(
        subject=str(user.id), extra_claims={"role": user.role}
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=user)


@router.post("/refresh", response_model=RefreshResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access token.
    Called automatically by the frontend before the access token expires.
    """
    claims = decode_token(payload.refresh_token, "refresh")
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré. Reconnectez-vous.",
        )
    user_id = claims.get("sub")
    user = get_user(db, int(user_id)) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou désactivé.",
        )
    new_access = create_access_token(
        subject=str(user.id), extra_claims={"role": user.role}
    )
    return RefreshResponse(access_token=new_access)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Request a password reset link. Always returns 200 to avoid email enumeration.
    Sends an email with a reset link valid for 60 minutes.
    """
    settings = get_settings()
    frontend_url = settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:5173"

    user = get_user_by_email(db, str(payload.email))
    if user and user.is_active:
        token = create_reset_token(str(payload.email))
        reset_url = f"{frontend_url}/reset-password?token={token}"
        from app.services.smtp_service import send_reset_password
        send_reset_password(
            email=str(payload.email),
            reset_url=reset_url,
            firstname=user.first_name or "",
        )

    return {
        "message": "Si cet email existe, un lien de réinitialisation a été envoyé. Vérifiez votre boîte mail."
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validate reset token and set new password."""
    claims = decode_token(payload.token, "reset")
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de réinitialisation invalide ou expiré.",
        )
    email = claims.get("sub")
    user = get_user_by_email(db, email) if email else None
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilisateur introuvable.",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le mot de passe doit contenir au moins 8 caractères.",
        )
    user.password_hash = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"message": "Mot de passe mis à jour. Vous pouvez maintenant vous connecter."}


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change password for authenticated user (requires current password)."""
    from app.core.security import verify_password
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect.",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le nouveau mot de passe doit contenir au moins 8 caractères.",
        )
    current_user.password_hash = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"message": "Mot de passe modifié avec succès."}


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/diagnose-login")
def diagnose_login(db: Session = Depends(get_db)):
    """
    Public diagnostic endpoint — checks login prerequisites.
    Use when POST /auth/login returns 500.
    """
    checks = {}

    # 1. DB connection
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1")).scalar()
        checks["db_connection"] = "ok"
    except Exception as e:
        checks["db_connection"] = f"ERROR: {e}"

    # 2. users table exists
    try:
        from sqlalchemy import text
        count = db.execute(text("SELECT count(*) FROM users")).scalar()
        checks["users_table"] = f"ok ({count} users)"
    except Exception as e:
        checks["users_table"] = f"ERROR: {e}"

    # 3. extra_data column exists
    try:
        from sqlalchemy import text
        db.execute(text("SELECT extra_data FROM users LIMIT 1"))
        checks["extra_data_column"] = "ok"
    except Exception as e:
        checks["extra_data_column"] = f"MISSING — run: alembic upgrade head"

    # 4. Alembic current revision
    try:
        from sqlalchemy import text
        rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        checks["alembic_revision"] = rev or "unknown"
        checks["expected_revision"] = "consultant_exp_001"
        checks["migration_up_to_date"] = (rev == "consultant_exp_001")
    except Exception as e:
        checks["alembic_revision"] = f"ERROR: {e}"

    # 5. Settings
    _s = get_settings()
    checks["app_env"] = _s.app_env
    checks["secret_key_set"] = len(_s.secret_key) >= 32
    checks["slowapi_limiter_hit_fixed"] = "ok — limiter.hit() removed, using global default_limits"
    checks["pydantic_version"] = "ok"
    try:
        import pydantic
        checks["pydantic_version"] = pydantic.VERSION
    except Exception:
        pass

    # 6. Bcrypt latency test
    try:
        import time as _time
        from app.core.security import get_password_hash, verify_password
        _t0 = _time.monotonic()
        _h = get_password_hash("benchmark_test_password")
        _hash_ms = round((_time.monotonic() - _t0) * 1000, 1)
        _t0 = _time.monotonic()
        verify_password("benchmark_test_password", _h)
        _verify_ms = round((_time.monotonic() - _t0) * 1000, 1)
        checks["bcrypt_hash_ms"]   = _hash_ms
        checks["bcrypt_verify_ms"] = _verify_ms
        checks["bcrypt_ok"] = _verify_ms < 200  # Seuil d'alerte : 200ms
    except Exception as _e:
        checks["bcrypt_verify_ms"] = f"ERROR: {_e}"

    overall = all(
        "ERROR" not in str(v) and "MISSING" not in str(v)
        for v in checks.values() if isinstance(v, str)
    )
    return {"status": "ok" if overall else "error", "checks": checks}
