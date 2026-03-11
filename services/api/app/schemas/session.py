from datetime import datetime

from pydantic import BaseModel

from ..models.session import SessionStatus


class BookingCreate(BaseModel):
    mentor_id: str
    title: str = "Mentorship Session"
    notes: str | None = None
    starts_at: datetime
    duration_minutes: int = 60


class SessionOut(BaseModel):
    id: str
    student_id: str
    mentor_id: str
    title: str
    notes: str | None
    starts_at: datetime
    duration_minutes: int
    status: SessionStatus
    livekit_room: str | None
    source_chat_thread_id: str | None = None
    is_instant: bool = False

    class Config:
        from_attributes = True


class SessionUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = None
