from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.chat_message import ChatMessage
from ..models.chat_thread import ChatThread, ChatThreadStatus
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.user import User
from ..schemas.chat import ChatMessageOut
from ..schemas.chat_thread import ChatThreadAction, ChatThreadCreate, ChatThreadMessageCreate, ChatThreadOut
from ..schemas.session import SessionOut
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/chats", tags=["chats"])

notification_service = NotificationService()


def _parse_subjects(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _normalize_subject(value: str) -> str:
    cleaned = value.strip().lower()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject is required")
    return cleaned


def _can_access_thread(thread: ChatThread, user: User) -> bool:
    return user.role == Role.admin or thread.student_id == user.id or thread.mentor_id == user.id


def _serialize_message(row: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut(
        id=row.id,
        session_id=row.thread_id,
        sender_id=row.sender_id,
        message=row.message,
        created_at=row.created_at,
    )


def _build_instant_session_title(thread: ChatThread) -> str:
    return f"{thread.subject}_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M_utc')}"


@router.get("/threads", response_model=list[ChatThreadOut])
def list_threads(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(ChatThread)
    if user.role == Role.student:
        query = query.filter(ChatThread.student_id == user.id)
    elif user.role == Role.mentor:
        query = query.filter(ChatThread.mentor_id == user.id)
    elif user.role not in (Role.manager, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    rows = query.order_by(ChatThread.last_message_at.desc(), ChatThread.created_at.desc()).all()
    return rows


@router.post("/threads", response_model=ChatThreadOut)
def create_thread(payload: ChatThreadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != Role.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can request chats")

    mentor = db.query(MentorProfile).filter(MentorProfile.user_id == payload.mentor_id).first()
    if not mentor or mentor.verification_status != MentorVerificationStatus.approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mentor is not approved for chat")

    subject = _normalize_subject(payload.subject)
    mentor_subjects = _parse_subjects(mentor.exams)
    if mentor_subjects and subject not in mentor_subjects:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mentor is not mapped to this subject")

    existing = (
        db.query(ChatThread)
        .filter(
            ChatThread.student_id == user.id,
            ChatThread.mentor_id == payload.mentor_id,
            ChatThread.subject == subject,
            ChatThread.status.in_([ChatThreadStatus.pending, ChatThreadStatus.active]),
        )
        .first()
    )
    if existing:
        return existing

    now = datetime.now(timezone.utc)
    row = ChatThread(
        student_id=user.id,
        mentor_id=payload.mentor_id,
        subject=subject,
        requested_by_user_id=user.id,
        request_note=(payload.message or "").strip() or None,
        status=ChatThreadStatus.pending,
        last_message_preview=((payload.message or "").strip()[:240] or "Connection request sent"),
        last_message_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    notification_service.create(
        db,
        user_id=row.mentor_id,
        title="New chat request",
        message=f"Student requested a {row.subject} chat. Accept to start 1:1 messaging.",
    )
    return row


@router.post("/threads/{thread_id}/action", response_model=ChatThreadOut)
def update_thread_status(
    thread_id: str,
    payload: ChatThreadAction,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")
    if not _can_access_thread(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    action = payload.action.strip().lower()
    if action == "accept":
        if user.role != Role.mentor or row.mentor_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor can accept chat")
        mentor = db.query(MentorProfile).filter(MentorProfile.user_id == row.mentor_id).first()
        mentor_subjects = _parse_subjects(mentor.exams if mentor else "")
        if mentor_subjects and row.subject not in mentor_subjects:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mentor is not mapped to this subject")
        row.status = ChatThreadStatus.active
        row.accepted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
        notification_service.create(
            db,
            user_id=row.student_id,
            title="Chat accepted",
            message=f"Mentor accepted your {row.subject} chat request.",
        )
        return row

    if action == "reject":
        if user.role != Role.mentor or row.mentor_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor can reject chat")
        row.status = ChatThreadStatus.rejected
        db.commit()
        db.refresh(row)
        notification_service.create(
            db,
            user_id=row.student_id,
            title="Chat request rejected",
            message=f"Mentor declined your {row.subject} chat request.",
        )
        return row

    if action == "close":
        row.status = ChatThreadStatus.closed
        db.commit()
        db.refresh(row)
        return row

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported action")


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageOut])
def list_thread_messages(thread_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")
    if not _can_access_thread(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    messages = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_id).order_by(ChatMessage.created_at.asc()).all()
    return [_serialize_message(item) for item in messages]


@router.post("/threads/{thread_id}/messages", response_model=ChatMessageOut)
def send_thread_message(
    thread_id: str,
    payload: ChatThreadMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")
    if not _can_access_thread(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    text = payload.message.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is required")

    is_student = row.student_id == user.id
    is_mentor = row.mentor_id == user.id
    if row.status != ChatThreadStatus.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chat is not active")
    if not (is_student or is_mentor or user.role == Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    message = ChatMessage(thread_id=row.id, sender_id=user.id, message=text)
    db.add(message)
    row.last_message_preview = text[:240]
    row.last_message_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)
    return _serialize_message(message)


@router.post("/threads/{thread_id}/instant-call", response_model=SessionOut)
def start_instant_call(thread_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")
    if not _can_access_thread(row, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if row.status != ChatThreadStatus.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Accept the chat before starting an instant call")

    existing = (
        db.query(MentorshipSession)
        .filter(
            MentorshipSession.source_chat_thread_id == row.id,
            MentorshipSession.is_instant == True,  # noqa: E712
            MentorshipSession.status.in_([SessionStatus.confirmed, SessionStatus.ready_to_join, SessionStatus.in_progress]),
        )
        .order_by(MentorshipSession.starts_at.desc())
        .first()
    )
    if existing:
        return existing

    now = datetime.now(timezone.utc)
    session = MentorshipSession(
        student_id=row.student_id,
        mentor_id=row.mentor_id,
        title=_build_instant_session_title(row),
        notes=f"Instant call launched from {row.subject} chat",
        starts_at=now,
        duration_minutes=60,
        status=SessionStatus.ready_to_join,
        source_chat_thread_id=row.id,
        is_instant=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    other_user_id = row.mentor_id if row.student_id == user.id else row.student_id
    notification_service.create(
        db,
        user_id=other_user_id,
        title="Incoming instant call",
        message=f"{row.subject} call is ringing. Open session {session.id} to join now.",
    )
    return session
