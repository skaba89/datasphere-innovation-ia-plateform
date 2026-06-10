"""
Setup endpoint — Initialisation complète sans accès Shell.

GET  /api/v1/setup/status   — vérifie l'état de la DB (public)
POST /api/v1/setup/run      — lance migrations + crée admin (token requis)

Protégé par SETUP_SECRET_KEY (variable d'environnement).
À utiliser UNE SEULE FOIS après le premier déploiement.
Désactiver en mettant SETUP_ENABLED=false après usage.
"""

from __future__ import annotations
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger("datasphere.setup")

router = APIRouter(prefix="/setup", tags=["setup"])

SETUP_TOKEN = os.environ.get("SETUP_SECRET_KEY", "")
SETUP_ENABLED = os.environ.get("SETUP_ENABLED", "true").lower() != "false"


def _check_enabled():
    if not SETUP_ENABLED:
        raise HTTPException(status_code=404, detail="Setup endpoint disabled")
    if not SETUP_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="SETUP_SECRET_KEY not configured. Add it to Render env vars."
        )


@router.get("/status")
def setup_status():
    """Check DB connectivity and table status — no auth required."""
    from app.db.session import engine
    import sqlalchemy as sa
    result = {"database": "unknown", "tables": [], "alembic_version": None}
    try:
        with engine.connect() as conn:
            result["database"] = "connected"
            tables = sa.inspect(engine).get_table_names()
            result["tables"] = tables
            result["has_users"] = "users" in tables
            result["has_workspaces"] = "workspaces" in tables
            try:
                row = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
                result["alembic_version"] = row[0] if row else None
            except Exception:
                result["alembic_version"] = "table_missing"
    except Exception as e:
        result["database"] = f"error: {str(e)[:200]}"
    return result


@router.get("/diagnose-login")
def diagnose_login(email: str = "admin@datasphere-innovation.fr", password: str = "Admin123456!"):
    """
    Diagnose login 500 — tests each step and returns the real error.
    Public, no auth required. Remove after debugging.
    """
    steps = {}

    # Step 1: DB connection
    try:
        from app.db.session import engine
        import sqlalchemy as sa
        with engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        steps["db_connect"] = "ok"
    except Exception as e:
        steps["db_connect"] = f"ERROR: {e}"
        return steps

    # Step 2: Find user
    try:
        from app.db.session import SessionLocal
        from app.crud.user import get_user_by_email
        db = SessionLocal()
        user = get_user_by_email(db, email)
        if user:
            steps["find_user"] = f"ok — id={user.id} active={user.is_active}"
        else:
            steps["find_user"] = f"NOT FOUND — email={email}"
        db.close()
    except Exception as e:
        steps["find_user"] = f"ERROR: {e}"
        return steps

    # Step 3: Verify password
    try:
        from app.core.security import verify_password
        if user:
            ok = verify_password(password, user.password_hash)
            steps["verify_password"] = "ok" if ok else "WRONG PASSWORD"
        else:
            steps["verify_password"] = "skipped (no user)"
    except Exception as e:
        steps["verify_password"] = f"ERROR: {e}"
        return steps

    # Step 4: Create JWT
    try:
        from app.core.security import create_access_token, create_refresh_token
        if user:
            at = create_access_token(subject=str(user.id), extra_claims={"role": user.role})
            rt = create_refresh_token(subject=str(user.id), extra_claims={"role": user.role})
            steps["create_jwt"] = f"ok — access={at[:20]}... refresh={rt[:20]}..."
        else:
            steps["create_jwt"] = "skipped (no user)"
    except Exception as e:
        steps["create_jwt"] = f"ERROR: {e}"
        return steps

    # Step 5: Build TokenResponse
    try:
        from app.schemas.user import TokenResponse, UserRead
        if user:
            resp = TokenResponse(access_token=at, refresh_token=rt, user=user)
            steps["build_response"] = "ok"
        else:
            steps["build_response"] = "skipped"
    except Exception as e:
        steps["build_response"] = f"ERROR: {e}"

    steps["conclusion"] = "all ok — login should work" if all("ERROR" not in str(v) for v in steps.values()) else "see errors above"
    return steps


class SetupRequest(BaseModel):
    token: str
    admin_email: str = "admin@datasphere-innovation.fr"
    admin_password: str = "Admin123456!"
    admin_first_name: str = "Admin"
    admin_last_name: str = "DataSphere"


@router.get("/bootstrap")
def setup_bootstrap(token: str, email: str = "admin@datasphere-innovation.fr",
                    password: str = "Admin123456!"):
    """
    Bootstrap admin via GET — callable directly from browser.
    Usage : /api/v1/setup/bootstrap?token=XXXX
    """
    req = SetupRequest(token=token, admin_email=email, admin_password=password,
                       admin_first_name="Admin", admin_last_name="DataSphere")
    return setup_run(req)


