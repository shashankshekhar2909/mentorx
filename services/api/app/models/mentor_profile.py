from enum import StrEnum

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class MentorVerificationStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    needs_info = "needs_info"


class MentorProfile(Base):
    __tablename__ = "mentor_profiles"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    headline: Mapped[str | None] = mapped_column(String(160), nullable=True)
    exams: Mapped[str | None] = mapped_column(Text, nullable=True)
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    hourly_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    rating_avg: Mapped[float] = mapped_column(Numeric(4, 2), default=0)
    verification_status: Mapped[MentorVerificationStatus] = mapped_column(
        Enum(MentorVerificationStatus), default=MentorVerificationStatus.pending, nullable=False
    )
