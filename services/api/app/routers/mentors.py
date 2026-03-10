from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.category import Category
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.user import User
from ..schemas.mentor import MentorCard

router = APIRouter(prefix="/mentors", tags=["mentors"])


@router.get("", response_model=list[MentorCard])
def list_mentors(
    exam: str | None = Query(default=None),
    categories: str | None = Query(default=None, description="Comma-separated categories/exams"),
    max_price: float | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(MentorProfile).filter(MentorProfile.verification_status == MentorVerificationStatus.approved)
    if max_price is not None:
        query = query.filter(MentorProfile.hourly_price <= max_price)

    mentors = query.order_by(MentorProfile.rating_avg.desc()).all()
    requested = {item.strip().lower() for item in (categories or "").split(",") if item.strip()}
    if exam:
        requested.add(exam.strip().lower())
    if requested:
        mentors = [
            row
            for row in mentors
            if {x.strip().lower() for x in (row.exams or "").split(",") if x.strip()} & requested
        ]
    return [
        MentorCard(
            user_id=m.user_id,
            headline=m.headline,
            exams=m.exams,
            years_experience=m.years_experience,
            hourly_price=float(m.hourly_price),
            rating_avg=float(m.rating_avg),
        )
        for m in mentors
    ]


@router.put("/me")
def upsert_my_mentor_profile(
    headline: str | None = None,
    exams: str | None = None,
    years_experience: int | None = None,
    hourly_price: float | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (Role.mentor, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentors can edit mentor profile")

    row = db.query(MentorProfile).filter(MentorProfile.user_id == user.id).first()
    if not row:
        row = MentorProfile(user_id=user.id)
        db.add(row)

    if headline is not None:
        row.headline = headline
    if exams is not None:
        requested = {item.strip().lower() for item in exams.split(",") if item.strip()}
        allowed = {cat.slug.lower() for cat in db.query(Category).filter(Category.is_active == True).all()}  # noqa: E712
        row.exams = ",".join(sorted(requested & allowed))
    if years_experience is not None:
        row.years_experience = years_experience
    if hourly_price is not None:
        row.hourly_price = hourly_price

    db.commit()

    return {
        "mentor_user_id": row.user_id,
        "headline": row.headline,
        "exams": row.exams,
        "years_experience": row.years_experience,
        "hourly_price": float(row.hourly_price),
        "verification_status": row.verification_status,
    }


@router.get("/{mentor_user_id}")
def mentor_detail(mentor_user_id: str, db: Session = Depends(get_db)):
    row = db.query(MentorProfile).filter(MentorProfile.user_id == mentor_user_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentor profile not found")
    return {
        "mentor_user_id": row.user_id,
        "headline": row.headline,
        "exams": row.exams,
        "years_experience": row.years_experience,
        "hourly_price": float(row.hourly_price),
        "rating_avg": float(row.rating_avg),
        "verification_status": row.verification_status,
    }
