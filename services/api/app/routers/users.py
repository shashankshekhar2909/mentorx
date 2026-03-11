from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.rbac import Role
from ..core.deps import get_current_user
from ..core.database import get_db
from ..models.category import Category
from ..models.profile import Profile
from ..models.session import Session as MentorshipSession
from ..models.session_recording import SessionRecording
from ..models.session_recording_visibility import SessionRecordingVisibility
from ..models.user import User
from ..schemas.profile import ProfileIdentityOut, ProfileOut, ProfileUpsert
from ..schemas.user import UserMe
from ..services.recording_service import RecordingService

router = APIRouter(prefix="/users", tags=["users"])
recording_service = RecordingService()


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


@router.get("/me/account", response_model=ProfileIdentityOut)
def my_account(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return ProfileIdentityOut(
        user_id=profile.user_id,
        full_name=profile.full_name,
        bio=profile.bio,
        timezone=profile.timezone,
        language=profile.language,
        target_exams=profile.target_exams,
        email=user.email,
        role=user.role,
        display_name=profile.full_name or user.email,
    )


@router.get("/me/dashboard-summary")
def my_dashboard_summary(
    session_limit: int = Query(6, ge=1, le=20),
    recording_limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile_rows = {row.user_id: row for row in db.query(Profile).all()}
    user_rows = {row.id: row for row in db.query(User).all()}
    visibility_rows = {row.session_id: row for row in db.query(SessionRecordingVisibility).all()}

    def label_for(user_id: str) -> str:
        profile = profile_rows.get(user_id)
        if profile and profile.full_name and profile.full_name.strip():
            return profile.full_name.strip()
        row = user_rows.get(user_id)
        return row.email if row else user_id

    if user.role == Role.mentor:
        sessions = (
            db.query(MentorshipSession)
            .filter(MentorshipSession.mentor_id == user.id)
            .order_by(MentorshipSession.starts_at.desc())
            .limit(session_limit)
            .all()
        )
    elif user.role == Role.student:
        sessions = (
            db.query(MentorshipSession)
            .filter(MentorshipSession.student_id == user.id)
            .order_by(MentorshipSession.starts_at.desc())
            .limit(session_limit)
            .all()
        )
    else:
        sessions = db.query(MentorshipSession).order_by(MentorshipSession.starts_at.desc()).limit(session_limit).all()

    session_ids = {row.id for row in sessions}
    recordings_query = db.query(SessionRecording).filter(SessionRecording.deleted_at.is_(None))
    if session_ids:
        recordings_query = recordings_query.filter(SessionRecording.session_id.in_(session_ids))
    recordings = recordings_query.order_by(SessionRecording.created_at.desc(), SessionRecording.updated_at.desc()).limit(recording_limit * 3).all()

    recording_items = []
    latest_by_session: dict[str, SessionRecording] = {}
    for row in recordings:
        existing = latest_by_session.get(row.session_id)
        if not existing:
            latest_by_session[row.session_id] = row
            continue
        row_created = row.created_at or row.updated_at
        existing_created = existing.created_at or existing.updated_at
        if row_created and existing_created and row_created > existing_created:
            latest_by_session[row.session_id] = row

    for row in latest_by_session.values():
        session = next((item for item in sessions if item.id == row.session_id), None)
        if not session:
            continue
        policy = visibility_rows.get(row.session_id)
        if user.role == Role.student and policy and not policy.visible_to_student:
            continue
        recording_items.append(
            {
                "id": row.id,
                "session_id": row.session_id,
                "attempt_number": row.attempt_number,
                "status": row.status,
                "playback_url": recording_service.storage.presign_get(row.object_key) if row.object_key else None,
                "error_message": row.error_message,
                "created_at": row.created_at,
                "title": session.title,
                "starts_at": session.starts_at,
                "duration_minutes": session.duration_minutes,
            }
        )
    recording_items.sort(
        key=lambda item: str(item.get("created_at") or item.get("starts_at") or ""),
        reverse=True,
    )

    return {
        "sessions": [
            {
                "id": row.id,
                "title": row.title,
                "status": row.status,
                "starts_at": row.starts_at,
                "duration_minutes": row.duration_minutes,
                "student_id": row.student_id,
                "mentor_id": row.mentor_id,
                "student_name": label_for(row.student_id),
                "mentor_name": label_for(row.mentor_id),
            }
            for row in sessions
        ],
        "recordings": recording_items[:recording_limit],
    }


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
