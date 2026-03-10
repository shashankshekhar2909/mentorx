from dataclasses import dataclass

from ..core.config import settings


@dataclass
class YouTubeUploadResult:
    status: str
    youtube_video_id: str | None = None
    youtube_url: str | None = None
    error_message: str | None = None


class YouTubeUploadService:
    def is_configured(self) -> bool:
        return all(
            [
                settings.google_client_id,
                settings.google_client_secret,
                settings.google_refresh_token,
                settings.google_token_uri,
            ]
        )

    def upload_recording(
        self,
        *,
        recording_id: str,
        bucket: str,
        key: str,
        title: str,
        description: str,
        tags: list[str],
    ) -> YouTubeUploadResult:
        if not self.is_configured():
            return YouTubeUploadResult(status="skipped", error_message="YouTube credentials not configured")

        # TODO: Implement streaming download from object storage and upload via YouTube Data API.
        return YouTubeUploadResult(status="failed", error_message="Upload not implemented")
