from sqlalchemy.orm import Session

from ..models.notification import Notification


class NotificationService:
    def create(self, db: Session, *, user_id: str, title: str, message: str) -> Notification:
        row = Notification(user_id=user_id, title=title, message=message)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
