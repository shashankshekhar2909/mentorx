# CLAUDE.md — MentorX

Living documentation for the MentorX platform. Update this file whenever a significant architectural decision, new service, environment variable, or workflow change lands.

---

## 1. Project Overview

MentorX (internally called `exammentor` in several legacy identifiers) is an AI-assisted mentorship marketplace for competitive exam preparation (UPSC, JEE, NEET, GATE, CAT, etc.). It connects students with verified mentors for live video sessions, structured bookings, and study resources.

Core capabilities:
- Role-based user system: student, mentor, manager, admin
- Mentor discovery, booking, and approval workflows
- Live video sessions via LiveKit WebRTC
- Session recording with S3-compatible storage
- In-session and pre-session chat
- Payment processing via Razorpay
- AI study-plan generation and mentor recommendations via OpenAI
- Resource library (documents, YouTube links) shared by mentors
- Admin panel for user management, disputes, verifications, and system diagnostics
- Manager-scoped oversight of mentor categories

---

## 2. Tech Stack

### Frontend (`apps/web`)
| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| UI components | Headless UI, Heroicons, Font Awesome |
| Data fetching | TanStack React Query v5 |
| State | Zustand v5 (persisted auth store) |
| Forms | React Hook Form + Zod |
| Video | `livekit-client` + `@livekit/components-react` |
| Fonts | Manrope (body), Sora (display) via Next.js Google Fonts |

### Backend (`services/api`)
| Layer | Choice |
|---|---|
| Framework | FastAPI (Python 3.11+) |
| Server | Uvicorn (ASGI, factory pattern) |
| ORM | SQLAlchemy 2.0 (mapped column style) |
| Migrations | Alembic |
| Validation | Pydantic v2 + pydantic-settings |
| Auth | JWT (python-jose) + passlib[bcrypt] (pbkdf2_sha256) |
| Video | livekit-api SDK |
| Storage | boto3 (S3-compatible; MinIO locally, any S3-compatible bucket in prod) |
| Payments | Razorpay |
| AI | OpenAI SDK |
| Cache/Queues | Redis 7 |
| Email (dev) | MailHog SMTP on port 1025 |
| Google | google-api-python-client (Calendar integration) |
| HTTP client | httpx |

### Infrastructure (`infra`)
| Layer | Choice |
|---|---|
| Reverse proxy | Caddy 2 (HTTP + HTTPS with internal TLS) |
| Container runtime | Docker Compose v3.9 |
| WebRTC server | LiveKit (self-hosted or hosted cloud) |
| Recording | LiveKit Egress → S3 (MP4, room composite) |
| Object storage | MinIO (local dev) or any S3-compatible provider (prod/POC) |

### Default database
- **Development**: SQLite (`services/api/exammentor.db`) — zero-config, file-based
- **Production**: Set `DATABASE_URL` to a PostgreSQL DSN

---

## 3. Project Structure

