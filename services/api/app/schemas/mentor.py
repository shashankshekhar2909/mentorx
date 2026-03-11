from pydantic import BaseModel


class MentorCard(BaseModel):
    user_id: str
    headline: str | None
    exams: str | None
    years_experience: int
    hourly_price: float
    rating_avg: float


class MentorDiscoveryCard(MentorCard):
    connection_status: str | None = None
    connection_thread_id: str | None = None
    is_connected: bool = False
    is_requested: bool = False


class MentorStudentCard(BaseModel):
    student_id: str
    student_email: str
    subject: str
    connection_status: str
    connection_thread_id: str
    upcoming_session_id: str | None = None
    upcoming_session_starts_at: str | None = None
