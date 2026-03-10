from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db, SessionLocal
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.dispute import Dispute
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.session_message import SessionMessage
from ..models.session_recording import SessionRecording
from ..models.session_recording_visibility import SessionRecordingVisibility
from ..models.user import User
from ..schemas.admin import DisputeCreate
from ..schemas.chat import ChatMessageOut
from ..schemas.recording import (
    RecordingCompleteRequest,
    RecordingOut,
    RecordingStartRequest,
    RecordingVisibilityOut,
    RecordingVisibilityUpdate,
)
from ..schemas.session import BookingCreate, SessionOut, SessionUpdate
from ..services.livekit_service import LiveKitService
from ..services.notification_service import NotificationService
from ..services.recording_service import RecordingService

router = APIRouter(prefix="/sessions", tags=["sessions"])

livekit_service = LiveKitService()
recording_service = RecordingService()
notification_service = NotificationService()


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, list[dict]] = {}

    async def connect(self, session_id: str, websocket: WebSocket, user: User) -> None:
        await websocket.accept()
        self.connections.setdefault(session_id, []).append(
            {
                "ws": websocket,
                "user_id": user.id,
                "user_name": user.email,
                "user_role": user.role.value if hasattr(user.role, "value") else str(user.role),
            }
        )

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        if session_id in self.connections:
            self.connections[session_id] = [w for w in self.connections[session_id] if w.get("ws") is not websocket]
            if not self.connections[session_id]:
                del self.connections[session_id]

    async def broadcast(self, session_id: str, payload: dict) -> None:
        dead: list = []
        for entry in self.connections.get(session_id, []):
            ws = entry.get("ws")
            if ws is None:
                dead.append(entry)
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(entry)
        if dead and session_id in self.connections:
            self.connections[session_id] = [entry for entry in self.connections[session_id] if entry not in dead]
            if not self.connections[session_id]:
                del self.connections[session_id]

    def presence(self, session_id: str) -> list[dict]:
        return [
            {
                "user_id": entry.get("user_id"),
                "user_name": entry.get("user_name"),
                "user_role": entry.get("user_role"),
            }
            for entry in self.connections.get(session_id, [])
        ]


manager = ConnectionManager()


def _can_access_session(session: MentorshipSession, user: User) -> bool:
    return user.role in (Role.admin, Role.manager) or session.student_id == user.id or session.mentor_id == user.id


def _build_session_title(raw_title: str | None, starts_at: datetime) -> str:
    title = (raw_title or "").strip()
    if title and title.lower() not in {"mentorship session", "student call request"}:
        return title
    return f"MentorX Session {starts_at.strftime('%d %b %Y %H:%M UTC')}"


def _can_student_review_or_join(session: MentorshipSession, user: User) -> bool:
    if user.role in (Role.admin, Role.manager, Role.mentor):
        return True
    if user.role == Role.student and session.student_id == user.id:
        return session.status not in (
            SessionStatus.pending_mentor_approval,
            SessionStatus.pending_manager_approval,
        )
    return False


def _can_view_recording(session: MentorshipSession, user: User, policy: SessionRecordingVisibility) -> bool:
    if user.role == Role.admin:
        return True
    if user.role == Role.manager:
        return True if policy.visible_to_manager else False
    if user.role == Role.mentor:
        return user.id == session.mentor_id and policy.visible_to_mentor
    if user.role == Role.student:
        return user.id == session.student_id and policy.visible_to_student and _can_student_review_or_join(session, user)
    return False


