from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.category import Category
from ..models.chat_thread import ChatThread
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.user import User
from ..schemas.mentor import MentorCard, MentorDiscoveryCard, MentorStudentCard

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


@router.get("/discover", response_model=list[MentorDiscoveryCard])
def discover_mentors(
    category: str | None = Query(default=None, description="Single category/subject slug"),
    max_price: float | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != Role.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can browse mentor discovery")

    normalized_category = (category or "").strip().lower()

    query = db.query(MentorProfile).filter(MentorProfile.verification_status == MentorVerificationStatus.approved)
    if max_price is not None:
        query = query.filter(MentorProfile.hourly_price <= max_price)

    all_mentors = query.order_by(MentorProfile.rating_avg.desc()).all()
    threads = db.query(ChatThread).filter(ChatThread.student_id == user.id).all()
    thread_map = {(row.mentor_id, row.subject): row for row in threads}
    mentor_connection_map: dict[str, ChatThread] = {}
    for row in threads:
        current = mentor_connection_map.get(row.mentor_id)
        if current is None or (current.status != "active" and row.status == "active"):
            mentor_connection_map[row.mentor_id] = row

    cards: list[MentorDiscoveryCard] = []
    for m in all_mentors:
        mentor_subjects = {x.strip().lower() for x in (m.exams or "").split(",") if x.strip()}
        matched_thread = None
        if normalized_category:
            matched_thread = thread_map.get((m.user_id, normalized_category))
        if matched_thread is None:
            matched_thread = mentor_connection_map.get(m.user_id)
        matches_filter = not normalized_category or normalized_category in mentor_subjects
        is_connected = bool(matched_thread and matched_thread.status == "active")
        is_requested = bool(matched_thread and matched_thread.status == "pending")
        if not matches_filter and not (is_connected or is_requested):
            continue
        cards.append(MentorDiscoveryCard(
            user_id=m.user_id,
            headline=m.headline,
            exams=m.exams,
            years_experience=m.years_experience,
            hourly_price=float(m.hourly_price),
            rating_avg=float(m.rating_avg),
            connection_status=(matched_thread.status if matched_thread else None),
            connection_thread_id=(matched_thread.id if matched_thread else None),
            is_connected=is_connected,
            is_requested=is_requested,
        ))
    cards.sort(key=lambda row: (not row.is_connected, not row.is_requested, -row.rating_avg))
    return cards


@router.get("/me/students", response_model=list[MentorStudentCard])
def list_my_students(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in (Role.mentor, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentors can view students")

    threads = db.query(ChatThread).filter(ChatThread.mentor_id == user.id).order_by(ChatThread.updated_at.desc()).all()
    students = {row.id: db.query(User).filter(User.id == row.student_id).first() for row in threads}
    sessions = (
        db.query(MentorshipSession)
        .filter(
            MentorshipSession.mentor_id == user.id,
            MentorshipSession.status.in_([SessionStatus.confirmed, SessionStatus.ready_to_join, SessionStatus.in_progress]),
        )
        .order_by(MentorshipSession.starts_at.asc())
        .all()
    )
    session_map: dict[str, MentorshipSession] = {}
    for row in sessions:
        if row.student_id not in session_map:
            session_map[row.student_id] = row

    return [
        MentorStudentCard(
            student_id=row.student_id,
            student_email=(students[row.id].email if students.get(row.id) else row.student_id),
            subject=row.subject,
            connection_status=row.status,
            connection_thread_id=row.id,
            upcoming_session_id=(session_map[row.student_id].id if row.student_id in session_map else None),
            upcoming_session_starts_at=(session_map[row.student_id].starts_at.isoformat() if row.student_id in session_map else None),
        )
        for row in threads
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
