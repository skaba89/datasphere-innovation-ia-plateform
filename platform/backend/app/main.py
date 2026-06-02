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
    # Startup: use create_all in dev, alembic in prod
    if settings.app_env == "production":
        from alembic.config import Config
        from alembic import command
        import os
        alembic_cfg = Config(
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini")
        )
        command.upgrade(alembic_cfg, "head")
    else:
        Base.metadata.create_all(bind=engine)

    from app.services import scheduler_service
    scheduler_service.start()
    yield
    scheduler_service.stop()


app = FastAPI(
    title=settings.app_name,
    description="Cabinet de conseil augmenté par IA — DataSphere Innovation",
    version="1.6.0",
    debug=settings.app_debug,
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        "docs": "/docs",
        "version": "1.6.0",
        "health": f"{settings.api_v1_prefix}/health",
    }
