import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.notification import Notification
from ..models.session import Session as MentorshipSession
from ..models.session import SessionStatus
from ..models.user import User
from ..schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

SESSION_ID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
THREAD_ID_RE = SESSION_ID_RE


def _fallback_link_path(row: Notification) -> str | None:
    text = f"{row.title}\n{row.message}"
    session_match = SESSION_ID_RE.search(text)
    thread_match = THREAD_ID_RE.search(text)
    title = (row.title or "").lower()

    if row.link_path:
        return row.link_path
    if "chat" in title and "accept" in title:
        return "/dashboard/student/chats"
    if "chat request" in title or "new message" in title or "message" in title:
        if thread_match:
            return f"/dashboard/student/chats?thread={thread_match.group(0)}"
        return "/dashboard/student/chats"
    if "recording" in title and session_match:
        return f"/dashboard/sessions/{session_match.group(0)}"
    if "instant call" in title and session_match:
        return f"/dashboard/sessions/{session_match.group(0)}"
    if "session" in title and session_match:
        return f"/dashboard/sessions/{session_match.group(0)}"
    return None


@router.get("/mine", response_model=list[NotificationOut])
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )
    visible_rows: list[Notification] = []
    deleted_any = False
    for row in rows:
        if "incoming instant call" in row.title.lower():
            session_id = None
            if row.link_path:
                match = SESSION_ID_RE.search(row.link_path)
                if match:
                    session_id = match.group(0)
            if not session_id:
                match = SESSION_ID_RE.search(row.message or "")
                if match:
                    session_id = match.group(0)
            if session_id:
                session = db.query(MentorshipSession).filter(MentorshipSession.id == session_id).first()
                if not session or session.status not in {
                    SessionStatus.pending_mentor_approval,
                    SessionStatus.confirmed,
                    SessionStatus.ready_to_join,
                    SessionStatus.in_progress,
                }:
                    db.delete(row)
                    deleted_any = True
                    continue
        row.link_path = _fallback_link_path(row)
        visible_rows.append(row)
    if deleted_any:
        db.commit()
    return visible_rows


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    row.is_read = True
    db.commit()
    db.refresh(row)
    row.link_path = _fallback_link_path(row)
    return row


@router.put("/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"message": "Notifications marked as read"}
