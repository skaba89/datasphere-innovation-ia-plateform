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
            # List tables
            tables = sa.inspect(engine).get_table_names()
            result["tables"] = tables
            result["has_users"] = "users" in tables
            result["has_workspaces"] = "workspaces" in tables
            # Check alembic version
            try:
                row = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
                result["alembic_version"] = row[0] if row else None
            except Exception:
                result["alembic_version"] = "table_missing"
    except Exception as e:
        result["database"] = f"error: {str(e)[:200]}"
    return result


class SetupRequest(BaseModel):
    token: str
    admin_email: str = "admin@datasphere-innovation.fr"
    admin_password: str = "Admin123456!"
    admin_first_name: str = "Admin"
    admin_last_name: str = "DataSphere"


@router.post("/run")
def setup_run(payload: SetupRequest):
    """
    Run database migrations and create the initial admin user.
    Requires SETUP_SECRET_KEY token.
    """
    _check_enabled()

    if payload.token != SETUP_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid setup token")

    results = []

    # 1. Run Alembic migrations
    try:
        import os as _os
        from alembic.config import Config
        from alembic import command as alembic_cmd
        alembic_cfg = Config(
            _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.dirname(__file__))), "alembic.ini")
        )
        alembic_cmd.upgrade(alembic_cfg, "head")
        results.append({"step": "migrations", "status": "ok", "detail": "alembic upgrade head completed"})
    except Exception as e:
        results.append({"step": "migrations", "status": "error", "detail": str(e)[:300]})
        return {"success": False, "results": results}

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

    # 3. Final status check
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
