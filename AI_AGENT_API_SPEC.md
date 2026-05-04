# AI Agent API Spec

## Auth
All endpoints require JWT. Students can access only their own records unless explicit elevated role policy is added.

## Course APIs
### `GET /api/v1/courses`
- Purpose: list active courses/exams
- Response: `[{id,name,exam_type,description,status}]`
- Errors: `401`

### `GET /api/v1/courses/{course_id}/subjects`
- Purpose: list subjects for course
- Validation: `course_id` exists
- Response: `[{id,course_id,name,description,syllabus,priority}]`
- Errors: `401,404`

## Chat Session APIs
### `POST /api/v1/ai-chat/sessions`
- Purpose: create session
- Body: `{course_id,subject_id,mode,title?}`
- Validation: enrollment and subject-course consistency
- Response: created session
- Errors: `400,401,403,404`

### `GET /api/v1/ai-chat/sessions`
- Purpose: list student sessions
- Query: `course_id? subject_id? mode? status? limit? offset?`
- Response: paged list
- Errors: `401`

### `GET /api/v1/ai-chat/sessions/{session_id}`
- Purpose: fetch session detail
- Authz: owner only
- Response: session + metadata
- Errors: `401,403,404`

### `PATCH /api/v1/ai-chat/sessions/{session_id}`
- Purpose: update title/status
- Body: `{title?,status?}`
- Errors: `400,401,403,404`

### `DELETE /api/v1/ai-chat/sessions/{session_id}`
- Purpose: archive session
- Behavior: soft delete/status update preferred
- Errors: `401,403,404`

## Chat Message APIs
### `POST /api/v1/ai-chat/sessions/{session_id}/messages`
- Purpose: send message, run LLM, return assistant response
- Body: `{content}`
- Validation: non-empty, max length, session ownership
- Response: `{user_message,assistant_message,session_id}`
- Errors: `400,401,403,404,429,502`

### `GET /api/v1/ai-chat/sessions/{session_id}/messages`
- Purpose: fetch ordered messages
- Query: `limit?,before?`
- Response: message list
- Errors: `401,403,404`

## Memory & Actions
### `GET /api/v1/ai-chat/student-memory`
- Purpose: fetch extracted learning memory
- Query: `course_id?,subject_id?,memory_type?`
- Errors: `401`

### `GET /api/v1/ai-chat/study-actions`
- Purpose: list generated study actions
- Query: `status?,priority?,course_id?,subject_id?`
- Errors: `401`

### `PATCH /api/v1/ai-chat/study-actions/{action_id}`
- Purpose: update action status
- Body: `{status}`
- Errors: `400,401,403,404`