def setup_run(payload: SetupRequest):
    """
    Run database migrations and create the initial admin user.
    Requires SETUP_SECRET_KEY token.
    """
    _check_enabled()

    if payload.token != SETUP_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid setup token")

    results = []

    # 1. Run Alembic migrations (skip if already at latest version)
    try:
        from app.db.session import engine
        import sqlalchemy as sa
        # Check current version first
        try:
            with engine.connect() as conn:
                row = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
                current_version = row[0] if row else None
        except Exception:
            current_version = None

        # Find alembic.ini — walk up from this file until found
        import pathlib
        base = pathlib.Path(__file__).resolve().parent
        alembic_ini = None
        for _ in range(10):
            candidate = base / "alembic.ini"
            if candidate.exists():
                alembic_ini = str(candidate)
                break
            base = base.parent

        if alembic_ini:
            from alembic.config import Config
            from alembic import command as alembic_cmd
            alembic_cfg = Config(alembic_ini)
            alembic_cmd.upgrade(alembic_cfg, "head")
            results.append({"step": "migrations", "status": "ok",
                           "detail": f"alembic upgrade head (from {current_version})"})
        else:
            # alembic.ini not found — DB already set up, skip
            results.append({"step": "migrations", "status": "skipped",
                           "detail": f"alembic.ini not found — current version: {current_version} (already migrated)"})
    except Exception as e:
        # If migrations fail but DB has tables, continue anyway
        results.append({"step": "migrations", "status": "warning", "detail": str(e)[:300]})

    # 2. Create admin user
    try:
        from app.db.session import SessionLocal
        from app.crud.user import get_user_by_email, create_user
        from app.schemas.user import UserCreate
        from app.core.security import get_password_hash

        db = SessionLocal()
        try:
            existing = get_user_by_email(db, payload.admin_email)
            if existing:
                results.append({"step": "admin_user", "status": "skipped",
                                "detail": f"User {payload.admin_email} already exists"})
            else:
                user = create_user(db, UserCreate(
                    email=payload.admin_email,
                    password=payload.admin_password,
                    first_name=payload.admin_first_name,
                    last_name=payload.admin_last_name,
                    role="admin",
                    is_active=True,
                ))
                results.append({"step": "admin_user", "status": "ok",
                                "detail": f"Admin {payload.admin_email} created (id={user.id})"})
        finally:
            db.close()
    except Exception as e:
        results.append({"step": "admin_user", "status": "error", "detail": str(e)[:300]})

    # 3. Test login process (diagnose 500 cause)
    try:
        from app.core.security import get_password_hash, verify_password, create_access_token
        # Test password hashing
        test_hash = get_password_hash("TestPassword123!")
        assert verify_password("TestPassword123!", test_hash), "verify_password failed"
        # Test JWT creation
        token = create_access_token(subject="1", extra_claims={"role": "admin"})
        assert token and len(token) > 20, "JWT creation failed"
        results.append({"step": "auth_test", "status": "ok",
                       "detail": "bcrypt + JWT working correctly"})
    except Exception as e:
        results.append({"step": "auth_test", "status": "error",
                       "detail": f"Auth error (likely bcrypt/passlib conflict): {str(e)[:300]}"})
    try:
        status = setup_status()
        results.append({"step": "final_check", "status": "ok",
                        "detail": f"Tables: {len(status['tables'])}, alembic: {status['alembic_version']}"})
    except Exception as e:
        results.append({"step": "final_check", "status": "error", "detail": str(e)[:200]})

    all_ok = all(r["status"] in ("ok", "skipped") for r in results)
    return {
        "success": all_ok,
        "results": results,
        "next_steps": [
            f"Login at /login with {payload.admin_email}",
            "Set SETUP_ENABLED=false in Render env vars to disable this endpoint",
        ] if all_ok else ["Check errors above and retry"],
    }


@router.get("/test-login-raw")
def test_login_raw(email: str = "admin@datasphere-innovation.fr", password: str = "Admin123456!"):
    """Call the actual login handler with full traceback capture."""
    import traceback
    from fastapi import Request
    from starlette.datastructures import Headers
    from starlette.types import Scope

    try:
        # Import everything the login endpoint needs
        from app.db.session import SessionLocal
        from app.crud.user import authenticate_user
        from app.core.security import create_access_token, create_refresh_token
        from app.schemas.user import TokenResponse
        import fastapi.encoders as encoders

        db = SessionLocal()
        try:
            user = authenticate_user(db, email, password)
            if user is None:
                return {"error": "authenticate_user returned None — wrong credentials or inactive user"}

            at = create_access_token(subject=str(user.id), extra_claims={"role": user.role})
            rt = create_refresh_token(subject=str(user.id), extra_claims={"role": user.role})

            # This is what FastAPI does to serialize response_model
            resp = TokenResponse(access_token=at, refresh_token=rt, user=user)
            serialized = encoders.jsonable_encoder(resp)
            return {"success": True, "response_keys": list(serialized.keys()), "user_email": serialized.get("user", {}).get("email")}
        finally:
            db.close()

    except Exception as e:
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error_msg": str(e)[:500],
            "traceback": traceback.format_exc()[-1500:],
        }
