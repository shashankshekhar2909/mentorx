# AI Preparation Agent Plan

## Product Goal
Each student gets a course-aware, subject-aware AI Preparation Agent that uses the student profile, selected exam/course, chat history, learning memory, and progress goals to provide exam-focused guidance.

## Core Product Decision
Do not use a global chatbot.

Hierarchy:
- Student
- Course/Exam
- Subject
- Chat Sessions
- Messages
- Learning Memory
- Suggested Study Actions

## Core Features
- Start new AI chat session
- Continue past chat sessions
- Restrict context to selected course and subject
- Store all messages in backend database
- Summarize older chats into learning memory
- Extract weakness, strength, goals, deadlines, confusion patterns
- Generate daily study tasks and revision plans
- Suggest MCQ practice and mock-test corrections
- Recommend mentor sessions when required
- Extend later with resource recommendations and analytics

## Acceptance Criteria
- Student creates chat for selected course + subject
- Student sends message and gets AI response via LiteLLM/Groq
- User and assistant messages are persisted
- Student reopens old sessions with history
- Context is course/subject scoped
- Old chats feed memory records (not full prompt replay)
- Study actions are generated and trackable
- Unauthorized user gets denied for another student's sessions
