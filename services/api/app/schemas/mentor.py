from pydantic import BaseModel


class MentorCard(BaseModel):
    user_id: str
    headline: str | None
    exams: str | None
    years_experience: int
    hourly_price: float
    rating_avg: float
