from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class SessionRecordingVisibility(Base):
    __tablename__ = "session_recording_visibility"

    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), primary_key=True)
    visible_to_student: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    visible_to_mentor: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    visible_to_manager: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    visible_to_admin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
