from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
