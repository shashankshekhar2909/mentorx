from sqlalchemy.orm import Session

from ..models.notification import Notification


class NotificationService:
    def create(
        self,
        db: Session,
        *,
        user_id: str,
        title: str,
        message: str,
        event_type: str | None = None,
        link_path: str | None = None,
    ) -> Notification:
        row = Notification(
            user_id=user_id,
            title=title,
            message=message,
            event_type=event_type,
            link_path=link_path,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
