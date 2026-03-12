from datetime import datetime

from pydantic import BaseModel

from ..models.chat_thread import ChatThreadStatus
from ..models.session import SessionStatus


class ChatThreadCreate(BaseModel):
    mentor_id: str
    subject: str
    message: str | None = None


class ChatThreadOut(BaseModel):
    id: str
    student_id: str
    mentor_id: str
    subject: str
    requested_by_user_id: str
    request_note: str | None
    status: ChatThreadStatus
    last_message_preview: str | None
    last_message_at: datetime | None
    accepted_at: datetime | None
    pending_call_session_id: str | None = None
    pending_call_status: SessionStatus | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatThreadAction(BaseModel):
    action: str


class ChatThreadMessageCreate(BaseModel):
    message: str
