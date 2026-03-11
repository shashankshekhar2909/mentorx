import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.notification import Notification
from ..models.session import Session as MentorshipSession
from ..models.user import User
from ..schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

SESSION_ID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)


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
            match = SESSION_ID_RE.search(row.message or "")
            if match:
                session_exists = db.query(MentorshipSession.id).filter(MentorshipSession.id == match.group(0)).first()
                if not session_exists:
                    db.delete(row)
                    deleted_any = True
                    continue
        visible_rows.append(row)
    if deleted_any:
      db.commit()
    return visible_rows
