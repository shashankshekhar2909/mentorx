from pydantic import BaseModel

from ..models.dispute import DisputeStatus
from ..models.mentor_profile import MentorVerificationStatus


class MentorVerificationUpdate(BaseModel):
    mentor_user_id: str
    status: MentorVerificationStatus


class DisputeCreate(BaseModel):
    reason: str


class DisputeUpdate(BaseModel):
    status: DisputeStatus
    admin_note: str | None = None


class ManagerScopeUpdate(BaseModel):
    manager_user_id: str
    categories: list[str]


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int


class DashboardSummaryOut(BaseModel):
    sessions: list[dict]
    recordings: list[dict]