```
mentorx/
├── apps/
│   └── web/                        # Next.js 14 frontend
│       ├── app/
│       │   ├── api/proxy/[...path]/route.ts   # Next.js catch-all API proxy to FastAPI
│       │   ├── (auth)/             # Login / register route group
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── dashboard/          # Protected workspace (auth-guarded layout)
│       │   │   ├── layout.tsx      # Auth guard — redirects to /login if no session
│       │   │   ├── page.tsx        # Role dispatcher — redirects to /dashboard/<role>
│       │   │   ├── admin/          # Admin panel (users, categories, disputes, etc.)
│       │   │   ├── mentor/         # Mentor dashboard (students, chats, sessions)
│       │   │   ├── student/        # Student dashboard (mentors, chats, sessions)
│       │   │   ├── manager/        # Manager oversight dashboard
│       │   │   ├── sessions/[sessionId]/  # Live session room page
│       │   │   ├── calendar/       # Session calendar
│       │   │   ├── profile/        # User profile editor
│       │   │   ├── recordings/     # Past session recordings
│       │   │   └── resources/      # Resource library
│       │   ├── recording-layout/   # Custom LiveKit egress recording template
│       │   ├── layout.tsx          # Root layout (fonts, TopNav, Providers)
│       │   ├── page.tsx            # Public homepage / mentor discovery
│       │   └── globals.css
│       ├── components/
│       │   ├── providers.tsx       # React Query provider wrapper
│       │   ├── nav.tsx             # TopNav component
│       │   ├── dashboard-shell.tsx
│       │   ├── chat-panel.tsx
│       │   ├── session-calendar.tsx
│       │   └── public-categories.tsx
│       ├── lib/
│       │   ├── api.ts              # apiUrl, apiWsUrl, authedFetch helpers
│       │   ├── auth-store.ts       # Zustand persisted auth store
│       │   ├── auth.ts             # Login/register API calls
│       │   ├── types.ts            # Shared TS types (Role, Session, TokenPair)
│       │   ├── presentation.ts     # Display formatting helpers
│       │   └── query-client.ts     # TanStack Query client singleton
│       ├── Dockerfile
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
│
├── services/
│   └── api/                        # FastAPI backend
│       ├── app/
│       │   ├── main.py             # App factory, router registration, startup hooks
│       │   ├── core/
│       │   │   ├── config.py       # Pydantic settings (all env vars)
│       │   │   ├── database.py     # SQLAlchemy engine + session
│       │   │   ├── security.py     # Password hashing, JWT encode/decode
│       │   │   ├── deps.py         # FastAPI dependencies (get_current_user, require_role)
│       │   │   └── rbac.py         # Role enum + hierarchy
│       │   ├── models/             # SQLAlchemy ORM models (one file per entity)
│       │   ├── schemas/            # Pydantic request/response schemas
│       │   ├── routers/            # FastAPI route modules (one file per domain)
│       │   │   ├── auth.py         # /api/auth — register, login
│       │   │   ├── users.py        # /api/users
│       │   │   ├── mentors.py      # /api/mentors
│       │   │   ├── sessions.py     # /api/sessions + WebSocket signaling
│       │   │   ├── bookings.py     # /api/bookings
│       │   │   ├── chats.py        # /api/chats
│       │   │   ├── payments.py     # /api/payments (Razorpay)
│       │   │   ├── uploads.py      # /api/uploads (S3)
│       │   │   ├── resources.py    # /api/resources
│       │   │   ├── reviews.py      # /api/reviews
│       │   │   ├── notifications.py # /api/notifications
│       │   │   ├── categories.py   # /api/categories
│       │   │   ├── admin.py        # /api/admin (admin + manager ops)
│       │   │   ├── ai.py           # /api/ai (study plan, mentor recommendations)
│       │   │   └── webhooks.py     # /api/webhooks/livekit/egress
│       │   └── services/           # Business-logic service layer
│       │       ├── livekit_service.py
│       │       ├── recording_service.py
│       │       ├── storage_service.py
│       │       ├── payment_service.py
│       │       ├── notification_service.py
│       │       ├── ai_service.py
│       │       ├── youtube_service.py
│       │       └── bootstrap_service.py
│       ├── alembic/                # Database migrations
│       │   └── versions/
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── exammentor.db           # SQLite dev database (gitignored in prod)
│
├── infra/
│   ├── docker-compose.yml          # All services definition
│   ├── Caddyfile                   # Caddy reverse-proxy config
│   ├── livekit.yaml                # LiveKit server config (local-media profile)
│   └── egress.yaml                 # LiveKit Egress config (local-media profile)
│
├── docs/
│   └── HOSTED_LIVEKIT_POC.md      # Guide for hosted LiveKit + S3 setup
│
├── .env                            # Local env overrides (not committed)
└── README.md
```

---

## 4. Docker Deployment Setup

### Services

