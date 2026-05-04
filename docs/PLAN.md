# ExamMentor MVP Plan

## Scope
Build a production-minded MVP for an AI-enabled exam mentorship marketplace with three roles: Student, Mentor, Admin. The MVP must be full-stack, Dockerized, and extensible for PostgreSQL migration.

## Added Product Requirement: MCQ Practice Tests
- Add a student-facing MCQ practice-test section by subject/category.
- Use the existing category/exam taxonomy as the source of truth for subjects.
- Admin and manager must be able to create and manage tests.
- Mentor may also be granted test-authoring access.
- Students must be able to attempt a test, submit answers, see score immediately, and compare against prior attempts.
- For the first version, each subject/category should start with 10 questions.
- Test definitions and student attempt history must be stored in the database.

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
   - DB models (users, profiles, roles, sessions, bookings, resources, reviews, payments, notifications, practice tests, practice questions, practice attempts, practice attempt answers)
   - JWT auth, refresh tokens
   - RBAC
   - Alembic migrations
   - Service layer abstractions (AI, storage, video, payments, email)

3. Frontend Core
   - App shell, auth pages, dashboards per role
   - Mentor discovery, booking flow, basic admin dashboard
   - Student MCQ practice-test area with score history
   - Manager/admin test management UI and mentor authoring access workflow
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
   - Sample MCQ tests per subject/category
   - Production-minded structure

## Immediate Next Steps (Now)
- Create baseline Docker Compose with API, Redis, MinIO, MailHog, LiveKit, LiveKit Egress (done)
- Scaffold FastAPI service with auth + RBAC skeleton (in progress)
- YouTube upload service design doc (done)
- Scaffold Next.js app with Tailwind + shadcn/ui (pending)

## Next Planned Module: MCQ Practice Tests
1. Data Model
   - `practice_tests`: test metadata, category id, creator id, publish state, active flag
   - `practice_questions`: test id, prompt, four options, correct option, explanation, display order
   - `practice_attempts`: test id, student id, score, total questions, submitted timestamp
   - `practice_attempt_answers`: attempt id, question id, selected option, correctness
2. Permissions
   - Admin: full create/update/delete/publish access
   - Manager: full create/update/delete/publish access
   - Mentor: optional create/update access when explicitly allowed
   - Student: attempt tests and view own attempt history
3. First-Cut Seeding Rule
   - Create one 10-question active test per subject/category
   - Store tests in DB, not hardcoded in frontend
4. Student Experience
   - New Practice Tests entry in student dashboard/navigation
   - Select subject/category, attempt test, submit answers
   - See current score and previous-attempt score comparison
5. Staff Experience
   - Create/edit questions
   - Publish/unpublish tests
   - Control mentor authoring access

---

## AI Preparation Agent Initiative (2026-05-04)

A dedicated AI Preparation Agent initiative is now planned for MentorX. This agent is student-specific, course-aware, and subject-aware; it is not a global chatbot.

Planning docs added at repo root:
- `AI_AGENT_PLAN.md`
- `AI_AGENT_ARCHITECTURE.md`
- `AI_AGENT_DATABASE_SCHEMA.md`
- `AI_AGENT_API_SPEC.md`
- `AI_AGENT_PROMPTS.md`
- `AI_AGENT_LITELLM_GROQ_SETUP.md`
- `AI_AGENT_EXECUTION_PLAN.md`

Execution direction:
- Phase 1: Backend models, migrations, course/subject APIs, chat session/message APIs, LiteLLM-Groq integration
- Phase 2: Memory extraction + study actions
- Phase 3: Frontend chat and task UX
- Phase 4: Analytics, mentor/resource recommendations, and deeper intelligence