def _decode_user_from_token(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Missing subject")
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.email == sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if not _can_student_review_or_join(row, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session is visible to student after mentor and manager approvals",
        )
    return row


@router.get("/{session_id}/participants")
def get_session_participants(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if not _can_student_review_or_join(row, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session is visible to student after mentor approval",
        )

    student = db.query(User).filter(User.id == row.student_id).first()
    mentor = db.query(User).filter(User.id == row.mentor_id).first()
    return {
        "student": {"id": row.student_id, "name": student.email if student else row.student_id},
        "mentor": {"id": row.mentor_id, "name": mentor.email if mentor else row.mentor_id},
    }


@router.get("/calendar/list", response_model=list[SessionOut])
def calendar_list(
    date_from: datetime = Query(...),
    date_to: datetime = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(MentorshipSession).filter(MentorshipSession.starts_at >= date_from, MentorshipSession.starts_at <= date_to)
    if user.role not in (Role.admin, Role.manager):
        query = query.filter((MentorshipSession.student_id == user.id) | (MentorshipSession.mentor_id == user.id))
    return query.order_by(MentorshipSession.starts_at.asc()).all()


@router.post("", response_model=SessionOut)
def create_session_request(payload: BookingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != Role.student and user.role not in (Role.admin, Role.manager):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can request sessions")
    if not payload.mentor_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mentor_id is required")
    mentor = db.query(MentorProfile).filter(MentorProfile.user_id == payload.mentor_id).first()
    if not mentor or mentor.verification_status != MentorVerificationStatus.approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mentor is not approved for calls")

    row = MentorshipSession(
        student_id=user.id,
        mentor_id=payload.mentor_id,
        title=_build_session_title(payload.title, payload.starts_at),
        notes=payload.notes,
        starts_at=payload.starts_at,
        duration_minutes=payload.duration_minutes,
        status=SessionStatus.pending_mentor_approval,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    notification_service.create(
        db,
        user_id=row.mentor_id,
        title="New session request",
        message=f"Session request {row.id} is awaiting your approval.",
    )
    return row


@router.put("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: str,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    if payload.title is not None:
        row.title = payload.title
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.starts_at is not None:
        row.starts_at = payload.starts_at
    if payload.duration_minutes is not None:
        row.duration_minutes = payload.duration_minutes
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if user.role not in (Role.admin, Role.manager) and row.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only booking student can delete this call")
    db.delete(row)
    db.commit()
    return {"message": "Session deleted"}


@router.post("/{session_id}/approve")
def approve_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if user.role == Role.mentor:
        if row.mentor_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned mentor can approve this session")
        if row.status != SessionStatus.pending_mentor_approval:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not awaiting mentor approval")
        row.status = SessionStatus.confirmed
        db.commit()
        notification_service.create(
            db,
            user_id=row.student_id,
            title="Session approved",
            message=f"Mentor approved session {row.id}. You can join at scheduled time.",
        )
        return {"message": "Session approved by mentor"}

    if user.role == Role.manager:
        if row.status != SessionStatus.pending_manager_approval:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not awaiting manager approval")
        row.status = SessionStatus.confirmed
        db.commit()
        notification_service.create(
            db,
            user_id=row.student_id,
            title="Session approved",
            message=f"Session {row.id} approved by manager. You can join at scheduled time.",
        )
        return {"message": "Session approved by manager"}

    if user.role == Role.admin:
        if row.status == SessionStatus.pending_mentor_approval:
            row.status = SessionStatus.confirmed
            db.commit()
            return {"message": "Session approved by admin"}
        if row.status == SessionStatus.pending_manager_approval:
            row.status = SessionStatus.confirmed
            db.commit()
            notification_service.create(
                db,
                user_id=row.student_id,
                title="Session approved",
                message=f"Session {row.id} approved by admin. You can join at scheduled time.",
            )
            return {"message": "Session approved by admin"}
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not in an approvable stage")

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")


@router.post("/{session_id}/join-token")
def create_join_token(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if not _can_student_review_or_join(row, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student can join after mentor and manager approvals",
        )

    room_name = row.livekit_room or livekit_service.room_name_for_session(row.id)
    row.livekit_room = room_name
    if row.status in (SessionStatus.confirmed, SessionStatus.pending_payment):
        row.status = SessionStatus.ready_to_join
    db.commit()

    token = livekit_service.create_join_token(identity=user.id, room_name=room_name)
    public_livekit_url = settings.livekit_public_url or settings.livekit_url
    return {"room_name": room_name, "livekit_url": public_livekit_url, "token": token}


@router.post("/{session_id}/status")
def update_session_status(
    session_id: str,
    status_value: SessionStatus = Query(..., alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    row.status = status_value
    db.commit()
    return {"message": "Session status updated"}


@router.get("/{session_id}/messages", response_model=list[ChatMessageOut])
def list_messages(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if not _can_student_review_or_join(session, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student can review chat after mentor and manager approvals",
        )

    rows = db.query(SessionMessage).filter(SessionMessage.session_id == session_id).order_by(SessionMessage.created_at.asc()).all()
    return rows


@router.websocket("/{session_id}/ws")
async def websocket_chat(websocket: WebSocket, session_id: str, token: str):
    db = SessionLocal()
    try:
        try:
            user = _decode_user_from_token(token, db)
        except HTTPException:
            await websocket.close(code=1008)
            return
        session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
        if not session or not _can_access_session(session, user) or not _can_student_review_or_join(session, user):
            await websocket.close(code=1008)
            return

        await manager.connect(session_id, websocket, user)
        await websocket.send_json(
            {
                "type": "presence_snapshot",
                "session_id": session_id,
                "participants": manager.presence(session_id),
            }
        )
        await manager.broadcast(
            session_id,
            {
                "type": "presence",
                "session_id": session_id,
                "user_id": user.id,
                "user_name": user.email,
                "user_role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "joined_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        while True:
            payload = await websocket.receive_json()
            event_type = str(payload.get("type", "")).strip()
            if event_type in {"webrtc_ready", "webrtc_offer", "webrtc_answer", "webrtc_ice", "webrtc_hangup"}:
                await manager.broadcast(
                    session_id,
                    {
                        "type": event_type,
                        "session_id": session_id,
                        "sender_id": user.id,
                        "sdp": payload.get("sdp"),
                        "candidate": payload.get("candidate"),
                    },
                )
                continue

            text = str(payload.get("message", "")).strip()
            if not text:
                continue

            row = SessionMessage(session_id=session_id, sender_id=user.id, message=text)
            db.add(row)
            db.commit()
            db.refresh(row)

            await manager.broadcast(
                session_id,
                {
                    "type": "message",
                    "id": row.id,
                    "session_id": row.session_id,
                    "sender_id": row.sender_id,
                    "message": row.message,
                    "created_at": row.created_at.isoformat(),
                },
            )

    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
        await manager.broadcast(
            session_id,
            {
                "type": "presence_leave",
                "session_id": session_id,
                "user_id": user.id,
                "left_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    finally:
        db.close()


@router.post("/recordings/start", response_model=RecordingOut)
def start_recording(payload: RecordingStartRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if user.role != Role.admin and session.mentor_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor/admin can start recording")

    row = recording_service.start_recording(db, payload.session_id, egress_id=f"eg_{payload.session_id[:8]}")
    return row


@router.post("/recordings/complete", response_model=RecordingOut)
def complete_recording(payload: RecordingCompleteRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if user.role != Role.admin and session.mentor_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor/admin can complete recording")

    row = recording_service.mark_uploaded(db, payload.session_id, payload.object_key)
    notification_service.create(
        db,
        user_id=session.student_id,
        title="Recording ready",
        message=f"Session recording for {session.id} is now available.",
    )
    return row


@router.get("/{session_id}/recording", response_model=RecordingOut)
def get_recording(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    row = db.query(SessionRecording).filter(SessionRecording.session_id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    policy = recording_service.ensure_visibility_policy(db, session_id)
    if not _can_view_recording(session, user, policy):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recording is not visible for your role")
    if row.object_key:
        row.playback_url = recording_service.storage.presign_get(row.object_key)
    return row


@router.get("/{session_id}/recording-visibility", response_model=RecordingVisibilityOut)
def get_recording_visibility(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    policy = recording_service.ensure_visibility_policy(db, session_id)
    db.commit()
    db.refresh(policy)
    return policy


@router.put("/{session_id}/recording-visibility", response_model=RecordingVisibilityOut)
def update_recording_visibility(
    session_id: str,
    payload: RecordingVisibilityUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    policy = recording_service.ensure_visibility_policy(db, session_id)

    if user.role == Role.mentor:
        if session.mentor_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned mentor can change visibility")
        # Student visibility is always enabled by policy.
        policy.visible_to_student = True
        # Mentor is always allowed to review their own recording.
        policy.visible_to_mentor = True
    elif user.role in (Role.manager, Role.admin):
        # Student visibility is always enabled by policy.
        policy.visible_to_student = True
        if payload.visible_to_mentor is not None:
            policy.visible_to_mentor = payload.visible_to_mentor
        if payload.visible_to_manager is not None:
            policy.visible_to_manager = payload.visible_to_manager
        if payload.visible_to_admin is not None:
            policy.visible_to_admin = payload.visible_to_admin
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor/manager/admin can change visibility")

    db.commit()
    db.refresh(policy)
    return policy


@router.post("/{session_id}/disputes")
def create_dispute(session_id: str, payload: DisputeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    row = Dispute(session_id=session_id, opened_by_user_id=user.id, reason=payload.reason)
    db.add(row)
    db.commit()
    return {"message": "Dispute opened", "dispute_id": row.id}