| Service | Image | Port(s) | Profile | Purpose |
|---|---|---|---|---|
| `proxy` | `caddy:2` | 80, 443, 3002 (HTTP), 3003 (HTTPS) | default | Reverse proxy — routes `/api/*` to api, `/rtc/*` + `/twirp/*` to LiveKit, everything else to web |
| `web` | built from `apps/web/Dockerfile` | 3000 (internal) | default | Next.js dev server |
| `api` | built from `services/api/Dockerfile` | 8000 (internal) | default | FastAPI/Uvicorn |
| `redis` | `redis:7-alpine` | 6379 | default | Cache + LiveKit pub-sub |
| `mailhog` | `mailhog/mailhog` | 8025 (web UI), 1025 (SMTP) | default | Dev email catcher |
| `minio` | `minio/minio` | 9000 (API), 9001 (console) | `local-media` | S3-compatible object storage |
| `livekit` | `livekit/livekit-server` | 7880 (HTTP), 7881/UDP (RTC), 7882 (TCP) | `local-media` | WebRTC media server |
| `livekit-egress` | `livekit/egress` | — | `local-media` | Session recording compositor |

### Caddy routing rules
- `/api/*` → `api:8000`
- `/rtc/*`, `/twirp/*` → `livekit:7880`
- Everything else → `web:3000`
- HTTP and HTTPS listeners both configured; HTTPS uses internal self-signed TLS

### Volumes
| Volume | Used by | Purpose |
|---|---|---|
| `caddy_data` | proxy | TLS certificates |
| `caddy_config` | proxy | Caddy runtime config |
| `minio-data` | minio | Object storage data |

### Next.js API proxy
In addition to Caddy, the Next.js app exposes a catch-all server route at `app/api/proxy/[...path]/route.ts` that forwards all HTTP methods to the FastAPI service using `API_INTERNAL_BASE_URL`. This is the path used by browser clients when `NEXT_PUBLIC_API_BASE_URL=/api` (the default in Docker).

---

## 5. Running the Project

### Prerequisites
- Docker and Docker Compose
- A `.env` file at the repository root (copy from `.env.example` if it exists, or set vars manually — see section 6)

### Local development (full stack including local LiveKit + MinIO)

```bash
cd infra
docker compose --profile local-media up -d
```

Access points:
- App (HTTP): http://localhost:3002
- App (HTTPS): https://localhost:3003
- MailHog UI: http://localhost:8025
- MinIO console: http://localhost:9001 (user: `minio`, password: `minio123`)
- Redis: `localhost:6379`

### Local development (hosted LiveKit / S3 — recommended for POC)

```bash
cd infra
docker compose up -d web api redis proxy
```

Requires `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and S3 vars to be set in `.env`. See `docs/HOSTED_LIVEKIT_POC.md` for the full checklist.

### Running the frontend standalone (outside Docker)

```bash
cd apps/web
npm install
npm run dev          # starts on port 3000
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api` (or use the proxy default `/api` if Caddy is running).

### Running the backend standalone (outside Docker)

```bash
cd services/api
pip install -e .     # or: pip install -r requirements if you export one
uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 --reload
```

The API will auto-create tables and seed default users on first startup.

### Database migrations (Alembic)

```bash
cd services/api

# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe the change"

# Downgrade one step
alembic downgrade -1
```

Note: In development with SQLite, the `seed_default_users` bootstrap function also applies a set of additive column backfills for schema evolution. These are SQLite-safe `ALTER TABLE ADD COLUMN` statements and are idempotent.

---

## 6. Key Environment Variables

All variables are consumed by the FastAPI backend via `services/api/app/core/config.py` (Pydantic Settings). The frontend only consumes `NEXT_PUBLIC_*` vars at build/runtime.

### Application

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `change-me` | JWT signing secret — **must be changed in production** |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `APP_PUBLIC_URL` | none | Publicly reachable URL of the app (used for LiveKit egress recording template URL) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3002` | Comma-separated list of allowed CORS origins |
| `ACCESS_TOKEN_EXP_MINUTES` | `30` | JWT access token lifetime |
| `REFRESH_TOKEN_EXP_DAYS` | `7` | JWT refresh token lifetime |

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./exammentor.db` | SQLAlchemy DSN — use a PostgreSQL URL in production |

### Redis

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |

### LiveKit

| Variable | Default | Description |
|---|---|---|
| `LIVEKIT_URL` | `http://livekit:7880` | LiveKit server URL (server-to-server) |
| `LIVEKIT_PUBLIC_URL` | none | Browser-reachable LiveKit URL (for token generation) |
| `LIVEKIT_API_KEY` | `devkey` | LiveKit API key |
| `LIVEKIT_API_SECRET` | `devsecret` | LiveKit API secret |

