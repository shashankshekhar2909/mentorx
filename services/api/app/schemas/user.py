from pydantic import BaseModel, EmailStr

from ..core.rbac import Role


class UserMe(BaseModel):
    id: str
    email: EmailStr
    role: Role

    class Config:
        from_attributes = True
