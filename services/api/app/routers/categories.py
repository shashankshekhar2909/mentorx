import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.category import Category
from ..models.user import User
from ..schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "category"


def _require_admin(user: User) -> None:
    if user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")


@router.get("", response_model=list[CategoryOut])
def list_categories(active_only: bool = True, db: Session = Depends(get_db)):
    query = db.query(Category)
    if active_only:
        query = query.filter(Category.is_active == True)  # noqa: E712
    rows = query.order_by(Category.name.asc()).all()
    return rows


@router.post("", response_model=CategoryOut)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin(user)
    slug_base = _slugify(payload.name)
    slug = slug_base
    suffix = 1
    while db.query(Category).filter(Category.slug == slug).first():
        suffix += 1
        slug = f"{slug_base}-{suffix}"

    row = Category(name=payload.name.strip(), slug=slug, is_active=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: str,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    row = db.query(Category).filter(Category.id == category_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    row.name = payload.name.strip()
    row.is_active = payload.is_active
    slug_base = _slugify(row.name)
    slug = slug_base
    suffix = 1
    while db.query(Category).filter(Category.slug == slug, Category.id != row.id).first():
        suffix += 1
        slug = f"{slug_base}-{suffix}"
    row.slug = slug
    db.commit()
    db.refresh(row)
    return row
