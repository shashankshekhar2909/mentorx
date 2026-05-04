from datetime import date, datetime, timezone
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class CourseStatus(StrEnum):
    active = "active"
    inactive = "inactive"


class EnrollmentStatus(StrEnum):
    active = "active"
    paused = "paused"
    completed = "completed"


class CurrentLevel(StrEnum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class AIChatMode(StrEnum):
    doubt_solving = "doubt_solving"
    study_planning = "study_planning"
    revision = "revision"
    mock_test_review = "mock_test_review"
    concept_learning = "concept_learning"
    general_preparation = "general_preparation"


class AIChatSessionStatus(StrEnum):
    active = "active"
    archived = "archived"


class AIChatRole(StrEnum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"


class LearningMemoryType(StrEnum):
    weakness = "weakness"
    strength = "strength"
    goal = "goal"
    confusion = "confusion"
    learning_style = "learning_style"
    revision_need = "revision_need"
    deadline = "deadline"
    mistake_pattern = "mistake_pattern"


class StudyActionPriority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class StudyActionStatus(StrEnum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    exam_type: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CourseStatus] = mapped_column(Enum(CourseStatus), default=CourseStatus.active, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    syllabus: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class StudentCourseEnrollment(Base):
    __tablename__ = "student_course_enrollments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), index=True)
    target_exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_level: Mapped[CurrentLevel] = mapped_column(Enum(CurrentLevel), default=CurrentLevel.beginner, nullable=False)
    daily_study_time_minutes: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[EnrollmentStatus] = mapped_column(Enum(EnrollmentStatus), default=EnrollmentStatus.active, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AIChatSession(Base):
    __tablename__ = "ai_chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), index=True)
    subject_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("subjects.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    mode: Mapped[AIChatMode] = mapped_column(Enum(AIChatMode), default=AIChatMode.general_preparation, nullable=False)
    status: Mapped[AIChatSessionStatus] = mapped_column(
        Enum(AIChatSessionStatus), default=AIChatSessionStatus.active, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("ai_chat_sessions.id"), index=True)
    role: Mapped[AIChatRole] = mapped_column(Enum(AIChatRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class StudentLearningMemory(Base):
    __tablename__ = "student_learning_memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), index=True)
    subject_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("subjects.id"), nullable=True, index=True)
    memory_type: Mapped[LearningMemoryType] = mapped_column(Enum(LearningMemoryType), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    source_session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("ai_chat_sessions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AIStudyAction(Base):
    __tablename__ = "ai_study_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), index=True)
    subject_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("subjects.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[StudyActionPriority] = mapped_column(Enum(StudyActionPriority), default=StudyActionPriority.medium, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[StudyActionStatus] = mapped_column(Enum(StudyActionStatus), default=StudyActionStatus.pending, nullable=False)
    source_session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("ai_chat_sessions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
