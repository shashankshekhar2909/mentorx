from pydantic import BaseModel

from ..core.rbac import Role


class ProfileUpsert(BaseModel):
    full_name: str | None = None
    bio: str | None = None
    timezone: str | None = None
    language: str | None = None
    target_exams: str | None = None


class ProfileOut(ProfileUpsert):
    user_id: str

    class Config:
        from_attributes = True


class ProfileIdentityOut(ProfileOut):
    email: str
    role: Role
    display_name: str
