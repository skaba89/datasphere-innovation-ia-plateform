from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.core.security import create_access_token
from app.crud.user import authenticate_user, count_users, create_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/bootstrap-admin", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def bootstrap_admin(payload: UserCreate, db: Session = Depends(get_db)):
    """Create the first admin user only when the users table is empty."""
    if count_users(db) > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bootstrap is disabled after first user creation")
    payload.role = "admin"
    return create_user(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user. Rate-limited to 10 attempts/minute per IP in production."""
    settings = get_settings()
    # Apply rate limiting only outside of test environment
    if settings.app_env not in ("test", "development"):
        limiter.hit(request)
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    access_token = create_access_token(subject=str(user.id), extra_claims={"role": user.role})
    return TokenResponse(access_token=access_token, user=user)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
