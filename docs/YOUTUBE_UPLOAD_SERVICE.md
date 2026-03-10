# YouTube Upload Service (MVP Design)

## Goal
Provide a clean, swappable service that can upload session recordings to YouTube as **unlisted** videos. The service must be optional and safe-by-default: if credentials are missing, it should no-op with a clear status.

## Scope (MVP)
- Upload a single recording file from object storage (MinIO/S3-compatible) to YouTube.
- Set title/description/tags and make the video unlisted.
- Return the YouTube video ID and URL.
- Record upload status and errors for admin visibility.

## Non-Goals (MVP)
- Full playlist management
- Advanced privacy controls
- Batch uploads
- Analytics ingestion

## Inputs
- `recording_id`
- `storage_bucket`
- `storage_key`
- `title` (default: "ExamMentor Session - {mentor_name} & {student_name}")
- `description` (includes session summary link + policies)
- `tags` (e.g., exam name)
- `visibility` (default: `unlisted`)
- `uploader_user_id` (admin/mentor)

## Outputs
- `youtube_video_id`
- `youtube_url`
- `status` (`queued | uploading | uploaded | failed | skipped`)
- `error_message` (optional)

## Storage
- `recordings` table: store `youtube_video_id`, `youtube_upload_status`, `youtube_error`.
- Add a `youtube_upload_attempts` counter for retry visibility.

## Service Interface (Backend)
Located at `services/api/app/services/youtube_service.py`.

```python
class YouTubeUploadService:
    def is_configured(self) -> bool: ...
    def upload_recording(self, *, recording_id: str, bucket: str, key: str,
                          title: str, description: str, tags: list[str]) -> YouTubeUploadResult: ...
```

## Flow
1. Recording ready -> background task calls `youtube_service.upload_recording(...)`.
2. Service checks configuration (OAuth client + refresh token).
3. Fetch recording file from object storage (stream).
4. Upload via YouTube Data API v3.
5. Persist result on recording record.
6. Notify admin/mentor with success or failure.

## Credentials Strategy (MVP)
- Use a dedicated Google project and YouTube channel owned by ExamMentor.
- Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_TOKEN_URI` in environment.
- No user-by-user OAuth in MVP.

## Error Handling
- If not configured, return `skipped`.
- If upload fails, set `failed` with error and increment attempts.
- No auto-retry in MVP; admin can re-trigger.

## Observability
- Log upload start/end with recording ID and status.
- Persist errors for admin dashboard.

## Security
- Use least-privileged OAuth scopes for upload.
- Ensure files are not publicly readable in storage.
- Unlisted visibility only.

## Future Enhancements
- Per-mentor YouTube OAuth
- Webhooks for upload status
- Playlist management
- Retry queues
