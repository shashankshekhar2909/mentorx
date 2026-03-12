from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models.session_recording import RecordingStatus, SessionRecording
from ..models.session_recording_visibility import SessionRecordingVisibility
from ..models.user import User
from .storage_service import StorageService


class RecordingService:
    def __init__(self) -> None:
        self.storage = StorageService()

    def list_recordings(self, db: Session, session_id: str, include_deleted: bool = False) -> list[SessionRecording]:
        query = db.query(SessionRecording).filter(SessionRecording.session_id == session_id)
        if not include_deleted:
            query = query.filter(SessionRecording.deleted_at.is_(None))
        return query.order_by(SessionRecording.attempt_number.desc(), SessionRecording.created_at.desc()).all()

    def latest_recording(self, db: Session, session_id: str, include_deleted: bool = False) -> SessionRecording | None:
        rows = self.list_recordings(db, session_id, include_deleted=include_deleted)
        return rows[0] if rows else None

    def active_recording(self, db: Session, session_id: str) -> SessionRecording | None:
        return (
            db.query(SessionRecording)
            .filter(
                SessionRecording.session_id == session_id,
                SessionRecording.deleted_at.is_(None),
                SessionRecording.status.in_([RecordingStatus.queued, RecordingStatus.recording]),
            )
            .order_by(SessionRecording.attempt_number.desc(), SessionRecording.created_at.desc())
            .first()
        )

    def next_attempt_number(self, db: Session, session_id: str) -> int:
        latest = self.latest_recording(db, session_id, include_deleted=True)
        return (latest.attempt_number + 1) if latest else 1

    def start_recording(self, db: Session, session_id: str, egress_id: str | None = None) -> SessionRecording:
        existing = self.active_recording(db, session_id)
        if existing and existing.status == RecordingStatus.recording:
            return existing

        next_attempt = self.next_attempt_number(db, session_id)
        row = SessionRecording(session_id=session_id, attempt_number=next_attempt)
        db.add(row)
        row.egress_id = egress_id
        row.status = RecordingStatus.recording
        row.error_message = None
        db.commit()
        db.refresh(row)
        return row

    def mark_uploaded(self, db: Session, session_id: str, object_key: str, recording_id: str | None = None) -> SessionRecording:
        row = None
        if recording_id:
            row = db.query(SessionRecording).filter(SessionRecording.id == recording_id).first()
        if not row:
            row = self.active_recording(db, session_id) or self.latest_recording(db, session_id, include_deleted=True)
        if not row:
            row = SessionRecording(session_id=session_id, attempt_number=1)
            db.add(row)
        row.object_key = object_key
        row.playback_url = self.storage.presign_get(object_key)
        row.status = RecordingStatus.uploaded
        row.error_message = None
        row.deleted_at = None
        row.deleted_by_user_id = None
        self.ensure_visibility_policy(db, session_id)
        db.commit()
        db.refresh(row)
        return row

    def mark_failed(self, db: Session, session_id: str, message: str, recording_id: str | None = None) -> SessionRecording:
        row = None
        if recording_id:
            row = db.query(SessionRecording).filter(SessionRecording.id == recording_id).first()
        if not row:
            row = self.active_recording(db, session_id) or self.latest_recording(db, session_id, include_deleted=True)
        if not row:
            row = SessionRecording(session_id=session_id, attempt_number=1)
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
        return policy

    def mark_deleted(self, db: Session, session_id: str, deleted_by: User, recording_id: str | None = None) -> SessionRecording:
        row = None
        if recording_id:
            row = db.query(SessionRecording).filter(SessionRecording.id == recording_id).first()
        if not row:
            row = self.latest_recording(db, session_id)
        if not row:
            raise ValueError("Recording not found")
        if row.object_key:
            try:
                self.storage.delete_object(row.object_key)
            except Exception:
                # Metadata deletion is the source of truth; object cleanup is best-effort.
                pass
        row.playback_url = None
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by_user_id = deleted_by.id
        row.error_message = "Recording deleted by manager/admin"
        db.commit()
        db.refresh(row)
        return row
