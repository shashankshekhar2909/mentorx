from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    event_type: str | None = None
    link_path: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
