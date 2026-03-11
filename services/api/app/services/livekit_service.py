import asyncio
from datetime import datetime, timedelta, timezone

from jose import jwt
from livekit.api import (
    CreateRoomRequest,
    EgressStatus,
    EncodedFileOutput,
    ListEgressRequest,
    ListRoomsRequest,
    LiveKitAPI,
    MP4,
    RoomCompositeEgressRequest,
    S3Upload,
)

from ..core.config import settings


class LiveKitService:
    def room_name_for_session(self, session_id: str) -> str:
        return f"session-{session_id}"

    def create_join_token(self, *, identity: str, room_name: str, ttl_minutes: int = 120, name: str | None = None) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "iss": settings.livekit_api_key,
            "sub": identity,
            "name": name or identity,
            "nbf": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
            "video": {
                "room": room_name,
                "roomJoin": True,
                "canPublish": True,
                "canSubscribe": True,
                "canPublishData": True,
            },
        }
        return jwt.encode(payload, settings.livekit_api_secret, algorithm="HS256")

    def ensure_room(self, *, room_name: str, metadata: str | None = None) -> None:
        asyncio.run(self._ensure_room(room_name=room_name, metadata=metadata))

    def start_room_recording(self, *, room_name: str, session_id: str, layout: str = "speaker-dark") -> tuple[str, str]:
        return asyncio.run(self._start_room_recording(room_name=room_name, session_id=session_id, layout=layout))

    def get_egress(self, *, egress_id: str):
        return asyncio.run(self._get_egress(egress_id=egress_id))

    async def _ensure_room(self, *, room_name: str, metadata: str | None = None) -> None:
        api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            rooms = await api.room.list_rooms(ListRoomsRequest(names=[room_name]))
            if rooms.rooms:
                return
            await api.room.create_room(
                CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,
                    departure_timeout=60,
                    max_participants=10,
                    metadata=metadata or "",
                )
            )
        finally:
            await api.aclose()

    async def _start_room_recording(self, *, room_name: str, session_id: str, layout: str = "speaker-dark") -> tuple[str, str]:
        object_key = f"recordings/{session_id}/meeting.mp4"
        api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            req = RoomCompositeEgressRequest(
                room_name=room_name,
                layout=layout,
                file=EncodedFileOutput(
                    file_type=MP4,
                    filepath=object_key,
                    s3=S3Upload(
                        access_key=settings.s3_access_key,
                        secret=settings.s3_secret_key,
                        region=settings.s3_region,
                        endpoint=settings.s3_endpoint,
                        bucket=settings.s3_bucket,
                        force_path_style=True,
                    ),
                ),
            )
            info = await api.egress.start_room_composite_egress(req)
            return info.egress_id, object_key
        finally:
            await api.aclose()

    async def _get_egress(self, *, egress_id: str):
        api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            result = await api.egress.list_egress(ListEgressRequest(egress_id=egress_id))
            return result.items[0] if getattr(result, "items", None) else None
        finally:
            await api.aclose()

    @staticmethod
    def is_egress_complete(status_value: int) -> bool:
        return status_value == EgressStatus.EGRESS_COMPLETE

    @staticmethod
    def is_egress_failed(status_value: int) -> bool:
        return status_value in {
            EgressStatus.EGRESS_FAILED,
            EgressStatus.EGRESS_ABORTED,
            EgressStatus.EGRESS_LIMIT_REACHED,
        }
