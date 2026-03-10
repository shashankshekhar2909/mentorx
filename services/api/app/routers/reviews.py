from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.review import MentorReview
from ..models.user import User
from ..schemas.review import ReviewCreate

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("")
def create_review(payload: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != Role.student and user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can review sessions")

    row = MentorReview(
        session_id=payload.session_id,
        mentor_id=payload.mentor_id,
        student_id=user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review already submitted for this session")

    return {"message": "Review submitted"}
