import json
import shutil
import subprocess

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.dispute import Dispute
from ..models.manager_scope import ManagerScope
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.payment import Payment, PaymentStatus
from ..models.profile import Profile
from ..models.resource import Resource
from ..models.session import Session as MentorshipSession
from ..models.session_recording import SessionRecording
from ..models.session_recording_visibility import SessionRecordingVisibility
from ..models.user import User
from ..schemas.admin import DisputeUpdate, ManagerScopeUpdate, MentorVerificationUpdate
from ..services.livekit_service import LiveKitService
from ..services.recording_service import RecordingService
from ..services.storage_service import StorageService

router = APIRouter(prefix="/admin", tags=["admin"])
recording_service = RecordingService()
storage_service = StorageService()
livekit_service = LiveKitService()


def _require_admin(user: User) -> None:
    if user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")


def _require_admin_or_manager(user: User) -> None:
    if user.role not in (Role.admin, Role.manager):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin/Manager only")


def _parse_categories_csv(value: str | None) -> set[str]:
    if not value:
        return set()
    return {item.strip().lower() for item in value.split(",") if item.strip()}


def _display_label(user_rows: dict[str, User], profile_rows: dict[str, Profile], user_id: str) -> str:
    profile = profile_rows.get(user_id)
    if profile and profile.full_name and profile.full_name.strip():
        return profile.full_name.strip()
    user = user_rows.get(user_id)
    return user.email if user else user_id


def _session_payload(row: MentorshipSession, user_rows: dict[str, User], profile_rows: dict[str, Profile]) -> dict:
    return {
        "id": row.id,
        "student_id": row.student_id,
        "mentor_id": row.mentor_id,
        "student_name": _display_label(user_rows, profile_rows, row.student_id),
        "mentor_name": _display_label(user_rows, profile_rows, row.mentor_id),
        "student_email": user_rows.get(row.student_id).email if user_rows.get(row.student_id) else row.student_id,
        "mentor_email": user_rows.get(row.mentor_id).email if user_rows.get(row.mentor_id) else row.mentor_id,
        "title": row.title,
        "status": row.status,
        "starts_at": row.starts_at,
        "duration_minutes": row.duration_minutes,
        "actual_duration_seconds": row.actual_duration_seconds,
        "is_instant": row.is_instant,
    }


