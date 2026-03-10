from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class RecordingStatus(StrEnum):
    queued = "queued"
    recording = "recording"
    uploaded = "uploaded"
    failed = "failed"
    skipped = "skipped"


class SessionRecording(Base):
    __tablename__ = "session_recordings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), unique=True, index=True)
    egress_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    object_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    playback_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[RecordingStatus] = mapped_column(Enum(RecordingStatus), default=RecordingStatus.queued, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