### S3 / Object Storage

| Variable | Default | Description |
|---|---|---|
| `S3_ENDPOINT` | `http://minio:9000` | S3 API endpoint |
| `S3_PUBLIC_ENDPOINT` | none | Public-facing S3 URL for generating playback links |
| `S3_ACCESS_KEY` | `minio` | S3 access key |
| `S3_SECRET_KEY` | `minio123` | S3 secret key |
| `S3_BUCKET` | `exammentor` | Bucket name |
| `S3_REGION` | `us-east-1` | Bucket region |
| `S3_FORCE_PATH_STYLE` | `true` | Use path-style S3 addressing (required for MinIO; set `false` for AWS S3 / R2) |
| `S3_AUTO_CREATE_BUCKET` | `false` | Auto-create bucket on startup (useful for local MinIO) |

### Payments

| Variable | Default | Description |
|---|---|---|
| `RAZORPAY_KEY_ID` | none | Razorpay publishable key |
| `RAZORPAY_KEY_SECRET` | none | Razorpay secret key |
| `RAZORPAY_WEBHOOK_SECRET` | none | Razorpay webhook signature secret |

### AI

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | none | OpenAI API key (used for study plan generation) |

### Google (Calendar integration)

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | none | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | none | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | none | Stored refresh token for calendar API calls |

### Frontend (Next.js)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `/api` | API base URL used by browser clients |
| `API_INTERNAL_BASE_URL` | `http://api:8000/api` | Internal URL used by the Next.js proxy route (server-side only) |
| `NEXT_PUBLIC_WS_API_BASE_URL` | none | Override WebSocket base URL (auto-derived from `NEXT_PUBLIC_API_BASE_URL` if unset) |
| `NEXT_PUBLIC_API_WS_PORT` | `8002` | WebSocket port fallback when using the proxy path |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js telemetry |

### Caddy

| Variable | Description |
|---|---|
| `APP_HOST` | Hostname used by Caddy `default_sni` (defaults to `localhost`) |

---

## 7. Important Commands

### Frontend

```bash
# From apps/web/
npm run dev          # dev server on port 3000
npm run build        # production build
npm run start        # serve production build on port 3000
npm run lint         # ESLint
```

### Backend

```bash
# From services/api/
uvicorn app.main:create_app --factory --reload --port 8000

# Alembic
alembic upgrade head
alembic revision --autogenerate -m "<description>"
alembic downgrade -1
alembic current
alembic history
```

### Docker Compose (run from repo root or infra/)

```bash
# Hosted LiveKit / external S3 (default)
docker compose -f infra/docker-compose.yml up -d web api redis proxy

# Full local stack (LiveKit, Egress, MinIO included)
docker compose -f infra/docker-compose.yml --profile local-media up -d

# Rebuild a specific service after code changes
docker compose -f infra/docker-compose.yml build web
docker compose -f infra/docker-compose.yml up -d --no-deps web

# Tail logs
docker compose -f infra/docker-compose.yml logs -f api
docker compose -f infra/docker-compose.yml logs -f web

# Stop everything
docker compose -f infra/docker-compose.yml down

# Destroy volumes (wipes MinIO data and Caddy state)
docker compose -f infra/docker-compose.yml down -v
```

