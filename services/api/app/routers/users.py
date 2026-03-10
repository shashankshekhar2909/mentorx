from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..core.database import get_db
from ..models.category import Category
from ..models.profile import Profile
from ..models.user import User
from ..schemas.profile import ProfileOut, ProfileUpsert
from ..schemas.user import UserMe

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMe)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/me/profile", response_model=ProfileOut)
def my_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/me/profile", response_model=ProfileOut)
def upsert_profile(payload: ProfileUpsert, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)

    profile.full_name = payload.full_name
    profile.bio = payload.bio
    profile.timezone = payload.timezone
    profile.language = payload.language
    if payload.target_exams is not None:
        requested = {item.strip().lower() for item in payload.target_exams.split(",") if item.strip()}
        allowed = {row.slug.lower() for row in db.query(Category).filter(Category.is_active == True).all()}  # noqa: E712
        profile.target_exams = ",".join(sorted(requested & allowed))
    else:
        profile.target_exams = None

    db.commit()
    db.refresh(profile)
    return profile
