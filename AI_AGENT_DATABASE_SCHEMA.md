# AI Agent Database Schema

## Enums
- `chat_mode`: `doubt_solving`, `study_planning`, `revision`, `mock_test_review`, `concept_learning`, `general_preparation`
- `memory_type`: `weakness`, `strength`, `goal`, `confusion`, `learning_style`, `revision_need`, `deadline`, `mistake_pattern`
- `action_status`: `pending`, `in_progress`, `completed`, `skipped`
- `priority`: `low`, `medium`, `high`

## Tables

### `courses`
- `id` (pk)
- `name`
- `exam_type`
- `description`
- `status`
- `created_at`
- `updated_at`

### `subjects`
- `id` (pk)
- `course_id` (fk -> courses.id)
- `name`
- `description`
- `syllabus`
- `priority`
- `created_at`
- `updated_at`

### `student_course_enrollments`
- `id` (pk)
- `student_id` (fk -> users.id)
- `course_id` (fk -> courses.id)
- `target_exam_date`
- `current_level`
- `daily_study_time_minutes`
- `preferences` (json)
- `status`
- `created_at`
- `updated_at`

### `ai_chat_sessions`
- `id` (pk)
- `student_id` (fk -> users.id)
- `course_id` (fk -> courses.id)
- `subject_id` (fk -> subjects.id)
- `title`
- `mode` (`chat_mode`)
- `status`
- `created_at`
- `updated_at`

### `ai_chat_messages`
- `id` (pk)
- `session_id` (fk -> ai_chat_sessions.id)
- `role` (`user|assistant|system|tool`)
- `content`
- `token_count`
- `model`
- `provider`
- `metadata` (json)
- `created_at`

### `student_learning_memories`
- `id` (pk)
- `student_id` (fk -> users.id)
- `course_id` (fk -> courses.id)
- `subject_id` (fk -> subjects.id)
- `memory_type` (`memory_type`)
- `content`
- `confidence_score`
- `source_session_id` (fk -> ai_chat_sessions.id)
- `created_at`

### `ai_study_actions`
- `id` (pk)
- `student_id` (fk -> users.id)
- `course_id` (fk -> courses.id)
- `subject_id` (fk -> subjects.id)
- `title`
- `description`
- `priority` (`priority`)
- `due_date`
- `status` (`action_status`)
- `source_session_id` (fk -> ai_chat_sessions.id)
- `created_at`
- `updated_at`

## Suggested Indexes
- `ai_chat_sessions(student_id, created_at desc)`
- `ai_chat_messages(session_id, created_at asc)`
- `student_learning_memories(student_id, course_id, subject_id, memory_type)`
- `ai_study_actions(student_id, status, due_date)`
