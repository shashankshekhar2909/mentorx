from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import hash_password, verify_password, create_access_token, create_refresh_token
from ..core.rbac import Role
from ..models.user import User
from ..schemas.auth import RegisterRequest, TokenPair

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    try:
        role = Role(payload.role)
    except ValueError:
        role = Role.student

    if role not in (Role.student, Role.mentor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only student and mentor accounts can be created from public registration",
        )

    user = User(email=payload.email, hashed_password=hash_password(payload.password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)

    access = create_access_token(user.email, {"role": user.role.value})
    refresh = create_refresh_token(user.email, {"role": user.role.value})
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenPair)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access = create_access_token(user.email, {"role": user.role.value})
    refresh = create_refresh_token(user.email, {"role": user.role.value})
    return TokenPair(access_token=access, refresh_token=refresh)
