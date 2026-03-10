from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.user import User
from ..schemas.session import BookingCreate, SessionOut

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _build_session_title(raw_title: str | None, starts_at) -> str:
    title = (raw_title or "").strip()
    if title and title.lower() not in {"mentorship session", "student call request"}:
        return title
    return f"MentorX Session {starts_at.strftime('%d %b %Y %H:%M UTC')}"


@router.post("", response_model=SessionOut)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != Role.student and user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can create bookings")

    mentor = db.query(MentorProfile).filter(MentorProfile.user_id == payload.mentor_id).first()
    if not mentor or mentor.verification_status != MentorVerificationStatus.approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mentor is not approved for booking")

    session = MentorshipSession(
        student_id=user.id,
        mentor_id=payload.mentor_id,
        title=_build_session_title(payload.title, payload.starts_at),
        notes=payload.notes,
        starts_at=payload.starts_at,
        duration_minutes=payload.duration_minutes,
        status=SessionStatus.pending_mentor_approval,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/mine", response_model=list[SessionOut])
def my_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == Role.student:
        rows = db.query(MentorshipSession).filter(MentorshipSession.student_id == user.id).all()
    elif user.role == Role.mentor:
        rows = db.query(MentorshipSession).filter(MentorshipSession.mentor_id == user.id).all()
    else:
        rows = db.query(MentorshipSession).all()
    return rows
