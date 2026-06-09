"""
Providers endpoint — list all LLM providers and their recommendations.

GET  /providers                     — all providers sorted by cost (free first)
GET  /providers/recommendations     — full strategy + tips
GET  /providers/recommendations?task_type=<type> — per-task recommendation
GET  /providers/active              — only configured/active providers
POST /providers/{name}/test         — test a provider with a quick ping
POST /providers/config              — update API keys at runtime (writes to os.environ)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.llm_service import (
    list_providers,
    get_recommendations,
    provider_label,
    _DEFAULT_ORDER,
    TIER_ORDER,
    PROVIDER_REGISTRY,
    _PROVIDER_MAP,
)

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("")
def get_providers(current_user: User = Depends(get_current_user)) -> dict:
    """Return all LLM providers sorted by cost (free → near-free → budget → standard → premium)."""
    providers = list_providers()
    configured = [p for p in providers if p["configured"]]
    unconfigured = [p for p in providers if not p["configured"]]

    return {
        "providers": providers,
        "summary": {
            "total": len(providers),
            "configured": len(configured),
            "unconfigured": len(unconfigured),
            "active_provider": provider_label(),
            "priority_order": _DEFAULT_ORDER,
            "free_providers_configured": [
                p["name"] for p in providers
                if p["configured"] and p["tier"] in ("free", "near-free")
            ],
        },
    }


@router.get("/active")
def get_active_providers(current_user: User = Depends(get_current_user)) -> dict:
    """Return only configured providers in active priority order."""
    all_providers = list_providers()
    active = [p for p in all_providers if p["configured"]]
    return {
        "active_providers": active,
        "count": len(active),
        "current": provider_label(),
        "fallback_chain": [p["name"] for p in active],
    }


@router.post("/{provider_name}/test")
def test_provider(
    provider_name: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Send a minimal test prompt to a provider to verify the API key works.
    Returns latency and model used.
    """
    import time
    from app.services.llm_service import _PROVIDER_MAP, _call_anthropic
    from app.core.config import get_settings

    if provider_name not in _PROVIDER_MAP:
        raise HTTPException(status_code=404, detail=f"Provider '{provider_name}' inconnu")

    settings = get_settings()
    key_attr, call_fn = _PROVIDER_MAP[provider_name]
    key_value = getattr(settings, key_attr, "")

    if not key_value:
        raise HTTPException(
            status_code=400,
            detail=f"Clé API manquante pour '{provider_name}'. Configurez {key_attr.upper()} dans votre .env"
        )

    t0 = time.monotonic()
    try:
        result = call_fn(
            "Réponds uniquement par 'OK' sans rien ajouter.",
            "Réponds uniquement 'OK'.",
            settings,
        )
        ms = int((time.monotonic() - t0) * 1000)
        info = PROVIDER_REGISTRY.get(provider_name)
        model = getattr(settings, f"llm_model_{provider_name}", "") or (info.default_model if info else "?")
        return {
            "success": True,
            "provider": provider_name,
            "model": model,
            "latency_ms": ms,
            "response_preview": result[:80] if result else "",
            "message": f"✅ {provider_name} opérationnel ({ms}ms)",
        }
    except Exception as e:
        ms = int((time.monotonic() - t0) * 1000)
        return {
            "success": False,
            "provider": provider_name,
            "latency_ms": ms,
            "error": str(e)[:200],
            "message": f"❌ {provider_name} — {str(e)[:100]}",
        }


class ProviderKeyUpdate(BaseModel):
    provider: str
    api_key: str
    model: str | None = None


@router.post("/config")
def update_provider_key(
    payload: ProviderKeyUpdate,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Update a provider API key at runtime (stored in os.environ for the session).
    For persistence, add the key to your .env file.
    Only admin users can update provider keys.
    """
    import os
    from app.core.config import get_settings

    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Seuls les admins peuvent configurer les providers")

    if payload.provider not in _PROVIDER_MAP:
        raise HTTPException(status_code=404, detail=f"Provider '{payload.provider}' inconnu")

    key_attr, _ = _PROVIDER_MAP[payload.provider]
    env_var = key_attr.upper()

    # Update environment
    os.environ[env_var] = payload.api_key

    if payload.model:
        model_env = f"LLM_MODEL_{payload.provider.upper()}"
        os.environ[model_env] = payload.model

    # Invalidate settings cache
    import app.core.config as _cfg
    if hasattr(_cfg, "_settings"):
        _cfg._settings = None

    return {
        "success": True,
        "provider": payload.provider,
        "env_var": env_var,
        "model_set": payload.model,
        "message": (
            f"Clé {payload.provider} mise à jour pour cette session. "
            f"Pour la persistance, ajoutez {env_var}=... à votre .env"
        ),
    }


@router.get("/recommendations")
def get_provider_recommendations(
    task_type: str | None = Query(default=None, description="Filter by task type"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return provider recommendations. Without task_type: full strategy."""
    return get_recommendations(task_type)
