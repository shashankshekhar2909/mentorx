from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.session import Session as MentorshipSession
from ..models.session_file import SessionFile
from ..models.user import User
from ..schemas.upload import DownloadSignRequest, DownloadSignResponse, UploadCompleteRequest, UploadSignRequest, UploadSignResponse
from ..services.storage_service import StorageService

router = APIRouter(prefix="/uploads", tags=["uploads"])

storage = StorageService()


def _can_access_session(session: MentorshipSession, user: User) -> bool:
    return user.role.value == "admin" or session.student_id == user.id or session.mentor_id == user.id


@router.post("/sign", response_model=UploadSignResponse)
def sign_upload(payload: UploadSignRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    suffix = Path(payload.file_name).name
    object_key = f"sessions/{payload.session_id}/{user.id}/{int(datetime.now(timezone.utc).timestamp())}-{suffix}"
    upload_url = storage.presign_put(object_key, payload.content_type)
    return UploadSignResponse(object_key=object_key, upload_url=upload_url)


@router.post("/complete")
def complete_upload(payload: UploadCompleteRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    row = SessionFile(
        session_id=payload.session_id,
        uploader_id=user.id,
        object_key=payload.object_key,
        file_name=payload.file_name,
    )
    db.add(row)
    db.commit()
    return {"message": "File metadata saved"}


@router.post("/download-sign", response_model=DownloadSignResponse)
def sign_download(payload: DownloadSignRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    file = db.query(SessionFile).filter(SessionFile.object_key == payload.object_key).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    session = db.query(MentorshipSession).filter(MentorshipSession.id == file.session_id).first()
    if not session or not _can_access_session(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    return DownloadSignResponse(download_url=storage.presign_get(payload.object_key))
