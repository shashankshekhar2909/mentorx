from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.category import Category
from ..models.resource import Resource, ResourcePurchase
from ..models.user import User
from ..schemas.resource import ResourceCreate, ResourceOut, ResourceUpdate, ResourceUploadSignRequest, ResourceUploadSignResponse
from ..services.storage_service import StorageService

router = APIRouter(prefix="/resources", tags=["resources"])
storage = StorageService()


@router.get("", response_model=list[ResourceOut])
def list_resources(db: Session = Depends(get_db)):
    rows = (
        db.query(Resource)
        .filter(Resource.is_deleted == False, Resource.is_active == True)  # noqa: E712
        .order_by(Resource.created_at.desc())
        .all()
    )
    return rows


@router.post("/upload-sign", response_model=ResourceUploadSignResponse)
def sign_resource_upload(payload: ResourceUploadSignRequest, user: User = Depends(get_current_user)):
    if user.role not in (Role.mentor, Role.manager, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor/manager/admin can upload resources")
    suffix = Path(payload.file_name).name
    object_key = f"resources/{user.id}/{int(datetime.now(timezone.utc).timestamp())}-{suffix}"
    upload_url = storage.presign_put(object_key, payload.content_type)
    return ResourceUploadSignResponse(object_key=object_key, upload_url=upload_url)


@router.post("", response_model=ResourceOut)
def create_resource(payload: ResourceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in (Role.mentor, Role.manager, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor/manager/admin can create resources")

    category_value = payload.category.strip().lower() if payload.category else None
    if category_value:
        allowed = {row.slug.lower() for row in db.query(Category).filter(Category.is_active == True).all()}  # noqa: E712
        if category_value not in allowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category")

    row = Resource(
        mentor_id=user.id,
        title=payload.title,
        description=payload.description,
        category=category_value,
        price=payload.price,
        file_key=payload.file_key,
        is_active=True,
        is_deleted=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/mine/uploaded", response_model=list[ResourceOut])
def my_uploaded_resources(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in (Role.mentor, Role.manager, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only mentor/manager/admin can view uploaded resources")
    rows = (
        db.query(Resource)
        .filter(Resource.mentor_id == user.id, Resource.is_deleted == False)  # noqa: E712
        .order_by(Resource.created_at.desc())
        .all()
    )
    return rows


@router.put("/{resource_id}", response_model=ResourceOut)
def update_resource(resource_id: str, payload: ResourceUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    if user.role != Role.admin and row.mentor_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/admin can update resource")

    category_value = payload.category.strip().lower() if payload.category else None
    if category_value:
        allowed = {c.slug.lower() for c in db.query(Category).filter(Category.is_active == True).all()}  # noqa: E712
        if category_value not in allowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category")

    row.title = payload.title.strip()
    row.description = payload.description
    row.category = category_value
    row.price = payload.price
    row.is_active = payload.is_active
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{resource_id}")
def delete_resource(resource_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    if user.role != Role.admin and row.mentor_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/admin can delete resource")
    row.is_active = False
    row.is_deleted = True
    db.commit()
    return {"message": "Resource deleted"}


@router.get("/mine/purchases")
def my_purchases(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(ResourcePurchase).filter(ResourcePurchase.buyer_id == user.id).all()
    return [{"resource_id": row.resource_id, "amount_paid": float(row.amount_paid), "purchased_at": row.purchased_at} for row in rows]


@router.post("/{resource_id}/purchase")
def purchase_resource(resource_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row or row.is_deleted or not row.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if user.id == row.mentor_id or user.role in (Role.admin, Role.manager):
        return {"message": "Owner/admin already has access"}

    purchase = ResourcePurchase(resource_id=row.id, buyer_id=user.id, amount_paid=float(row.price))
    db.add(purchase)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"message": "Already purchased"}
    return {"message": "Purchase recorded", "resource_id": row.id}


@router.get("/{resource_id}/access")
def access_resource(resource_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Resource).filter(Resource.id == resource_id).first()
    if not row or row.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    if not row.file_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resource file is not uploaded yet")

    is_owner_or_admin = user.id == row.mentor_id or user.role in (Role.admin, Role.manager)
    is_free = float(row.price) <= 0
    has_purchase = (
        db.query(ResourcePurchase)
        .filter(ResourcePurchase.resource_id == row.id, ResourcePurchase.buyer_id == user.id)
        .first()
        is not None
    )
    if not (is_owner_or_admin or is_free or has_purchase):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Purchase required before access")

    return {"resource_id": row.id, "download_url": storage.presign_get(row.file_key)}
