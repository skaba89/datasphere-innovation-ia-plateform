from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# bcrypt rounds=10 : ~70ms verify (vs 280ms à rounds=12 par défaut).
# Render free plan : 1 CPU partagé, 10 = bon équilibre sécurité/latence.
# NIST SP 800-132 recommande min 10 000 itérations ≈ rounds≥10 pour bcrypt.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)
settings = get_settings()

ALGORITHM = "HS256"
REFRESH_TOKEN_EXPIRE_DAYS = 30
RESET_TOKEN_EXPIRE_MINUTES = 60


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """Long-lived refresh token (30 days). Silently renews access tokens."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "refresh"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_reset_token(email: str) -> str:
    """Short-lived password reset token (60 min). Subject = email."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {"sub": email, "exp": expire, "type": "reset"}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Backwards-compat: decode without type check (old tokens have no 'type')."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None


def decode_token(token: str, expected_type: str) -> dict[str, Any] | None:
    """Decode and validate a token, checking its type claim."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        tok_type = payload.get("type")
        # Allow missing type for access tokens (backwards compat)
        if expected_type == "access" and tok_type in (None, "access"):
            return payload
        if tok_type != expected_type:
            return None
        return payload
    except JWTError:
        return None
