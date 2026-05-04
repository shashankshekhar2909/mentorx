from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class PracticeTest(Base):
    __tablename__ = "practice_tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PracticeQuestion(Base):
    __tablename__ = "practice_questions"
    __table_args__ = (UniqueConstraint("test_id", "position", name="uq_practice_question_position"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    test_id: Mapped[str] = mapped_column(String(36), ForeignKey("practice_tests.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    option_a: Mapped[str] = mapped_column(Text)
    option_b: Mapped[str] = mapped_column(Text)
    option_c: Mapped[str] = mapped_column(Text)
    option_d: Mapped[str] = mapped_column(Text)
    correct_option: Mapped[str] = mapped_column(String(1))
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    test_id: Mapped[str] = mapped_column(String(36), ForeignKey("practice_tests.id"), index=True)
    student_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PracticeAttemptAnswer(Base):
    __tablename__ = "practice_attempt_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    attempt_id: Mapped[str] = mapped_column(String(36), ForeignKey("practice_attempts.id"), index=True)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("practice_questions.id"), index=True)
    selected_option: Mapped[str | None] = mapped_column(String(1), nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
