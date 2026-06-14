import os
"""
Settings Admin — GET /settings/status
Retourne l'état de toutes les configurations clés (sans exposer les secrets).
"""
from fastapi import APIRouter, Depends
from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings-admin"])


@router.get("/status")
def get_settings_status(current_user: User = Depends(get_current_user)) -> dict:
    """Retourne le statut de toutes les configurations (masque les secrets)."""
    s = get_settings()

    def mask(val: str, show: int = 4) -> str:
        if not val: return ""
        if len(val) <= show: return "***"
        return val[:show] + "..." + val[-2:]

    return {
        "email": {
            "configured": bool(s.smtp_host and s.smtp_user),
            "smtp_host":  s.smtp_host or None,
            "smtp_port":  s.smtp_port,
            "smtp_user":  s.smtp_user or None,
            "smtp_from":  s.smtp_from or None,
            "tls":        s.smtp_tls,
            "status":     "✅ Configuré" if (s.smtp_host and s.smtp_user and s.smtp_password) else "❌ Non configuré",
        },
        "llm": {
            "groq":      bool(getattr(s, 'groq_api_key', '')),
            "openai":    bool(getattr(s, 'openai_api_key', '')),
            "anthropic": bool(getattr(s, 'anthropic_api_key', '')),
            "gemini":    bool(getattr(s, 'gemini_api_key', '')),
            "mistral":   bool(getattr(s, 'mistral_api_key', '')),
            "active_provider": (
                "groq"      if getattr(s, 'groq_api_key', '') else
                "openai"    if getattr(s, 'openai_api_key', '') else
                "gemini"    if getattr(s, 'gemini_api_key', '') else
                "simulation"
            ),
            "status": "✅ Configuré" if getattr(s, 'groq_api_key', '') else "❌ Aucun provider LLM actif — mode simulation",
        },
        "stripe": {
            "configured": s.stripe_enabled,
            "mode":       "live" if (s.stripe_secret_key or "").startswith("sk_live_") else "test",
            "status":     "✅ Live" if (s.stripe_enabled and "live" in (s.stripe_secret_key or "")) else ("⚠️ Test mode" if s.stripe_enabled else "❌ Non configuré"),
        },
        "monitoring": {
            "sentry":     bool(s.sentry_dsn),
            "status":     "✅ Actif" if s.sentry_dsn else "❌ Non configuré",
        },
        "security": {
            "secret_key_strength": "✅ Fort (32+ chars)" if len(s.secret_key) >= 32 else "❌ Trop court",
            "setup_disabled": os.environ.get("SETUP_ENABLED", "true").lower() == "false",
            "scheduler":      s.scheduler_enabled,
        },
        "app": {
            "env":     s.app_env,
            "version": "2.3.1",
            "debug":   s.app_env == "development",
        }
    }
