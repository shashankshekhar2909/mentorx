from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class ChatThreadStatus(StrEnum):
    pending = "pending"
    active = "active"
    rejected = "rejected"
    closed = "closed"


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    mentor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    subject: Mapped[str] = mapped_column(String(120), index=True)
    requested_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    request_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ChatThreadStatus] = mapped_column(Enum(ChatThreadStatus), default=ChatThreadStatus.pending, index=True)
    last_message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
