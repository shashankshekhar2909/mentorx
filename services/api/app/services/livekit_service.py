from datetime import datetime, timedelta, timezone

from jose import jwt

from ..core.config import settings


class LiveKitService:
    def room_name_for_session(self, session_id: str) -> str:
        return f"session-{session_id}"

    def create_join_token(self, *, identity: str, room_name: str, ttl_minutes: int = 120) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "iss": settings.livekit_api_key,
            "sub": identity,
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