def _docker_container_snapshot() -> dict:
    docker_path = shutil.which("docker")
    if not docker_path:
        return {"available": False, "status": "unavailable", "reason": "docker_cli_not_found", "containers": []}

    try:
        result = subprocess.run(
            [docker_path, "ps", "-a", "--format", "{{json .}}"],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
    except Exception as exc:  # pragma: no cover - environment dependent
        return {"available": False, "status": "unavailable", "reason": str(exc), "containers": []}

    containers: list[dict] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            continue
        containers.append(
            {
                "name": parsed.get("Names"),
                "image": parsed.get("Image"),
                "state": parsed.get("State"),
                "status": parsed.get("Status"),
            }
        )
    return {"available": True, "status": "healthy", "containers": containers}


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin_or_manager(user)

    total_users = db.query(func.count(User.id)).scalar() or 0
    total_sessions = db.query(func.count(MentorshipSession.id)).scalar() or 0
    pending_mentor_verifications = (
        db.query(func.count(MentorProfile.user_id))
        .filter(MentorProfile.verification_status == MentorVerificationStatus.pending)
        .scalar()
        or 0
    )
    paid_payments = db.query(func.count(Payment.id)).filter(Payment.status == PaymentStatus.paid).scalar() or 0

    return {
        "total_users": int(total_users),
        "total_sessions": int(total_sessions),
        "pending_mentor_verifications": int(pending_mentor_verifications),
        "paid_payments": int(paid_payments),
    }


@router.get("/system-stats")
def system_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin(user)

    user_counts = {
        str(role): int(count)
        for role, count in db.query(User.role, func.count(User.id)).group_by(User.role).all()
    }
    session_counts = {
        str(status_value): int(count)
        for status_value, count in db.query(MentorshipSession.status, func.count(MentorshipSession.id)).group_by(MentorshipSession.status).all()
    }
    recording_counts = {
        str(status_value): int(count)
        for status_value, count in db.query(SessionRecording.status, func.count(SessionRecording.id)).group_by(SessionRecording.status).all()
    }
    active_resources = (
        db.query(func.count(Resource.id))
        .filter(Resource.is_deleted.is_(False), Resource.is_active.is_(True))
        .scalar()
        or 0
    )
    total_resources = db.query(func.count(Resource.id)).filter(Resource.is_deleted.is_(False)).scalar() or 0
    recording_rows = db.query(SessionRecording).filter(SessionRecording.deleted_at.is_(None)).all()
    recording_size_bytes = 0
    for row in recording_rows:
        if not row.object_key:
            continue
        recording_size_bytes += int(recording_service.storage.object_size(row.object_key) or 0)

    try:
        livekit = livekit_service.healthcheck()
    except Exception as exc:  # pragma: no cover - service/network dependent
        livekit = {"ok": False, "status": "unreachable", "error": str(exc)}

    try:
        bucket = storage_service.healthcheck()
    except Exception as exc:  # pragma: no cover - provider/network dependent
        bucket = {"ok": False, "status": "unreachable", "error": str(exc)}

    return {
        "api": {
            "ok": True,
            "status": "healthy",
        },
        "livekit": livekit,
        "bucket": bucket,
        "containers": _docker_container_snapshot(),
        "usage": {
            "users": {
                "total": int(sum(user_counts.values())),
                "by_role": user_counts,
            },
            "sessions": {
                "total": int(sum(session_counts.values())),
                "by_status": session_counts,
            },
            "recordings": {
                "total": int(sum(recording_counts.values())),
                "by_status": recording_counts,
                "stored_bytes": int(recording_size_bytes or 0),
            },
            "resources": {
                "total": int(total_resources),
                "active": int(active_resources),
            },
        },
    }


@router.get("/mentor-verifications")
def list_mentor_verifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin_or_manager(user)
    rows = db.query(MentorProfile).order_by(MentorProfile.verification_status.asc()).all()
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        allowed = _parse_categories_csv(scope.categories_csv if scope else "")
        rows = [row for row in rows if _parse_categories_csv(row.exams) & allowed]
    return [
        {
            "mentor_user_id": row.user_id,
            "status": row.verification_status,
            "headline": row.headline,
            "exams": row.exams,
        }
        for row in rows
    ]


@router.post("/mentor-verifications/update")
def update_mentor_verification(
    payload: MentorVerificationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin_or_manager(user)
    row = db.query(MentorProfile).filter(MentorProfile.user_id == payload.mentor_user_id).first()
    if not row:
        row = MentorProfile(user_id=payload.mentor_user_id)
        db.add(row)
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        manager_categories = _parse_categories_csv(scope.categories_csv if scope else "")
        mentor_categories = _parse_categories_csv(row.exams)
        if not manager_categories or not (manager_categories & mentor_categories):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager can approve mentors only within assigned categories",
            )

    row.verification_status = payload.status
    db.commit()
    return {
        "message": "Mentor verification updated",
        "mentor_user_id": row.user_id,
        "status": row.verification_status,
    }


@router.get("/disputes")
def list_disputes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin_or_manager(user)
    rows = db.query(Dispute).order_by(Dispute.created_at.desc()).all()
    return [
        {
            "id": row.id,
            "session_id": row.session_id,
            "opened_by_user_id": row.opened_by_user_id,
            "reason": row.reason,
            "status": row.status,
            "admin_note": row.admin_note,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/disputes/{dispute_id}")
def update_dispute(dispute_id: str, payload: DisputeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin_or_manager(user)
    row = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")
    row.status = payload.status
    row.admin_note = payload.admin_note
    db.commit()
    return {"message": "Dispute updated"}


@router.get("/users")
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin_or_manager(user)
    rows = db.query(User).order_by(User.email.asc()).all()
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        allowed = _parse_categories_csv(scope.categories_csv if scope else "")
        mentor_rows = {row.user_id: row for row in db.query(MentorProfile).all()}
        profile_rows = {row.user_id: row for row in db.query(Profile).all()}

        filtered: list[User] = []
        for row in rows:
            if row.id == user.id:
                filtered.append(row)
                continue
            if row.role == Role.mentor:
                mentor_categories = _parse_categories_csv((mentor_rows.get(row.id).exams if mentor_rows.get(row.id) else ""))
                if mentor_categories & allowed:
                    filtered.append(row)
            elif row.role == Role.student:
                student_categories = _parse_categories_csv((profile_rows.get(row.id).target_exams if profile_rows.get(row.id) else ""))
                if student_categories & allowed:
                    filtered.append(row)
        rows = filtered
    return [{"id": row.id, "email": row.email, "role": row.role} for row in rows]


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin_or_manager(user)
    rows = db.query(MentorshipSession).order_by(MentorshipSession.starts_at.desc()).all()
    user_rows = {row.id: row for row in db.query(User).all()}
    profile_rows = {row.user_id: row for row in db.query(Profile).all()}
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        allowed = _parse_categories_csv(scope.categories_csv if scope else "")
        mentor_rows = {row.user_id: row for row in db.query(MentorProfile).all()}
        filtered: list[MentorshipSession] = []
        for row in rows:
            mentor_categories = _parse_categories_csv((mentor_rows.get(row.mentor_id).exams if mentor_rows.get(row.mentor_id) else ""))
            student_categories = _parse_categories_csv((profile_rows.get(row.student_id).target_exams if profile_rows.get(row.student_id) else ""))
            if mentor_categories & allowed or student_categories & allowed:
                filtered.append(row)
        rows = filtered
    return [_session_payload(row, user_rows, profile_rows) for row in rows]


@router.get("/sessions/paginated")
def list_sessions_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    student_id: str | None = Query(default=None),
    mentor_id: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin_or_manager(user)
    rows = db.query(MentorshipSession).order_by(MentorshipSession.starts_at.desc()).all()
    user_rows = {row.id: row for row in db.query(User).all()}
    profile_rows = {row.user_id: row for row in db.query(Profile).all()}
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        allowed = _parse_categories_csv(scope.categories_csv if scope else "")
        mentor_rows = {row.user_id: row for row in db.query(MentorProfile).all()}
        rows = [
            row for row in rows
            if _parse_categories_csv((mentor_rows.get(row.mentor_id).exams if mentor_rows.get(row.mentor_id) else "")) & allowed
            or _parse_categories_csv((profile_rows.get(row.student_id).target_exams if profile_rows.get(row.student_id) else "")) & allowed
        ]
    if student_id:
        rows = [row for row in rows if row.student_id == student_id]
    if mentor_id:
        rows = [row for row in rows if row.mentor_id == mentor_id]
    if status_value:
        rows = [row for row in rows if str(row.status) == status_value]
    total = len(rows)
    start = (page - 1) * page_size
    items = [_session_payload(row, user_rows, profile_rows) for row in rows[start:start + page_size]]
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.get("/recordings")
def list_recordings_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    student_id: str | None = Query(default=None),
    mentor_id: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin_or_manager(user)
    sessions = db.query(MentorshipSession).order_by(MentorshipSession.starts_at.desc()).all()
    user_rows = {row.id: row for row in db.query(User).all()}
    profile_rows = {row.user_id: row for row in db.query(Profile).all()}
    visibility_rows = {row.session_id: row for row in db.query(SessionRecordingVisibility).all()}
    session_map = {row.id: row for row in sessions}
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        allowed = _parse_categories_csv(scope.categories_csv if scope else "")
        mentor_rows = {row.user_id: row for row in db.query(MentorProfile).all()}
        session_map = {
            row.id: row for row in sessions
            if _parse_categories_csv((mentor_rows.get(row.mentor_id).exams if mentor_rows.get(row.mentor_id) else "")) & allowed
            or _parse_categories_csv((profile_rows.get(row.student_id).target_exams if profile_rows.get(row.student_id) else "")) & allowed
        }
    recordings = [
        row for row in db.query(SessionRecording).order_by(SessionRecording.created_at.desc(), SessionRecording.updated_at.desc()).all()
        if row.session_id in session_map and row.deleted_at is None
    ]
    items: list[dict] = []
    for row in recordings:
        session = session_map.get(row.session_id)
        if not session:
            continue
        if student_id and session.student_id != student_id:
            continue
        if mentor_id and session.mentor_id != mentor_id:
            continue
        if status_value and str(row.status) != status_value:
            continue
        policy = visibility_rows.get(row.session_id)
        items.append(
            {
                "id": row.id,
                "session_id": row.session_id,
                "attempt_number": row.attempt_number,
                "status": row.status,
                "playback_url": recording_service.storage.presign_get(row.object_key) if row.object_key else None,
                "size_bytes": recording_service.storage.object_size(row.object_key) if row.object_key else None,
                "created_at": row.created_at,
                "starts_at": session.starts_at,
                "title": session.title,
                "student_id": session.student_id,
                "mentor_id": session.mentor_id,
                "student_name": _display_label(user_rows, profile_rows, session.student_id),
                "mentor_name": _display_label(user_rows, profile_rows, session.mentor_id),
                "student_email": user_rows.get(session.student_id).email if user_rows.get(session.student_id) else session.student_id,
                "mentor_email": user_rows.get(session.mentor_id).email if user_rows.get(session.mentor_id) else session.mentor_id,
                "visible_to_student": policy.visible_to_student if policy else True,
                "error_message": row.error_message,
            }
        )
    total = len(items)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "page": page, "page_size": page_size, "total": total}


@router.post("/students/{student_id}/recordings/moderate")
def moderate_student_recordings(
    student_id: str,
    action: str = Query(..., pattern="^(hide|unhide|delete)$"),
    mentor_id: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin_or_manager(user)
    sessions = db.query(MentorshipSession).filter(MentorshipSession.student_id == student_id).all()
    if mentor_id:
        sessions = [row for row in sessions if row.mentor_id == mentor_id]
    if status_value:
        sessions = [row for row in sessions if str(row.status) == status_value]

    processed = 0
    for session in sessions:
        if action == "delete":
            latest = recording_service.latest_recording(db, session.id)
            if not latest:
                continue
            recording_service.mark_deleted(db, session.id, deleted_by=user, recording_id=latest.id)
            processed += 1
            continue

        policy = db.query(SessionRecordingVisibility).filter(SessionRecordingVisibility.session_id == session.id).first()
        if not policy:
            policy = SessionRecordingVisibility(session_id=session.id, visible_to_student=True)
            db.add(policy)
            db.flush()
        policy.visible_to_student = action != "hide"
        processed += 1

    if action != "delete":
        db.commit()

    return {"message": f"{action} applied", "processed_sessions": processed}


@router.get("/manager-scopes")
def list_manager_scopes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin(user)
    rows = db.query(ManagerScope).order_by(ManagerScope.user_id.asc()).all()
    return [{"manager_user_id": row.user_id, "categories": sorted(_parse_categories_csv(row.categories_csv))} for row in rows]


@router.post("/manager-scopes/update")
def update_manager_scope(payload: ManagerScopeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin(user)
    manager_user = db.query(User).filter(User.id == payload.manager_user_id).first()
    if not manager_user or manager_user.role != Role.manager:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target user is not a manager")

    row = db.query(ManagerScope).filter(ManagerScope.user_id == payload.manager_user_id).first()
    if not row:
        row = ManagerScope(user_id=payload.manager_user_id)
        db.add(row)
    cleaned = sorted({item.strip().lower() for item in payload.categories if item.strip()})
    row.categories_csv = ",".join(cleaned)
    db.commit()
    return {"manager_user_id": row.user_id, "categories": cleaned}
