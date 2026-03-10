from fastapi import APIRouter, Depends, HTTPException, status
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
from ..models.session import Session as MentorshipSession
from ..models.user import User
from ..schemas.admin import DisputeUpdate, ManagerScopeUpdate, MentorVerificationUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


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
    if user.role == Role.manager:
        scope = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        allowed = _parse_categories_csv(scope.categories_csv if scope else "")
        mentor_rows = {row.user_id: row for row in db.query(MentorProfile).all()}
        profile_rows = {row.user_id: row for row in db.query(Profile).all()}
        filtered: list[MentorshipSession] = []
        for row in rows:
            mentor_categories = _parse_categories_csv((mentor_rows.get(row.mentor_id).exams if mentor_rows.get(row.mentor_id) else ""))
            student_categories = _parse_categories_csv((profile_rows.get(row.student_id).target_exams if profile_rows.get(row.student_id) else ""))
            if mentor_categories & allowed or student_categories & allowed:
                filtered.append(row)
        rows = filtered
    return [
        {
            "id": row.id,
            "student_id": row.student_id,
            "mentor_id": row.mentor_id,
            "title": row.title,
            "status": row.status,
            "starts_at": row.starts_at,
        }
        for row in rows
    ]


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
