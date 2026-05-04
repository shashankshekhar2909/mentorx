# AI Preparation Agent Architecture

## High-Level Components
- `apps/web` (Next.js): course/subject select, chat UI, action panel, history
- `services/api` (FastAPI): chat/session APIs, authz, context builder, memory extraction hooks
- Database: transactional storage for sessions/messages/memory/actions
- LiteLLM Gateway: OpenAI-compatible endpoint
- Groq Provider: low-latency inference behind LiteLLM

## Request Flow
1. Student picks course and subject.
2. Backend validates enrollment and ownership.
3. Backend stores user message.
4. Context builder assembles ordered context.
5. FastAPI calls LiteLLM (Groq model configured as default).
6. Backend stores assistant response.
7. Async/after-response pipeline extracts memory and study actions.

## Context Strategy
Order:
1. System prompt
2. Course information
3. Subject syllabus
4. Student profile + enrollment
5. Relevant learning memories
6. Last 10-20 messages in current session
7. Optional summaries of older sessions

Rules:
- Never dump all old chats in prompt.
- Use summary + structured memory for long-term context.
- Keep answers exam-prep aligned to selected course/subject.

## Security
- JWT-authenticated endpoints
- Row-level ownership checks for student data
- Admin access audited
- Provider secrets server-side only
