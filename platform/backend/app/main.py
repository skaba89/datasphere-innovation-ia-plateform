from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.db.session import Base, engine
import app.models  # noqa: F401

settings = get_settings()

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    import time as _time
    import logging as _log
    import sqlalchemy as _sa

    _logger = _log.getLogger("datasphere.startup")

    # ── Wait for DB to be reachable (handles Docker startup race conditions) ──
    # PostgreSQL can pass pg_isready but not yet accept full connections.
    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as _conn:
                _conn.execute(_sa.text("SELECT 1"))
            _logger.info("✓ Database connection established (attempt %d)", attempt)
            break
        except Exception as _e:
            if attempt == max_retries:
                raise RuntimeError(
                    f"Database unreachable after {max_retries} attempts. "
                    f"Check DATABASE_URL — use service name 'postgres' (not 'localhost') in Docker. "
                    f"Last error: {_e}"
                ) from _e
            _wait = min(2 ** attempt, 30)   # 2s, 4s, 8s … capped at 30s
            _logger.warning(
                "Database not ready (attempt %d/%d), retrying in %ds — %s",
                attempt, max_retries, _wait, _e
            )
            _time.sleep(_wait)

    # ── Schema init ───────────────────────────────────────────────────────────
    # Always run Alembic migrations (create_all doesn't ALTER existing tables).
    # This ensures workspace_id and other new columns are added to existing DBs.
    try:
        from alembic.config import Config
        from alembic import command as alembic_command
        import os as _os
        alembic_cfg = Config(
            _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "alembic.ini")
        )
        alembic_command.upgrade(alembic_cfg, "head")
        _logger.info("✓ Alembic migrations applied (head)")
    except Exception as _migration_err:
        _logger.warning(
            "Alembic migration failed (%s) — falling back to create_all. "
            "This may cause 500 errors if columns are missing. "
            "Fix: docker compose down -v && docker compose up -d",
            _migration_err,
        )
        Base.metadata.create_all(bind=engine)

    from app.services import scheduler_service
    scheduler_service.start()
    yield
    scheduler_service.stop()


app = FastAPI(
    title="DataSphere Innovation IA Platform",
    description="""
## Cabinet de conseil augmenté par IA — France & Afrique

DataSphere est une plateforme SaaS pour consultants **Data / IA / Tech** qui automatise :
- La gestion CRM des missions et clients
- La veille et réponse aux **appels d'offres** (BOAMP + sources africaines)
- La génération de **livrables** (mémoires techniques, propales, CV)
- L'orchestration d'**agents IA** pour l'automatisation des tâches

### Authentification

Toutes les routes protégées requièrent un **JWT Bearer token** :
```
Authorization: Bearer <access_token>
```
Obtenir un token : `POST /api/v1/auth/login`

Pour les intégrations tierces (Zapier, Make, scripts), utiliser une **clé API** :
```
Authorization: Bearer ds_live_xxxx_<secret>
```
Créer une clé : `POST /api/v1/api-keys`

### Workspaces (multi-tenant)

Optionnellement, spécifier un workspace pour isoler les données :
```
X-Workspace-ID: 42
```
ou paramètre `?workspace_id=42`.

### Limites

- Rate limit : **60 req/min** par IP
- Upload PDF : **25 MB** max
- Tokens JWT : **60 min** (access) / **30 jours** (refresh)
""",
    version="1.9.0",
    debug=settings.app_debug,
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
    openapi_tags=[
        {"name": "auth",          "description": "Authentification, inscription, tokens JWT"},
        {"name": "organizations", "description": "Gestion des organisations clientes"},
        {"name": "contacts",      "description": "Contacts et interlocuteurs CRM"},
        {"name": "opportunities", "description": "Pipeline commercial — opportunités de mission"},
        {"name": "tenders",       "description": "Appels d'offres — qualification, exigences, Go/No-Go"},
        {"name": "tender-watch",  "description": "Veille AO — BOAMP + sources africaines"},
        {"name": "pdf-ao",        "description": "Import AO depuis PDF — extraction intelligente"},
        {"name": "deliverables",  "description": "Livrables — génération, révision, approbation, versioning"},
        {"name": "agents",        "description": "Agents IA — profils consultants, automatisation"},
        {"name": "billing",       "description": "Abonnements Stripe — plans, checkout, quotas"},
        {"name": "calculator",    "description": "Calculateur de rentabilité freelance"},
        {"name": "api-keys",      "description": "Clés API publique pour intégrations tierces"},
        {"name": "email",         "description": "Email — envoi, preview, séquences de relance"},
        {"name": "export",        "description": "Export livrables — PDF, HTML, Markdown, Excel"},
        {"name": "analytics",     "description": "Métriques pipeline, performance, dashboard"},
        {"name": "workspaces",    "description": "Gestion workspaces — membres, plans, isolation"},
        {"name": "team",          "description": "Équipe — invitations, rôles, profils"},
        {"name": "audit-logs",    "description": "Journal d'audit des actions utilisateurs"},
        {"name": "health",        "description": "Santé système — base de données, SMTP, scheduler"},
        {"name": "notifications", "description": "Notifications — SSE temps réel, compteurs"},
        {"name": "search",        "description": "Recherche globale — organisations, AO, livrables"},
        {"name": "scheduler",     "description": "Scheduler — jobs récurrents BOAMP, diagnostics"},
    ],
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Log CORS config at startup so it's visible in server logs
import logging as _log
_cors_origins = settings.cors_origin_list
_log.getLogger("datasphere").info(
    "CORS allowed origins (%d): %s", len(_cors_origins), ", ".join(_cors_origins)
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(500)
@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception):
    """
    Global 500 handler that always includes CORS headers.

    Without this, when SQLAlchemy or any unhandled exception crashes a route,
    FastAPI returns 500 without CORS headers — the browser then shows a
    misleading 'CORS policy' error instead of the real 500.

    Root cause of 500 is often: DB schema mismatch (column exists in ORM
    but not in DB because migrations were not run → run: alembic upgrade head
    or reset the DB volume: docker compose down -v && docker compose up -d).
    """
    import traceback
    from fastapi.responses import JSONResponse

    origin = request.headers.get("origin", "")
    allowed = _cors_origins

    _log.getLogger("datasphere").error(
        "Unhandled exception on %s %s: %s",
        request.method, request.url.path, exc,
        exc_info=True,
    )

    headers = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": origin if (origin in allowed or "*" in allowed) else "",
    }

    detail = str(exc)
    if settings.app_env == "production":
        detail = "Internal server error"

    return JSONResponse(
        status_code=500,
        content={"detail": detail, "type": type(exc).__name__},
        headers=headers,
    )



@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.app_env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {
        "message": "Welcome to DataSphere Innovation IA Platform API",
        "docs":    "/docs",
        "version": "1.9.0",
        "health":  f"{settings.api_v1_prefix}/health",
    }
