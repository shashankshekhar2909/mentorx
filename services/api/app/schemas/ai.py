from pydantic import BaseModel


class StudyPlanRequest(BaseModel):
    exam: str
    strengths: list[str] = []
    weaknesses: list[str] = []
    weekly_hours: int = 8


class StudyPlanResponse(BaseModel):
    summary: str
    milestones: list[str]
