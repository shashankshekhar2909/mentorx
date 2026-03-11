from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db, SessionLocal
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.dispute import Dispute
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.profile import Profile
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.session_message import SessionMessage
from ..models.session_recording import RecordingStatus, SessionRecording
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

    async def connect(self, session_id: str, websocket: WebSocket, user: User, user_name: str) -> dict:
        await websocket.accept()
        entry = {
            "connection_id": str(uuid4()),
            "ws": websocket,
            "user_id": user.id,
            "user_name": user_name,
            "user_role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }
        self.connections.setdefault(session_id, []).append(entry)
        return entry

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
                "connection_id": entry.get("connection_id"),
                "user_id": entry.get("user_id"),
                "user_name": entry.get("user_name"),
                "user_role": entry.get("user_role"),
                "joined_at": entry.get("joined_at"),
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
    return f"session_{starts_at.strftime('%Y-%m-%d_%H-%M_utc')}"


def _can_student_review_or_join(session: MentorshipSession, user: User) -> bool:
    if user.role in (Role.admin, Role.manager, Role.mentor):
        return True
    if user.role == Role.student and session.student_id == user.id:
        return session.status not in (SessionStatus.pending_mentor_approval, SessionStatus.cancelled, SessionStatus.no_show)
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


def _sync_recording_state(db: Session, session: MentorshipSession) -> SessionRecording | None:
    row = recording_service.latest_recording(db, session.id)
    if not row or not row.egress_id or row.deleted_at:
        return row

    try:
        egress = livekit_service.get_egress(egress_id=row.egress_id)
    except Exception as exc:
        if "does not exist" in str(exc).lower():
            return recording_service.mark_failed(db, session.id, "Recording job no longer exists in LiveKit", recording_id=row.id)
        if row.status == RecordingStatus.recording:
            row.error_message = f"Recording sync pending: {exc}"
            db.commit()
            db.refresh(row)
        return row

    if not egress:
        return row

    if livekit_service.is_egress_complete(egress.status):
        file_results = getattr(egress, "file_results", None) or []
        object_key = None
        if file_results:
            object_key = getattr(file_results[0], "filename", None) or getattr(file_results[0], "filepath", None)
        object_key = object_key or row.object_key or f"recordings/{session.id}/meeting.mp4"
        row = recording_service.mark_uploaded(db, session.id, object_key, recording_id=row.id)
        if session.status == SessionStatus.in_progress:
            session.status = SessionStatus.completed
            db.commit()
            db.refresh(session)
        return row

    if livekit_service.is_egress_failed(egress.status):
        return recording_service.mark_failed(db, session.id, "Automatic room recording failed", recording_id=row.id)

    return row


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


def _display_label(db: Session, user_id: str, fallback_email: str | None = None) -> str:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile and profile.full_name and profile.full_name.strip():
        return profile.full_name.strip()
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        return user.email
    return fallback_email or user_id


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
            detail="Session is visible to student after mentor approval",
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
        "student": {
            "id": row.student_id,
            "name": _display_label(db, row.student_id, student.email if student else None),
            "email": student.email if student else row.student_id,
        },
        "mentor": {
            "id": row.mentor_id,
            "name": _display_label(db, row.mentor_id, mentor.email if mentor else None),
            "email": mentor.email if mentor else row.mentor_id,
        },
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
            detail="Student can join after mentor approval",
        )

    room_name = row.livekit_room or livekit_service.room_name_for_session(row.id)
    row.livekit_room = room_name
    livekit_service.ensure_room(room_name=room_name, metadata=row.id)
    if row.status in (SessionStatus.confirmed, SessionStatus.pending_payment):
        row.status = SessionStatus.ready_to_join
    db.commit()

    token = livekit_service.create_join_token(
        identity=user.id,
        room_name=room_name,
        name=_display_label(db, user.id, user.email),
    )
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
            detail="Student can review chat after mentor approval",
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

        connection = await manager.connect(session_id, websocket, user, _display_label(db, user.id, user.email))
        await websocket.send_json(
            {
                "type": "self",
                "session_id": session_id,
                "connection_id": connection["connection_id"],
                "user_id": user.id,
                "user_name": user.email,
                "user_role": user.role.value if hasattr(user.role, "value") else str(user.role),
            }
        )
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
                "connection_id": connection["connection_id"],
                "user_id": user.id,
                "user_name": user.email,
                "user_role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "joined_at": connection["joined_at"],
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
                        "connection_id": connection["connection_id"],
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
                "connection_id": connection["connection_id"] if "connection" in locals() else None,
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
    if user.role != Role.admin and user.id not in (session.mentor_id, session.student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only session participants/admin can start recording")
    room_name = session.livekit_room or livekit_service.room_name_for_session(session.id)
    session.livekit_room = room_name
    existing = recording_service.active_recording(db, session.id) or _sync_recording_state(db, session)
    if existing and existing.status in {"queued", "recording"} and not existing.deleted_at:
        if session.status != SessionStatus.in_progress:
            session.status = SessionStatus.in_progress
            db.commit()
            db.refresh(session)
        return existing
    try:
        livekit_service.ensure_room(room_name=room_name, metadata=session.id)
        egress_id, object_key = livekit_service.start_room_recording(room_name=room_name, session_id=session.id)
    except Exception as exc:
        row = recording_service.mark_failed(db, payload.session_id, f"Unable to start automatic recording: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=row.error_message)

    row = recording_service.start_recording(db, payload.session_id, egress_id=egress_id)
    row.object_key = object_key
    session.status = SessionStatus.in_progress
    db.commit()
    db.refresh(row)
    return row


@router.post("/recordings/complete", response_model=RecordingOut)
def complete_recording(payload: RecordingCompleteRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if user.role != Role.admin and user.id not in (session.mentor_id, session.student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only session participants/admin can complete recording")

    row = recording_service.mark_uploaded(db, payload.session_id, payload.object_key)
    notification_service.create(
        db,
        user_id=session.student_id,
        title="Recording ready",
        message=f"Session recording for {session.id} is now available.",
    )
    if session.mentor_id != session.student_id:
        notification_service.create(
            db,
            user_id=session.mentor_id,
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

    row = _sync_recording_state(db, session)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    if row.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording deleted")
    policy = recording_service.ensure_visibility_policy(db, session_id)
    if not _can_view_recording(session, user, policy):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recording is not visible for your role")
    if row.object_key:
        row.playback_url = recording_service.storage.presign_get(row.object_key)
    return row


@router.get("/{session_id}/recordings", response_model=list[RecordingOut])
def list_recordings(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    policy = recording_service.ensure_visibility_policy(db, session_id)
    if not _can_view_recording(session, user, policy):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recording is not visible for your role")

    rows = recording_service.list_recordings(db, session_id)
    for row in rows:
        if row.object_key:
            row.playback_url = recording_service.storage.presign_get(row.object_key)
    return rows


@router.delete("/{session_id}/recording", response_model=RecordingOut)
def delete_recording(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if user.role not in (Role.admin, Role.manager):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only manager/admin can delete recordings")
    row = recording_service.latest_recording(db, session_id)
    if not row or row.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    try:
        return recording_service.mark_deleted(db, session_id, user)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")


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
        # Mentor is always allowed to review their own recording.
        policy.visible_to_mentor = True
    elif user.role in (Role.manager, Role.admin):
        if payload.visible_to_student is not None:
            policy.visible_to_student = payload.visible_to_student
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
