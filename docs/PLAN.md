# ExamMentor MVP Plan

## Scope
Build a production-minded MVP for an AI-enabled exam mentorship marketplace with three roles: Student, Mentor, Admin. The MVP must be full-stack, Dockerized, and extensible for PostgreSQL migration.

## Architecture (Target)
- Frontend: Next.js (App Router, TS, Tailwind, shadcn/ui, TanStack Query, RHF + Zod, Zustand)
- Backend: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, JWT access/refresh
- Infra: Docker Compose (API, Web, DB, Redis, MinIO, LiveKit, LiveKit Egress, MailHog)
- External: OpenAI, LiveKit, MinIO, YouTube Data API v3, Razorpay placeholder

## Milestones
1. Repo Scaffolding
   - Monorepo layout (apps/web, services/api, infra, docs)
   - Docker Compose baseline
   - Shared env conventions

2. Backend Core
   - FastAPI app factory
   - DB models (users, profiles, roles, sessions, bookings, resources, reviews, payments, notifications)
   - JWT auth, refresh tokens
   - RBAC
   - Alembic migrations
   - Service layer abstractions (AI, storage, video, payments, email)

3. Frontend Core
   - App shell, auth pages, dashboards per role
   - Mentor discovery, booking flow, basic admin dashboard
   - Shared UI components and layout

4. Integrations (Stubbed)
   - LiveKit room creation and tokens
   - Egress recording pipeline (stub)
   - MinIO storage adapter
   - YouTube upload service (stub)
   - Razorpay placeholder
   - OpenAI summary + study plan (stub)

5. Polish & Docs
   - API docs, env docs, runbook
   - Sample data seeds
   - Production-minded structure

## Immediate Next Steps (Now)
- Create baseline Docker Compose with API, Redis, MinIO, MailHog, LiveKit, LiveKit Egress (done)
- Scaffold FastAPI service with auth + RBAC skeleton (in progress)
- YouTube upload service design doc (done)
- Scaffold Next.js app with Tailwind + shadcn/ui (pending)
