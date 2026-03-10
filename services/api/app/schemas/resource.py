from datetime import datetime

from pydantic import BaseModel


class ResourceCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    price: float = 0
    file_key: str | None = None


class ResourceOut(ResourceCreate):
    id: str
    mentor_id: str
    is_active: bool
    is_deleted: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ResourceUploadSignRequest(BaseModel):
    file_name: str
    content_type: str


class ResourceUploadSignResponse(BaseModel):
    object_key: str
    upload_url: str


class ResourceUpdate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    price: float = 0
    is_active: bool = True
