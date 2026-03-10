from datetime import datetime

from pydantic import BaseModel


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    sender_id: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True
