"""
Cache in-memory pour les endpoints analytiques lourds.

Stratégie :
  - TTL-based cache (60s pour dashboard KPIs, 5min pour timeline)
  - Thread-safe (Lock pour les écritures)
  - Auto-invalidation par événement (tender.created, deliverable.approved)
  - Pas de Redis requis — works on free Render plan
"""

from __future__ import annotations
import logging
import threading
import time
from typing import Any

log = logging.getLogger("datasphere.cache")

# ── In-memory TTL cache ────────────────────────────────────────────────────────

_cache: dict[str, tuple[Any, float]] = {}  # {key: (value, expires_at)}
_lock  = threading.Lock()


def cache_get(key: str) -> Any | None:
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del _cache[key]
            return None
        return value


def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    with _lock:
        _cache[key] = (value, time.monotonic() + ttl)


def cache_delete(key: str) -> None:
    with _lock:
        _cache.pop(key, None)


def cache_invalidate_prefix(prefix: str) -> int:
    """Delete all keys starting with prefix. Returns count deleted."""
    with _lock:
        keys = [k for k in _cache if k.startswith(prefix)]
        for k in keys:
            del _cache[k]
        return len(keys)


def cache_stats() -> dict:
    with _lock:
        now = time.monotonic()
        active = {k: v for k, (v, exp) in _cache.items() if exp > now}
        expired = len(_cache) - len(active)
        return {"active_keys": len(active), "expired_keys": expired, "total": len(_cache)}


# ── Decorator ─────────────────────────────────────────────────────────────────

def cached(key: str, ttl: int = 60):
    """
    Decorator for caching function results.
    Usage:
        @cached("dashboard_kpis", ttl=60)
        def get_kpis(db): ...
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            hit = cache_get(key)
            if hit is not None:
                log.debug("Cache HIT: %s", key)
                return hit
            log.debug("Cache MISS: %s", key)
            result = func(*args, **kwargs)
            cache_set(key, result, ttl)
            return result
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator


# ── Event-driven invalidation ──────────────────────────────────────────────────

def invalidate_analytics() -> None:
    """Call when any data changes (tender, deliverable, opportunity, etc.)."""
    n = cache_invalidate_prefix("analytics:")
    log.debug("Cache invalidated: %d analytics keys", n)


def invalidate_dashboard() -> None:
    """Targeted invalidation for dashboard KPIs only."""
    cache_delete("analytics:dashboard_kpis")
    cache_delete("analytics:pipeline")
    log.debug("Dashboard cache invalidated")
