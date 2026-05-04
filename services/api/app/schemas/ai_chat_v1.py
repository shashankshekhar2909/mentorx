from datetime import date, datetime

from pydantic import BaseModel, Field

from ..models.ai_prep import AIChatMode, AIChatRole, AIChatSessionStatus, CurrentLevel


class CourseOut(BaseModel):
    id: str
    name: str
    exam_type: str
    description: str | None
    status: str


class SubjectOut(BaseModel):
    id: str
    course_id: str
    name: str
    description: str | None
    syllabus: str | None
    priority: int


class AIChatSessionCreate(BaseModel):
    course_id: str
    subject_id: str | None = None
    mode: AIChatMode = AIChatMode.general_preparation
    title: str | None = Field(default=None, max_length=180)


class AIChatSessionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=180)
    status: AIChatSessionStatus | None = None


class AIChatSessionOut(BaseModel):
    id: str
    student_id: str
    course_id: str
    subject_id: str | None
    title: str
    mode: AIChatMode
    status: AIChatSessionStatus
    created_at: datetime
    updated_at: datetime


class AIChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=6000)


class AIChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: AIChatRole
    content: str
    token_count: int | None
    model: str | None
    provider: str | None
    created_at: datetime


class AIChatSessionDetail(BaseModel):
    session: AIChatSessionOut
    messages: list[AIChatMessageOut]


class AIChatResponse(BaseModel):
    session_id: str
    user_message: AIChatMessageOut
    assistant_message: AIChatMessageOut


class StudentMemoryOut(BaseModel):
    id: str
    student_id: str
    course_id: str
    subject_id: str | None
    memory_type: str
    content: str
    confidence_score: int
    source_session_id: str | None
    created_at: datetime


class StudyActionOut(BaseModel):
    id: str
    student_id: str
    course_id: str
    subject_id: str | None
    title: str
    description: str | None
    priority: str
    due_date: date | None
    status: str
    source_session_id: str | None
    created_at: datetime
    updated_at: datetime


class StudyActionUpdate(BaseModel):
    status: str


class StudentEnrollmentOut(BaseModel):
    id: str
    student_id: str
    course_id: str
    target_exam_date: date | None
    current_level: CurrentLevel
    daily_study_time_minutes: int
    status: str
