# AI Agent Execution Plan

## Phase 1 (Backend Foundations)
- [ ] Add models + migrations:
  - course, subject, enrollment, chat_session, chat_message
- [ ] Seed initial course + subjects (UPPSC example)
- [ ] Implement course + subject APIs
- [ ] Implement chat session CRUD APIs
- [ ] Implement send/list message APIs
- [ ] Integrate FastAPI -> LiteLLM (Groq behind gateway)
- [ ] Persist user + assistant messages

## Phase 2 (Memory + Actions)
- [ ] Memory extraction from chats
- [ ] Study action extraction and persistence
- [ ] Student memory listing API
- [ ] Study action list/update APIs

## Phase 3 (Frontend)
- [ ] Course selection screen
- [ ] Subject selection screen
- [ ] AI chat page
- [ ] Session history sidebar + new chat
- [ ] Study action panel
- [ ] Weakness/revision summary cards

## Phase 4 (Intelligence Extensions)
- [ ] Learning analytics dashboard integration
- [ ] Mentor recommendation triggers
- [ ] Mock-test review deep-linking
- [ ] Resource recommendation integration
- [ ] Safety/moderation layer

## Implementation Start Prompt
"Read AI agent planning docs and implement Phase 1 backend only: models, migration, APIs, LiteLLM integration, authz checks, and seed data." 
