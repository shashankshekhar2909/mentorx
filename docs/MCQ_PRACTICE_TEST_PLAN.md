# MCQ Practice Test Plan

## Objective
Introduce a student practice-test module where each student can attempt MCQ tests by subject/category, receive an immediate score, and track progress against earlier attempts.

## Scope For First Version
- Reuse existing `categories` as subjects.
- Start with one active 10-question test per subject/category.
- Store questions in the database.
- Store each student attempt and each answer in the database.
- Let students see:
  - current score
  - previous score for the same test
  - score history across attempts

## Authoring Roles
- Admin can create, edit, publish, unpublish, and delete tests/questions.
- Manager can create, edit, publish, unpublish, and delete tests/questions.
- Mentor can optionally be granted authoring access.

## Recommended Backend Data Model

### `practice_tests`
- `id`
- `category_id`
- `title`
- `description`
- `created_by_user_id`
- `is_active`
- `is_published`
- `question_count`
- `created_at`
- `updated_at`

### `practice_questions`
- `id`
- `test_id`
- `prompt`
- `option_a`
- `option_b`
- `option_c`
- `option_d`
- `correct_option`
- `explanation`
- `position`
- `is_active`

### `practice_attempts`
- `id`
- `test_id`
- `student_user_id`
- `score`
- `total_questions`
- `percentage`
- `started_at`
- `submitted_at`

### `practice_attempt_answers`
- `id`
- `attempt_id`
- `question_id`
- `selected_option`
- `is_correct`

### Optional `practice_test_author_access`
Use this only if mentor access is grant-based instead of role-wide.
- `id`
- `test_id` or `category_id`
- `mentor_user_id`
- `granted_by_user_id`

## Recommended API Surface
- `GET /api/practice-tests`
- `GET /api/practice-tests/{test_id}`
- `POST /api/practice-tests`
- `PUT /api/practice-tests/{test_id}`
- `POST /api/practice-tests/{test_id}/publish`
- `POST /api/practice-tests/{test_id}/attempts`
- `GET /api/practice-tests/{test_id}/attempts/mine`

## Student UX
- Add `Practice Tests` entry in student navigation/dashboard.
- Student selects subject/category.
- Student opens a 10-question test.
- Student selects one answer per question and submits.
- Submission/result page shows:
  - score out of 10
  - percentage
  - previous attempt score
  - simple attempt history

## Staff UX
- Add test management to manager/admin areas.
- Allow question CRUD inside each test.
- Allow publish/unpublish without deleting attempt history.
- If mentor access is enabled, show only categories/tests they are allowed to manage.

## Seed Content Rule
- For now, create 10 MCQs per subject/category.
- Seed data should live in backend/bootstrap flow so environments stay consistent.

## Implementation Order
1. Add SQLAlchemy models and migrations.
2. Add RBAC rules and routers.
3. Add bootstrap seed generation for 10 questions per category.
4. Add student practice-test pages and score history.
5. Add manager/admin authoring UI.
6. Add optional mentor authoring controls.
