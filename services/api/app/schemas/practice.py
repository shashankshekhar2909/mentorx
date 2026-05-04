from datetime import datetime

from pydantic import BaseModel, Field, field_validator


VALID_OPTIONS = {"A", "B", "C", "D"}


class PracticeQuestionEdit(BaseModel):
    id: str | None = None
    prompt: str = Field(min_length=5)
    option_a: str = Field(min_length=1)
    option_b: str = Field(min_length=1)
    option_c: str = Field(min_length=1)
    option_d: str = Field(min_length=1)
    correct_option: str
    explanation: str | None = None
    position: int = Field(ge=1)
    is_active: bool = True

    @field_validator("correct_option")
    @classmethod
    def validate_correct_option(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in VALID_OPTIONS:
            raise ValueError("correct_option must be one of A, B, C, D")
        return normalized


class PracticeTestCreate(BaseModel):
    category_id: str
    title: str = Field(min_length=3, max_length=180)
    description: str | None = None
    is_active: bool = True
    is_published: bool = False
    questions: list[PracticeQuestionEdit] = Field(min_length=1)


class PracticeTestUpdate(BaseModel):
    category_id: str
    title: str = Field(min_length=3, max_length=180)
    description: str | None = None
    is_active: bool = True
    is_published: bool = False
    questions: list[PracticeQuestionEdit] | None = None


class PracticeAttemptAnswerInput(BaseModel):
    question_id: str
    selected_option: str | None = None

    @field_validator("selected_option")
    @classmethod
    def validate_selected_option(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if normalized not in VALID_OPTIONS:
            raise ValueError("selected_option must be one of A, B, C, D")
        return normalized


class PracticeAttemptSubmit(BaseModel):
    answers: list[PracticeAttemptAnswerInput]


class PracticeQuestionOut(BaseModel):
    id: str
    prompt: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    position: int
    is_active: bool
    correct_option: str | None = None
    explanation: str | None = None


class PracticeAttemptHistoryItem(BaseModel):
    id: str
    score: int
    total_questions: int
    percentage: float
    submitted_at: datetime


class PracticeTestListItem(BaseModel):
    id: str
    category_id: str
    category_name: str
    category_slug: str
    title: str
    description: str | None
    is_active: bool
    is_published: bool
    question_count: int
    created_at: datetime
    updated_at: datetime | None
    my_attempt_count: int = 0
    my_best_percentage: float | None = None
    my_latest_percentage: float | None = None


class PracticeTestDetail(BaseModel):
    id: str
    category_id: str
    category_name: str
    category_slug: str
    title: str
    description: str | None
    is_active: bool
    is_published: bool
    question_count: int
    questions: list[PracticeQuestionOut]
    my_attempt_count: int = 0
    my_best_percentage: float | None = None
    my_latest_percentage: float | None = None
    attempts: list[PracticeAttemptHistoryItem] = []


class PracticeAttemptAnswerResult(BaseModel):
    question_id: str
    selected_option: str | None
    correct_option: str
    is_correct: bool
    explanation: str | None = None


class PracticeAttemptResult(BaseModel):
    attempt_id: str
    score: int
    total_questions: int
    percentage: float
    previous_percentage: float | None = None
    best_percentage: float | None = None
    answers: list[PracticeAttemptAnswerResult]
