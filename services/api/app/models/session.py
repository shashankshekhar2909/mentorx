from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class SessionStatus(StrEnum):
    draft = "draft"
    pending_mentor_approval = "pending_mentor_approval"
    pending_manager_approval = "pending_manager_approval"
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    ready_to_join = "ready_to_join"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"
    refunded = "refunded"


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    mentor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(180), default="Mentorship Session")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.pending_payment, index=True)
    livekit_room: Mapped[str | None] = mapped_column(String(120), nullable=True)
