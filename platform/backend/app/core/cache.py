"""
Cache in-memory avec TTL — DataSphere Innovation IA Platform.

Léger et sans dépendance externe (pas de Redis requis en dev).
Pour la prod avec plusieurs workers, remplacer par Redis.

Usage :
    from app.core.cache import cache

    # Décorer une fonction
    @cache.ttl(300)   # 5 minutes
    def expensive_query():
        ...

    # API manuelle
    result = cache.get("analytics_pipeline")
    if result is None:
        result = compute()
        cache.set("analytics_pipeline", result, ttl=300)
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

log = logging.getLogger("datasphere.cache")


class TTLCache:
    """
    Thread-safe in-memory cache with per-entry TTL.
    Entries are lazily evicted on access.
    """

    def __init__(self, default_ttl: int = 60):
        self._store: dict[str, tuple[Any, float]] = {}   # key → (value, expires_at)
        self._lock  = threading.Lock()
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires_at = time.monotonic() + (ttl if ttl is not None else self._default_ttl)
        with self._lock:
            self._store[key] = (value, expires_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self, prefix: str | None = None) -> int:
        """Clear all keys, or keys matching prefix. Returns count deleted."""
        with self._lock:
            if prefix is None:
                count = len(self._store)
                self._store.clear()
            else:
                keys = [k for k in self._store if k.startswith(prefix)]
                for k in keys:
                    del self._store[k]
                count = len(keys)
        log.debug("Cache cleared: %d entries (prefix=%s)", count, prefix)
        return count

    def stats(self) -> dict:
        now = time.monotonic()
        with self._lock:
            total  = len(self._store)
            valid  = sum(1 for _, (_, exp) in self._store.items() if exp > now)
            stale  = total - valid
        return {"total": total, "valid": valid, "stale": stale}

    def ttl_decorator(self, seconds: int = 60):
        """Decorator — caches function result by (func_name, args, kwargs)."""
        def decorator(fn):
            def wrapper(*args, **kwargs):
                key = f"fn:{fn.__module__}.{fn.__name__}:{args!r}:{sorted(kwargs.items())!r}"
                cached = self.get(key)
                if cached is not None:
                    return cached
                result = fn(*args, **kwargs)
                self.set(key, result, ttl=seconds)
                return result
            wrapper.__wrapped__ = fn  # type: ignore[attr-defined]
            return wrapper
        return decorator


# ── Singleton ─────────────────────────────────────────────────────────────────

cache = TTLCache(default_ttl=120)

# Pre-defined TTLs
ANALYTICS_TTL = 120    # 2 min — dashboard pipeline metrics
HEALTH_TTL    = 30     # 30s  — health checks
BOAMP_TTL     = 3600   # 1h   — BOAMP search results
PLANS_TTL     = 900    # 15m  — billing plans (rarely change)
PRESETS_TTL   = 3600   # 1h   — calculator presets
