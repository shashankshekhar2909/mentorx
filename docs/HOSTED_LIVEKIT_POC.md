# Hosted LiveKit POC Setup

## Goal
Run MentorX against hosted LiveKit for the POC instead of the local Docker `livekit` and `livekit-egress` services, while keeping session recording enabled.

The same bucket strategy also covers:
- session recordings
- mentor resource documents
- session file uploads and attachments

## What Changed In Repo
- Local media services in [infra/docker-compose.yml](/home/shashank/project/mentorx/infra/docker-compose.yml) are now behind the `local-media` profile.
- API startup no longer tries to auto-create a storage bucket unless `S3_AUTO_CREATE_BUCKET=true`.
- S3 path-style addressing is now configurable through `S3_FORCE_PATH_STYLE`.
- `.env.example` now treats hosted LiveKit + hosted object storage as the primary setup.

## What You Need To Replace Local Media
You still need:
- A hosted LiveKit server URL.
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
- An S3-compatible bucket for recordings.
- Public/object API credentials for that bucket.

You can stop depending on:
- Docker `livekit`
- Docker `livekit-egress`
- Docker `minio`

You can keep using:
- Docker `web`
- Docker `api`
- Docker `redis`
- Docker `proxy`

## Required Env Vars
Set these in [.env](/home/shashank/project/mentorx/.env):

```env
LIVEKIT_URL=<hosted-livekit-server-url>
LIVEKIT_PUBLIC_URL=<browser-reachable-livekit-url>
LIVEKIT_API_KEY=<livekit-api-key>
LIVEKIT_API_SECRET=<livekit-api-secret>

S3_ENDPOINT=<s3-api-endpoint>
S3_PUBLIC_ENDPOINT=<public-s3-endpoint-or-same-as-api-endpoint>
S3_ACCESS_KEY=<bucket-access-key>
S3_SECRET_KEY=<bucket-secret-key>
S3_BUCKET=<bucket-name>
S3_REGION=<bucket-region>
S3_FORCE_PATH_STYLE=false
S3_AUTO_CREATE_BUCKET=false
```

## Recording Behavior
Recording still works, but only if hosted LiveKit egress can upload into the same bucket our API reads from.

Current flow:
1. MentorX backend starts LiveKit room composite egress.
2. LiveKit writes `recordings/<session_id>/session-<attempt>.mp4` into your configured bucket.
3. MentorX stores the object key in the DB.
4. MentorX generates playback links from the configured S3 endpoint.

This means recording needs both:
- Hosted LiveKit egress support.
- A working S3-compatible bucket configuration.

## Custom Recording Layout
The app now supports a custom LiveKit recording template at:
- `/recording-layout`

Backend egress will use:
- `APP_PUBLIC_URL + /recording-layout`

Current layout behavior:
- screen share is primary when present
- otherwise camera recording uses a stable equal 2-up layout
- if only one participant remains, a placeholder tile fills the empty slot instead of leaving a blank featured area

## Bucket Scope In MentorX
Current storage prefixes:
- `recordings/<session_id>/session-<attempt>.mp4`
- `resources/<user_id>/<timestamp>-<filename>`
- `sessions/<session_id>/<user_id>/<timestamp>-<filename>`

So for the POC, one bucket is enough. We do not need a separate video bucket and document bucket unless you want stricter lifecycle or cost controls later.

## Important Recording Constraint
The app does not host video files itself. It only stores metadata and signs playback URLs.

If LiveKit uploads recordings into a different bucket/provider than MentorX is configured for:
- recording rows may exist
- playback URLs will fail
- file-size lookup will fail

So the bucket configured in MentorX must be the same destination used by LiveKit egress.

## Webhook Notes
Existing endpoint:
- `POST /api/webhooks/livekit/egress`

This endpoint is useful if your hosted LiveKit setup sends egress completion events back to MentorX. Even without webhook delivery, the app also polls egress state from the LiveKit API when session recordings are loaded.

## Docker Commands
Hosted POC path:

```bash
docker compose -f infra/docker-compose.yml up -d web api redis proxy
```

Local media fallback path:

```bash
docker compose -f infra/docker-compose.yml --profile local-media up -d
```

## Recommended POC Stack
- Hosted LiveKit Cloud or hosted LiveKit server
- S3 or R2 bucket for recordings
- Local Docker for MentorX app only

## Open Follow-Up
Before the POC, confirm whether the hosted LiveKit provider you choose supports:
- room composite egress
- S3 uploads
- webhook delivery

Without egress, live calls work but automatic session recordings will not.
