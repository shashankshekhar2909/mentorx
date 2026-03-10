from pydantic import BaseModel

from ..models.session_recording import RecordingStatus


class RecordingStartRequest(BaseModel):
    session_id: str


class RecordingCompleteRequest(BaseModel):
    session_id: str
    object_key: str


class RecordingOut(BaseModel):
    session_id: str
    egress_id: str | None
    object_key: str | None
    playback_url: str | None
    status: RecordingStatus
    error_message: str | None

    class Config:
        from_attributes = True


class RecordingVisibilityOut(BaseModel):
    session_id: str
    visible_to_student: bool
    visible_to_mentor: bool
    visible_to_manager: bool
    visible_to_admin: bool

    class Config:
        from_attributes = True


class RecordingVisibilityUpdate(BaseModel):
    visible_to_student: bool | None = None
    visible_to_mentor: bool | None = None
    visible_to_manager: bool | None = None
    visible_to_admin: bool | None = None
