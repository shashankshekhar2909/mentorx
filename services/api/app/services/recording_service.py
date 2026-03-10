from sqlalchemy.orm import Session

from ..models.session_recording import RecordingStatus, SessionRecording
from ..models.session_recording_visibility import SessionRecordingVisibility
from .storage_service import StorageService


class RecordingService:
    def __init__(self) -> None:
        self.storage = StorageService()

    def start_recording(self, db: Session, session_id: str, egress_id: str | None = None) -> SessionRecording:
        row = db.query(SessionRecording).filter(SessionRecording.session_id == session_id).first()
        if not row:
            row = SessionRecording(session_id=session_id)
            db.add(row)
        row.egress_id = egress_id
        row.status = RecordingStatus.recording
        row.error_message = None
        db.commit()
        db.refresh(row)
        return row

    def mark_uploaded(self, db: Session, session_id: str, object_key: str) -> SessionRecording:
        row = db.query(SessionRecording).filter(SessionRecording.session_id == session_id).first()
        if not row:
            row = SessionRecording(session_id=session_id)
            db.add(row)
        row.object_key = object_key
        row.playback_url = self.storage.presign_get(object_key)
        row.status = RecordingStatus.uploaded
        row.error_message = None
        self.ensure_visibility_policy(db, session_id)
        db.commit()
        db.refresh(row)
        return row

    def mark_failed(self, db: Session, session_id: str, message: str) -> SessionRecording:
        row = db.query(SessionRecording).filter(SessionRecording.session_id == session_id).first()
        if not row:
            row = SessionRecording(session_id=session_id)
            db.add(row)
        row.status = RecordingStatus.failed
        row.error_message = message
        db.commit()
        db.refresh(row)
        return row

    def ensure_visibility_policy(self, db: Session, session_id: str) -> SessionRecordingVisibility:
        policy = db.query(SessionRecordingVisibility).filter(SessionRecordingVisibility.session_id == session_id).first()
        if not policy:
            policy = SessionRecordingVisibility(session_id=session_id, visible_to_student=True)
            db.add(policy)
            db.flush()
        elif not policy.visible_to_student:
            # Student visibility is mandatory in the current product policy.
            policy.visible_to_student = True
        return policy
