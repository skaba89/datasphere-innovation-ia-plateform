from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.crud.user import get_user
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token: str | None = Query(default=None, alias="token"),  # SSE fallback
    db: Session = Depends(get_db),
) -> User:
    # Check Authorization header first, then query param (EventSource workaround)
    raw_token = credentials.credentials if credentials else token
    if raw_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(raw_token)
    if payload is None or payload.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = get_user(db, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or unknown user")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


# ── Pagination ──────────────────────────────────────────────────────────────────

from fastapi import Query
from dataclasses import dataclass

@dataclass
class PaginationParams:
    """Standard pagination parameters for list endpoints."""
    skip:  int = Query(default=0,    ge=0,      description="Nombre d'éléments à sauter")
    limit: int = Query(default=50,   ge=1, le=500, description="Nombre max d'éléments retournés")

def get_pagination(skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)) -> PaginationParams:
    """FastAPI dependency for pagination."""
    return PaginationParams(skip=skip, limit=limit)
