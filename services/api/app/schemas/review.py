from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    session_id: str
    mentor_id: str
    rating: int = Field(ge=1, le=5)
    comment: str | None = None