### FastAPI interactive docs
Available at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc` when the API container is running.

---

## 8. Architecture Notes

### Authentication flow
1. Client POSTs to `POST /api/auth/login` with `application/x-www-form-urlencoded` (OAuth2 password flow).
2. API returns a `TokenPair` (access token + refresh token, both HS256 JWTs signed with `SECRET_KEY`).
3. The frontend stores the pair in the Zustand `useAuthStore` (persisted to `localStorage` under key `exammentor-auth`).
4. All subsequent API calls attach `Authorization: Bearer <access_token>` via `authedFetch` in `lib/api.ts`.
5. A 401 response clears the store and redirects to `/login`.
6. Public registration (`POST /api/auth/register`) only allows `student` and `mentor` roles. `manager` and `admin` accounts must be created by an existing admin.

### Password hashing
Uses `passlib` with `pbkdf2_sha256` (not bcrypt, despite the `passlib[bcrypt]` install — the context explicitly selects `pbkdf2_sha256`).

### Role-based access control
Four roles in ascending privilege order:

| Role | Level | Created via |
|---|---|---|
| `student` | 1 | Public registration |
| `mentor` | 2 | Public registration |
| `manager` | 3 | Admin only |
| `admin` | 4 | Seeded or admin-created |

`require_role(required)` in `core/deps.py` grants access if `user.role == required` OR `user.role == admin` (admin always passes). The hierarchy in `core/rbac.py` also exposes `has_role(required, actual)` for programmatic checks.

The frontend routes to `/dashboard/<role>` on login (`dashboard/page.tsx`). Dashboard layout guards (`dashboard/layout.tsx`) redirect unauthenticated users to `/login`.

### API routing
All FastAPI routes share the `/api` prefix (set via `settings.api_prefix`). Route modules are registered in `app/main.py`. Each router module also sets its own sub-prefix (e.g., `/sessions`, `/auth`, `/admin`).

Full path example: `GET /api/sessions/{session_id}`

### Next.js proxy pattern
Browser clients call `/api/*` which the Next.js catch-all route at `app/api/proxy/[...path]/route.ts` forwards to `API_INTERNAL_BASE_URL` (defaults to `http://api:8000/api` in Docker). This avoids CORS issues and keeps credentials server-side. WebSocket connections (`apiWsUrl`) bypass this proxy and connect directly.

### WebSocket signaling (in-session chat)
The sessions router (`/api/sessions/{session_id}/ws`) exposes a FastAPI WebSocket endpoint. A `ConnectionManager` class (in-process, not distributed) manages open connections per session and broadcasts JSON payloads. This is for session chat/signaling — not for the video stream itself (that goes through LiveKit).

### LiveKit video sessions
1. Client requests a join token: `POST /api/sessions/{session_id}/join`
2. Backend calls `LiveKitService.create_join_token(identity, room_name, ...)` which issues a signed JWT directly (no LiveKit server call needed).
3. Backend calls `LiveKitService.ensure_room(room_name)` to create the LiveKit room if it does not exist.
4. Browser connects to `LIVEKIT_PUBLIC_URL` using the token via `livekit-client`.
5. Room name convention: `session-{session_id}`.

### Session recording
1. API starts egress: `LiveKitService.start_room_recording(room_name, session_id, attempt_number)` → LiveKit Egress runs a `RoomCompositeEgress` and writes `recordings/<session_id>/session-<attempt>.mp4` to the configured S3 bucket.
2. A `SessionRecording` row tracks egress ID, object key, status, and attempt number.
3. Playback URLs are generated by `StorageService` (presigned S3 URLs).
4. The `POST /api/webhooks/livekit/egress` endpoint receives egress completion events from LiveKit to update recording status. The app also polls egress state on demand.
5. Custom recording layout served from `/recording-layout` page (screen share prioritized, stable 2-up fallback).

### S3 storage prefixes
| Prefix | Content |
|---|---|
| `recordings/<session_id>/session-<attempt>.mp4` | Session recordings (written by LiveKit Egress) |
| `resources/<user_id>/<timestamp>-<filename>` | Mentor resource documents |
| `sessions/<session_id>/<user_id>/<timestamp>-<filename>` | In-session file uploads |

### Session lifecycle (status machine)
```
draft
  → pending_mentor_approval
  → pending_manager_approval
  → pending_payment
  → confirmed
  → ready_to_join
  → in_progress
  → completed
        cancelled / no_show / refunded  (terminal states from various points)
```

### Payment flow (Razorpay)
1. Student calls `POST /api/payments/order` → creates Razorpay order, stores a `Payment` row with `status=created`.
2. Student completes payment in Razorpay checkout widget.
3. Client calls `POST /api/payments/verify` with the order ID → sets payment `status=paid`, session `status=confirmed`, fires notification to mentor.

### AI features
- `POST /api/ai/study-plan` — generates a personalized study plan via OpenAI.
- `GET /api/ai/mentor-recommendations?exam=<slug>` — returns top 5 approved mentors for an exam, ranked by rating and experience.

### Bootstrap / seeding
On every API startup, `seed_default_users` runs and:
1. Applies any missing SQLite column backfills (additive schema evolution without Alembic for SQLite).
2. Seeds 5 exam categories (UPSC CSE, JEE, NEET, GATE, CAT).
3. Creates 4 demo users if they do not exist:

| Email | Role | Password |
|---|---|---|
| `student.demo@exammentor.com` | student | `Test@7861` |
| `mentor.demo@exammentor.com` | mentor | `Test@7861` |
| `manager.demo@exammentor.com` | manager | `Test@7861` |
| `admin.demo@exammentor.com` | admin | `Test@7861` |

---

## 9. Conventions and Patterns

### Backend
- **One file per domain** in `routers/`, `models/`, `schemas/`, and `services/`.
- **Service layer** (`services/`) contains business logic; routers handle HTTP concerns and call into services.
- **Dependency injection** via FastAPI `Depends()`. `get_current_user` and `require_role` are the primary auth guards used in route signatures.
- **Schemas are Pydantic v2** — use `model_config`, `Annotated`, and `Field` conventions. Request schemas in `schemas/`, response models co-located or in the same file.
- **SQLAlchemy mapped column style** — use `Mapped[T]` and `mapped_column(...)`. No legacy `Column()` calls.
- **String UUIDs** as primary keys (`String(36)`, defaulting to `str(uuid4())`).
- **`StrEnum`** for all status and role enums — values are lowercase strings, safe to serialize directly.
- **SQLite backfills in `bootstrap_service.py`** handle additive schema changes during MVP iteration. Use proper Alembic migrations for destructive or reordering changes, and when targeting PostgreSQL.

### Frontend
- **`"use client"` directive** — only add where client-side interactivity is required. Prefer server components for static/data-fetching layouts.
- **`authedFetch`** from `lib/api.ts` for all authenticated API calls — never call `fetch` directly with auth logic.
- **`useAuthStore`** (Zustand) is the single source of truth for session state. Access via `useAuthStore((s) => s.session)`.
- **`@tanstack/react-query`** for server-state data fetching. Use `queryClient.invalidateQueries()` after mutations.
- **`zod` + `react-hook-form`** for all form validation.
- **`clsx` + `tailwind-merge`** for conditional class composition.
- **Absolute imports** via `@/` path alias (configured in `tsconfig.json`).
- **Role-based routing**: `/dashboard/page.tsx` reads `session.role` and `router.replace`s to `/dashboard/<role>`.

### Naming
- Database table names: plural snake_case (`sessions`, `session_recordings`, `chat_threads`).
- Python files and functions: snake_case.
- TypeScript files and components: camelCase files, PascalCase component names.
- API route files: singular snake_case (`sessions.py`, `payments.py`).
- Environment variables: `SCREAMING_SNAKE_CASE`.

### Docker / Compose
- Source code is bind-mounted into containers (`../apps/web:/app`, `../services/api:/app`) for hot-reload in dev.
- `node_modules` and `.next` are excluded from the bind mount via anonymous volumes to prevent host/container conflicts.
- The `local-media` Docker Compose profile gates LiveKit, Egress, and MinIO. Omit it when using hosted alternatives.
- The root `.env` file is loaded by Caddy (`env_file`) and the API (`env_file`). The web service sets its env vars inline in `docker-compose.yml`.

---

## 10. Homepage Architecture (Redesign — April 2026)

The public homepage (`apps/web/app/page.tsx`) was fully redesigned with a dark/midnight theme. It is built with zero third-party animation libraries — everything is pure CSS (`@keyframes`, `backdrop-filter`, `perspective`, CSS custom properties) and native browser APIs (`IntersectionObserver`, `requestAnimationFrame`, `canvas`).

### Component structure

```
apps/web/components/home/
├── use-reveal.ts          # IntersectionObserver hook — adds .visible to scroll-reveal elements
├── use-tilt.ts            # Mousemove 3D tilt hook (CSS perspective + rotateX/Y)
├── hero-section.tsx       # Canvas particle system, typewriter headline, 3D hero cards
├── stats-bar.tsx          # rAF animated counters (1000+ students, 95% success, etc.)
├── how-it-works.tsx       # 3-step flow with SVG connector lines and glassmorphism cards
├── exam-categories.tsx    # 8-exam grid with per-card 3D mousemove tilt effect
├── featured-mentors.tsx   # Horizontal scroll track with mentor cards (ratings, price/hr)
├── testimonials.tsx       # Auto-rotating testimonial carousel with dot navigation
└── cta-section.tsx        # Full-width gradient CTA with floating badges
```

### Key CSS utilities (in `globals.css`)

| Class | Purpose |
|---|---|
| `.hp-root` | Dark theme wrapper (`#05070f` background) |
| `.glass` / `.glass-strong` | Glassmorphism (`backdrop-filter: blur`) |
| `.reveal` / `.reveal-left` / `.reveal-right` | Scroll-triggered fade-in (requires `.visible` from `use-reveal`) |
| `.animated-gradient-text` | Animated 5-colour gradient headline text |
| `.grad-text-*` | Static gradient text variants (purple-blue, amber-rose, cyan-purple) |
| `.cta-pulse` | Pulsing glow on primary CTA buttons |
| `.cta-shimmer` | Shimmer sweep animation on CTA buttons |
| `.card-3d` | `transform-style: preserve-3d` base for tiltable cards |
| `.hover-glow` | Subtle lift + glow on hover |
| `.scroll-track` | Horizontal scroll container (hidden scrollbar, snap) |
| `.particles-bg` | Dot grid background pattern via `::before` |
| `.blob` | Morphing blob shape animation |

### Homepage dark-theme full-bleed pattern

`page.tsx` wraps content in `.hp-root` and applies `negative margins` (`-mx-4 -mt-8 sm:-mx-6 lg:-mx-8`) to break out of the layout wrapper's padding while keeping all other pages unaffected.

### No framer-motion

`framer-motion` was intentionally not installed (node_modules is root-owned in the Docker volume). All animations are CSS-native or via vanilla JS hooks. This keeps bundle size minimal and avoids SSR hydration complexity.

---

## 11. Known Constraints and Technical Notes

- **SQLite in dev only**: SQLite does not support full Alembic autogenerate for column type changes or drops. Use PostgreSQL for staging/production and run `alembic upgrade head` on deploy.
- **WebSocket `ConnectionManager` is in-process**: if the API is scaled horizontally, WebSocket sessions will not be shared across instances. Redis pub/sub would be needed for horizontal scale.
- **LiveKit tokens are short-lived JWTs** (120-minute TTL by default) generated directly by the API — no round-trip to the LiveKit server.
- **Recording requires egress support**: live video works without egress, but session recordings will not be written. Confirm your LiveKit provider supports room composite egress before enabling the feature.
- **One S3 bucket for everything**: recordings, resources, and session files all share the same bucket with path prefixes. Separate buckets or lifecycle policies can be introduced later for cost/access control.
- **Payment verification is client-reported**: `POST /api/payments/verify` trusts the client-supplied `provider_order_id`. For production, replace with server-side Razorpay signature verification using `RAZORPAY_WEBHOOK_SECRET`.

## AI Preparation Agent Planning (2026-05-04)
- Follow the architecture/specification in:
  - `AI_AGENT_PLAN.md`
  - `AI_AGENT_ARCHITECTURE.md`
  - `AI_AGENT_DATABASE_SCHEMA.md`
  - `AI_AGENT_API_SPEC.md`
  - `AI_AGENT_PROMPTS.md`
  - `AI_AGENT_LITELLM_GROQ_SETUP.md`
  - `AI_AGENT_EXECUTION_PLAN.md`
- Keep the agent student-owned and strictly course/subject scoped.
- Use LiteLLM as gateway; Groq is current provider, but keep provider-swappable design.
