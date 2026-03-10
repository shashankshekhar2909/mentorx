from pydantic import BaseModel, Field


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    is_active: bool


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class CategoryUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    is_active: bool = True
