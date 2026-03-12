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
    StopEgressRequest,
)

from ..core.config import settings


class LiveKitService:
    def room_name_for_session(self, session_id: str) -> str:
        return f"session-{session_id}"

    def recording_template_url(self) -> str | None:
        if not settings.app_public_url:
            return None
        return f"{settings.app_public_url.rstrip('/')}/recording-layout"

    def recording_object_key(self, *, session_id: str, attempt_number: int) -> str:
        return f"recordings/{session_id}/session-{attempt_number}.mp4"

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

    def start_room_recording(
        self,
        *,
        room_name: str,
        session_id: str,
        attempt_number: int,
        layout: str = "speaker-dark",
    ) -> tuple[str, str]:
        return asyncio.run(
            self._start_room_recording(
                room_name=room_name,
                session_id=session_id,
                attempt_number=attempt_number,
                layout=layout,
            )
        )

    def get_egress(self, *, egress_id: str):
        return asyncio.run(self._get_egress(egress_id=egress_id))

    def stop_egress(self, *, egress_id: str):
        return asyncio.run(self._stop_egress(egress_id=egress_id))

    def healthcheck(self) -> dict:
        return asyncio.run(self._healthcheck())

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

    async def _start_room_recording(
        self,
        *,
        room_name: str,
        session_id: str,
        attempt_number: int,
        layout: str = "speaker-dark",
    ) -> tuple[str, str]:
        object_key = self.recording_object_key(session_id=session_id, attempt_number=attempt_number)
        api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            custom_base_url = self.recording_template_url()
            req = RoomCompositeEgressRequest(
                room_name=room_name,
                layout=layout,
                custom_base_url=custom_base_url or "",
                file=EncodedFileOutput(
                    file_type=MP4,
                    filepath=object_key,
                    s3=S3Upload(
                        access_key=settings.s3_access_key,
                        secret=settings.s3_secret_key,
                        region=settings.s3_region,
                        endpoint=settings.s3_endpoint,
                        bucket=settings.s3_bucket,
                        force_path_style=settings.s3_force_path_style,
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

    async def _stop_egress(self, *, egress_id: str):
        api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            return await api.egress.stop_egress(StopEgressRequest(egress_id=egress_id))
        finally:
            await api.aclose()

    async def _healthcheck(self) -> dict:
        api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            rooms = await api.room.list_rooms(ListRoomsRequest())
            room_count = len(getattr(rooms, "rooms", []) or [])
            return {
                "ok": True,
                "status": "healthy",
                "url": settings.livekit_url,
                "public_url": settings.livekit_public_url or settings.livekit_url,
                "active_rooms": room_count,
                "recording_template_url": self.recording_template_url(),
            }
        except Exception as exc:  # pragma: no cover - service/network dependent
            return {
                "ok": False,
                "status": "unreachable",
                "url": settings.livekit_url,
                "public_url": settings.livekit_public_url or settings.livekit_url,
                "recording_template_url": self.recording_template_url(),
                "error": str(exc),
            }
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
