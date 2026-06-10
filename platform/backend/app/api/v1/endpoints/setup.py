"""
Setup endpoint — Initialisation sans accès Shell (Render free plan).

GET  /api/v1/setup/status    — vérifie l'état de la DB (public)
POST /api/v1/setup/run       — migrations + admin (token requis)
GET  /api/v1/setup/bootstrap — migrations + admin via navigateur (token en param)

Désactiver après usage : SETUP_ENABLED=false dans Render env vars.
"""

from __future__ import annotations
import logging, os
import pathlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger("datasphere.setup")

router = APIRouter(prefix="/setup", tags=["setup"])

SETUP_TOKEN   = os.environ.get("SETUP_SECRET_KEY", "")
SETUP_ENABLED = os.environ.get("SETUP_ENABLED", "true").lower() != "false"


def _check():
    if not SETUP_ENABLED:
        raise HTTPException(status_code=404, detail="Setup endpoint disabled")
    if not SETUP_TOKEN:
        raise HTTPException(status_code=503, detail="SETUP_SECRET_KEY not set")


@router.get("/status")
def setup_status():
    """Check DB + tables — no auth required."""
    from app.db.session import engine
    import sqlalchemy as sa
    r: dict = {"database": "unknown", "tables": [], "alembic_version": None}
    try:
        with engine.connect() as conn:
            r["database"] = "connected"
            r["tables"]   = sa.inspect(engine).get_table_names()
            r["has_users"] = "users" in r["tables"]
            try:
                row = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
                r["alembic_version"] = row[0] if row else None
            except Exception:
                r["alembic_version"] = "missing"
    except Exception as e:
        r["database"] = f"error: {str(e)[:200]}"
    return r


class SetupRequest(BaseModel):
    token:            str
    admin_email:      str = "admin@datasphere-innovation.fr"
    admin_password:   str = "Admin123456!"
    admin_first_name: str = "Admin"
    admin_last_name:  str = "DataSphere"


@router.get("/bootstrap")
def setup_bootstrap(token: str, email: str = "admin@datasphere-innovation.fr", password: str = "Admin123456!"):
    """Bootstrap via GET (navigateur). Token requis en paramètre URL."""
    return setup_run(SetupRequest(token=token, admin_email=email, admin_password=password))


@router.post("/run")
def setup_run(payload: SetupRequest):
    """Run migrations + create admin. Requires SETUP_SECRET_KEY token."""
    _check()
    if payload.token != SETUP_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")

    results = []

    # Migrations
    try:
        from app.db.session import engine
        import sqlalchemy as sa
        with engine.connect() as conn:
            try:
                row = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
                current = row[0] if row else None
            except Exception:
                current = None

        alembic_ini = None
        base = pathlib.Path(__file__).resolve().parent
        for _ in range(10):
            c = base / "alembic.ini"
            if c.exists():
                alembic_ini = str(c)
                break
            base = base.parent

        if alembic_ini:
            from alembic.config import Config
            from alembic import command as ac
            cfg = Config(alembic_ini)
            ac.upgrade(cfg, "head")
            results.append({"step": "migrations", "status": "ok", "detail": f"upgraded from {current}"})
        else:
            results.append({"step": "migrations", "status": "skipped", "detail": f"alembic.ini not found — version: {current}"})
    except Exception as e:
        results.append({"step": "migrations", "status": "warning", "detail": str(e)[:200]})

    # Admin user
    try:
        from app.db.session import SessionLocal
        from app.crud.user import get_user_by_email, create_user
        from app.schemas.user import UserCreate
        db = SessionLocal()
        try:
            if get_user_by_email(db, payload.admin_email):
                results.append({"step": "admin_user", "status": "skipped", "detail": f"{payload.admin_email} already exists"})
            else:
                u = create_user(db, UserCreate(
                    email=payload.admin_email, password=payload.admin_password,
                    first_name=payload.admin_first_name, last_name=payload.admin_last_name,
                    role="admin", is_active=True,
                ))
                results.append({"step": "admin_user", "status": "ok", "detail": f"Created id={u.id}"})
        finally:
            db.close()
    except Exception as e:
        results.append({"step": "admin_user", "status": "error", "detail": str(e)[:200]})

    ok = all(r["status"] in ("ok", "skipped") for r in results)
    return {
        "success": ok,
        "results": results,
        "next_steps": [f"Login with {payload.admin_email}", "Set SETUP_ENABLED=false"] if ok else ["Check errors above"],
    }
