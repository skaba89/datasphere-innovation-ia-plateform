from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    try:
        return db.query(User).filter(User.email == email.lower()).first()
    except Exception as e:
        # Fallback si une colonne manque (ex: extra_data avant migration)
        if "extra_data" in str(e) or "UndefinedColumn" in str(e) or "does not exist" in str(e):
            from sqlalchemy import text
            row = db.execute(
                text("SELECT id, first_name, last_name, email, password_hash, role, is_active, created_at FROM users WHERE email = :email LIMIT 1"),
                {"email": email.lower()}
            ).fetchone()
            if row is None:
                return None
            # Reconstruct minimal User object
            user = User()
            user.id = row[0]; user.first_name = row[1]; user.last_name = row[2]
            user.email = row[3]; user.password_hash = row[4]; user.role = row[5]
            user.is_active = row[6]; user.created_at = row[7]
            user.extra_data = None  # Column not yet in DB
            return user
        raise


def count_users(db: Session) -> int:
    return db.query(User).count()


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        email=payload.email.lower(),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        is_active=payload.is_active,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_users(db: Session, role: str | None = None, skip: int = 0, limit: int = 100) -> list[User]:
    q = db.query(User).order_by(User.created_at.desc())
    if role:
        q = q.filter(User.role == role)
    return q.offset(skip).limit(limit).all()


def update_user(db: Session, user: User, **fields) -> User:
    for k, v in fields.items():
        if v is not None:
            setattr(user, k, v)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user: User) -> User:
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, new_password: str) -> User:
    from app.core.security import get_password_hash
    user.password_hash = get_password_hash(new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
